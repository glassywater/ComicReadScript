import { log } from 'helper';

import { type ShowImgsListener } from '../showImgsChange';
import { type ChapterId } from '../types';
import { loadChapterImgList } from './actions';
import { type ChapterManager } from './state';

/** 距离章节开头/结尾多少页时预加载相邻章节 */
const NEAR_EDGE_PAGE_NUM = 3;

/** 章节预加载器 */
class ChapterPrefetcher {
  /** 已预加载过的章节 id */
  private readonly prefetched = new Set<ChapterId>();

  private preloadImg(url: string) {
    const img = new Image();
    // 与 Manga 内部一致使用相对协议，确保 url 一致以命中缓存
    img.src = url.replace(/^http:/u, '');
  }

  /** 预加载指定章节的图片 */
  private preloadChapter(manager: ChapterManager, chapterId: ChapterId) {
    if (this.prefetched.has(chapterId)) return;
    this.prefetched.add(chapterId);

    // 只预加载第一张图
    void loadChapterImgList(manager, chapterId)
      .then(([first]) => {
        const url = typeof first === 'string' ? first : first?.src;
        return url && this.preloadImg(url);
      })
      .catch((error) => log.error(error));
  }

  /** 设置接近章节开头/末尾时预加载相邻章节第一张图的回调 */
  setup(manager: ChapterManager): ShowImgsListener {
    // 在新建 manager 时重置预加载记录，避免跨漫画残留
    this.prefetched.clear();

    return ({ showRange, pageList }) => {
      if (pageList.length === 0) return;

      const { chapterList, coreCtx, key } = manager;
      const index = chapterList.findIndex(
        (chapter) => key(chapter.id) === coreCtx.store.currentImgListId,
      );

      // 接近末尾 → 预加载下一章
      if (showRange[1] >= pageList.length - NEAR_EDGE_PAGE_NUM) {
        const nextChapter = chapterList[index + 1];
        if (nextChapter) this.preloadChapter(manager, nextChapter.id);
      }

      // 接近开头 → 预加载上一章
      if (showRange[0] >= 0 && showRange[0] < NEAR_EDGE_PAGE_NUM) {
        const prevChapter = chapterList[index - 1];
        if (prevChapter) this.preloadChapter(manager, prevChapter.id);
      }
    };
  }
}

/** 全局单例章节预加载器 */
export const chapterPrefetcher = new ChapterPrefetcher();
