import { css, log, querySelector, querySelectorAll } from 'helper';
import { type Component, For, Match, Show, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import { type ChaptersGroup, getChapters } from 'userscript/copyApi';

import { type HiddenType } from './helper';

/** 生成目录 */
export const buildChapters = async (
  comicName: string,
  hiddenType: HiddenType,
) => {
  const data = await getChapters(comicName);
  log(data);
  const {
    build: { type },
    groups,
  } = data;

  const Group: Component<ChaptersGroup> = (props) => {
    const chapters: Record<number, ChaptersGroup['chapters']> =
      Object.fromEntries(type.map(({ id }) => [id, []]));
    for (const chapter of props.chapters) chapters[chapter.type].push(chapter);

    return (
      <Switch>
        <Match when={hiddenType === 'mobile'}>
          {(() => {
            // 删掉占位置的分隔线
            for (const dom of querySelectorAll('.van-divider')) dom.remove();
            return (
              <div class="detailsTextContentTabs van-tabs van-tabs--line">
                <For each={type}>
                  {({ id, name }) => (
                    <Show when={chapters[id].length}>
                      <div class="van-tabs__wrap">
                        <div
                          role="tablist"
                          class="van-tabs__nav van-tabs__nav--line"
                          style={{ background: 'transparent' }}
                        >
                          <div role="tab" class="van-tab van-tab--active">
                            <span class="van-tab__text van-tab__text--ellipsis">
                              <span>{name}</span>
                            </span>
                          </div>
                          <div
                            class="van-tabs__line"
                            style={{
                              width: '0.24rem',
                              transform: 'translateX(187.5px) translateX(-50%)',
                              'transition-duration': '0.3s',
                            }}
                          />
                        </div>
                      </div>
                      <div class="van-tab__pane">
                        <div
                          class="chapterList van-grid"
                          style={{ 'padding-left': '0.24rem' }}
                        >
                          <For each={chapters[id]}>
                            {(chapter) => (
                              <div
                                class="chapterItem oneLines van-grid-item"
                                classList={{
                                  red: props.last_chapter.uuid === chapter.id,
                                }}
                                style={{
                                  'flex-basis': '25%',
                                  'padding-right': '0.24rem',
                                  'margin-top': '0.24rem',
                                }}
                              >
                                <a
                                  class="van-grid-item__content van-grid-item__content--center"
                                  href={`/comic/${comicName}/chapter/${chapter.id}`}
                                >
                                  <span
                                    class="van-grid-item__text"
                                    children={chapter.name}
                                  />
                                </a>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  )}
                </For>
              </div>
            );
          })()}
        </Match>

        <Match when={hiddenType === 'web'}>
          <>
            <span>{props.name}</span>
            <div class="table-default">
              <div class="table-default-title">
                <ul class="nav nav-tabs" role="tablist">
                  <For each={type}>
                    {({ id, name }) => (
                      <li class="nav-item">
                        <a
                          class="nav-link"
                          classList={{ disabled: chapters[id].length === 0 }}
                          data-toggle="tab"
                          href={`#${props.path_word}${name}`}
                          role="tab"
                          aria-selected="false"
                          children={name}
                        />
                      </li>
                    )}
                  </For>
                </ul>
                <div class="table-default-right">
                  <span>更新內容：</span>
                  <a
                    href={`/comic/${comicName}/chapter/${props.last_chapter.comic_id}`}
                    target="_blank"
                    children={props.last_chapter.name}
                  />
                  <span>更新時間：</span>
                  <span>{props.last_chapter.datetime_created}</span>
                </div>
              </div>

              <div class="table-default-box">
                <div class="tab-content">
                  <For each={type}>
                    {({ id, name }) => (
                      <div
                        id={`${props.path_word}${name}`}
                        role="tabpanel"
                        class="tab-pane fade"
                      >
                        <ul>
                          <For each={chapters[id]}>
                            {(chapter) => (
                              <a
                                href={`/comic/${comicName}/chapter/${chapter.id}`}
                                target="_blank"
                                title={chapter.name}
                                style={{ display: 'block' }}
                              >
                                <li>{chapter.name}</li>
                              </a>
                            )}
                          </For>
                        </ul>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </>
        </Match>

        <Match when={true}>
          <For each={type}>
            {({ id, name }) => (
              <Show when={chapters[id].length}>
                <div
                  class="card"
                  style={{ 'max-width': '100em', margin: '1em auto' }}
                >
                  <div class="card-body">
                    <h2 class="card-title">{name}</h2>

                    <ul>
                      <For each={chapters[id]}>
                        {(chapter) => (
                          <a
                            class="btn btn-outline-primary"
                            classList={{
                              active: props.last_chapter.uuid === chapter.id,
                            }}
                            href={`/comic/${comicName}/chapter/${chapter.id}`}
                            children={chapter.name}
                          />
                        )}
                      </For>
                    </ul>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </Match>
      </Switch>
    );
  };

  let root: HTMLElement;
  switch (hiddenType) {
    case 'mobile':
      root = querySelector('.detailsTextContent')!;
      // 自动点掉隐藏漫画的提示
      for (const element of querySelectorAll('button.van-dialog__confirm'))
        element.click();
      break;
    case 'web':
      root = querySelector('.upLoop')!;
      root.textContent = '';
      break;
    default:
      root = querySelector('main')!;
      root.textContent = '';

      css`
        ul .btn {
          width: fit-content;
          height: fit-content;
          margin: 1em;
        }
      `;
      break;
  }

  render(() => <For each={Object.values(groups)} children={Group} />, root);

  // 点击每个分组下第一个激活的标签
  for (const group of querySelectorAll('.upLoop .table-default-title'))
    group.querySelector<HTMLElement>('.nav-link:not(.disabled)')?.click();
};
