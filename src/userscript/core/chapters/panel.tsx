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
import { createEffectOn, css, t } from 'helper';
import { type Component, For, Show, createSignal, onMount } from 'solid-js';

import { switchChapter } from './actions';
import { type ChapterManager, getChapterManager } from './state';

/** 注入目录面板所需的样式 */
export const injectChapterStyles = () => {
  if (!mangaRefs.root) return;

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

/** 目录面板 */
const ChapterPanel: Component<{ onClose: () => void }> = (props) => (
  <SettingPanelContainer>
    <div class="chapterPanelList">
      <For each={getChapterManager()?.chapterList ?? []}>
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
