import MdToc from '@material-design-icons/svg/round/toc.svg';
import { IconButton } from 'components/IconButton';
import {
  DownloadButton,
  SettingButton,
  SettingPanelContainer,
  isScrollMode,
  refs as mangaRefs,
  store as mangaStore,
  setState as setMangaState,
} from 'components/Manga';
import { ReactiveSet, createEffectOn, css, lang, t } from 'helper';
import { type Component, For, Show, createSignal, onMount } from 'solid-js';

import { switchChapter } from './actions';
import { type ChapterManager, getChapterManager } from './state';

/** 注入目录面板所需的样式 */
export const injectChapterStyles = () => {
  if (!mangaRefs.root) return;

  const listMaxWidth = lang() === 'zh' ? '12em' : '22em';

  css`
    ${mangaRefs.root}
    .chapterPanelPopper {
      pointer-events: unset !important;
      transform: none !important;
      height: 0 !important;
      padding: 0 !important;
    }

    .chapterPanelCloseCover {
      position: fixed;
      inset: 0;
    }

    .chapterPanelList {
      min-width: 10em;
      max-width: ${listMaxWidth};
      white-space: normal;
    }

    .chapterGroupHeader {
      cursor: pointer;

      position: sticky;
      z-index: 1;
      top: 0;

      display: block;

      box-sizing: border-box;
      width: 100%;
      padding: 0.6em 0.8em;
      border: 0;

      font-size: 0.9em;
      font-weight: 600;
      line-height: 1.4;
      color: var(--text);
      text-align: start;
      overflow-wrap: anywhere;

      background-color: var(--page-bg);
    }

    .chapterGroupHeader:hover {
      /* --hover-bg-color 是半透明色，直接作背景会透出底下的列表项，
         因此将其叠加在 --page-bg 之上合成不透明色 */
      background-image: linear-gradient(
        var(--hover-bg-color),
        var(--hover-bg-color)
      );
    }

    .chapterPanelItem {
      cursor: pointer;
      content-visibility: auto;
      contain-intrinsic-size: 2.5em;

      display: block;

      box-sizing: border-box;
      width: 100%;
      padding: 0.6em 0.8em;
      border: 0;

      font-size: 0.9em;
      line-height: 1.4;
      color: var(--text);
      text-align: start;
      overflow-wrap: anywhere;

      background: transparent;
    }

    .chapterPanelItem:hover {
      background-color: var(--hover-bg-color);
    }

    .chapterPanelItem[data-current] {
      color: var(--text-bg);
      background-color: var(--text);
    }
  `;
};

/** 已收起的分组下标集合。跨面板开闭保留，manager 替换（章节数据变更）时重置 */
const collapsedGroups = new ReactiveSet<number>();

/** 目录面板 */
const ChapterPanel: Component<{ onClose: () => void }> = (props) => (
  <SettingPanelContainer>
    <div class="chapterPanelList">
      <For each={getChapterManager()?.groupList ?? []}>
        {(group, i) => {
          const isCollapsed = () => collapsedGroups.has(i());
          const toggleCollapsed = () => {
            if (collapsedGroups.has(i())) collapsedGroups.delete(i());
            else collapsedGroups.add(i());
          };

          return (
            <>
              <button
                type="button"
                class="chapterGroupHeader"
                aria-expanded={!isCollapsed()}
                on:click={toggleCollapsed}
              >
                {`${group.title} (${group.chapters.length})`}
              </button>
              <Show when={!isCollapsed()}>
                <For each={group.chapters}>
                  {(chapter) => {
                    let ref!: HTMLButtonElement; // oxlint-disable-line no-unassigned-vars

                    const isCurrent = () => {
                      const manager = getChapterManager();
                      return (
                        manager?.key(chapter.id) ===
                        manager?.coreCtx.store.currentImgListId
                      );
                    };

                    onMount(() => {
                      if (!isCurrent()) return;
                      requestAnimationFrame(() =>
                        // oxlint-disable-next-line i18next/no-literal-string
                        ref?.scrollIntoView({ block: 'nearest' }),
                      );
                    });

                    return (
                      <button
                        ref={ref}
                        type="button"
                        class="chapterPanelItem"
                        data-current={isCurrent() ? '' : undefined}
                        on:click={() => {
                          if (!isCurrent()) void switchChapter(chapter.id);
                          props.onClose();
                        }}
                      >
                        {chapter.title}
                      </button>
                    );
                  }}
                </For>
              </Show>
            </>
          );
        }}
      </For>
    </div>
  </SettingPanelContainer>
);

/** 目录按钮 */
const ChapterListButton: Component = () => {
  const [showPanel, setShowPanel] = createSignal(false);

  const handleClick = () => {
    const newVal = !showPanel();
    setMangaState('show', 'toolbar', newVal);
    setShowPanel(newVal);
  };

  createEffectOn(
    () => mangaStore.show.toolbar,
    (showToolbar) => showToolbar || setShowPanel(false),
  );

  // 章节数据变更时重置分组的折叠状态
  createEffectOn(getChapterManager, () => collapsedGroups.clear());

  const Popper = (
    <Show when={showPanel()}>
      <ChapterPanel onClose={handleClick} />
      <div
        class="chapterPanelCloseCover"
        on:click={handleClick}
        onWheel={(e) => {
          if (isScrollMode()) mangaRefs.mangaBox.scrollBy({ top: e.deltaY });
        }}
        role="button"
        tabIndex={-1}
      />
    </Show>
  );

  return (
    <IconButton
      tip={t('button.chapter_list')}
      enabled={showPanel()}
      showTip={showPanel()}
      onClick={handleClick}
      popperClassName={showPanel() && 'chapterPanelPopper'}
      popper={showPanel() && Popper}
      children={<MdToc />}
    />
  );
};

/** 将目录按钮注入工具栏（放在下载按钮之后、设置按钮之前） */
export const injectChapterButton = (manager: ChapterManager) => {
  manager.coreCtx.setState('manga', {
    editButtonList(list) {
      const settingIndex = list.indexOf(SettingButton);
      const downloadIndex = list.indexOf(DownloadButton);
      let index = list.length;
      if (settingIndex !== -1) index = settingIndex;
      else if (downloadIndex !== -1) index = downloadIndex + 1;
      return list.toSpliced(index, 0, ChapterListButton);
    },
  });
};
