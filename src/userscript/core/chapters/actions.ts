import { type MangaProps } from 'components/Manga';
import { toast } from 'components/Toast';
import { claimUrlChange, log, t } from 'helper';

import { type Chapter, type ChapterId } from '../types';
import { type ChapterManager, getChapterManager } from './state';

/** 加载指定章节评论 */
export const loadComments = async (
  manager: ChapterManager,
  chapterId: ChapterId,
) => {
  const {
    getComments,
    key,
    coreCtx: { store, setState },
  } = manager;
  if (!getComments || store.imgListMap[key(chapterId)]?.commentList) return;

  try {
    const commentList = await getComments(chapterId);
    const entryKey = key(chapterId);
    if (!Reflect.has(store.imgListMap, entryKey)) return;
    setState('imgListMap', entryKey, { commentList });
  } catch (error) {
    log.error(error);
  }
};

/** 加载并缓存指定章节的图片列表 */
export const loadChapterImgList = (
  manager: ChapterManager,
  chapterId: ChapterId,
) => {
  const { cache, coreCtx, key, getChapterImgList } = manager;
  const cached = cache.get(chapterId);
  if (cached) return cached;

  const promise = (async () => {
    const imgList = await getChapterImgList(chapterId, coreCtx);
    if (imgList.length === 0)
      throw new Error(t('alert.fetch_comic_img_failed'));
    // 管理器已被新漫画替换时，不写入过期的章节数据
    if (getChapterManager() !== manager) return imgList;
    coreCtx.setState('imgListMap', key(chapterId), { imgList });
    return imgList;
  })();

  const safePromise = promise.catch((error) => {
    cache.delete(chapterId);
    throw error;
  });
  cache.set(chapterId, safePromise);
  return safePromise;
};

/** 将章节注册到 imgListMap 中 */
export const registerChapter = (manager: ChapterManager, chapter: Chapter) => {
  const { registrations, coreCtx, key } = manager;
  let getImgList = registrations.get(chapter.id);
  if (!getImgList) {
    getImgList = () => loadChapterImgList(manager, chapter.id);
    registrations.set(chapter.id, getImgList);
  }

  coreCtx.setState('imgListMap', key(chapter.id), { getImgList });
};

/** 更新上下话按钮 */
export const updateChapterNav = (
  state: MangaProps,
  manager: ChapterManager,
  chapterId: ChapterId,
) => {
  const index = manager.chapterList.findIndex(
    (chapter) => chapter.id === chapterId,
  );
  const maxIndex = manager.chapterList.length - 1;

  state.onPrev =
    index > 0
      ? () => void switchChapter(manager.chapterList[index - 1].id)
      : undefined;
  state.onNext =
    index !== -1 && index < maxIndex
      ? () => void switchChapter(manager.chapterList[index + 1].id)
      : undefined;
};

/** 切章序号，连续快速切章（如连续后退）时只让最后一次生效，防止慢请求覆盖新状态 */
let switchSeq = 0;

/** 切换章节 */
export const switchChapter = async (
  chapterId: ChapterId,
  /**
   * 是否同时修改 url
   *
   * 用户前进/后退触发的切章 url 已变化，无需再改
   */
  updateUrl = true,
) => {
  const manager = getChapterManager();
  if (!manager) return;
  const {
    chapterList,
    coreCtx: { store, setState, showComic },
    key,
  } = manager;

  const index = chapterList.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) return;

  const chapter = chapterList[index];
  const seq = ++switchSeq;

  if (!store.imgListMap[key(chapterId)]?.imgList?.length) {
    try {
      await loadChapterImgList(manager, chapterId);
    } catch (error) {
      log.error(error);
      // 已被新章切换取代或漫画变了时不提醒
      if (getChapterManager() === manager && seq === switchSeq)
        toast.error((error as Error).message);
      return;
    }
  }

  if (getChapterManager() !== manager || seq !== switchSeq) return;

  if (updateUrl && chapter.url) {
    try {
      history.pushState(null, '', chapter.url);
      // 标记为脚本接管，避免 onUrlChange 把切章当成页面变化重新初始化
      claimUrlChange(chapter.url);
    } catch (error) {
      // url 无效时仅记录错误，不影响章节切换
      log.error(error);
    }
  }
  setState((state) => {
    state.manga.title = chapter.title;
    updateChapterNav(state.manga, manager, chapterId);
  });
  await showComic(key(chapterId));
  void loadComments(manager, chapterId);
};

/** 规范化 url 便于比较，无效时返回 null */
const normalizeUrl = (url: string) => {
  try {
    return new URL(url, location.origin).href;
  } catch {
    return null;
  }
};

/** 根据 url 查找对应章节，找不到时返回 undefined */
export const findChapterByUrl = (
  { chapterList }: ChapterManager,
  url: string,
) => {
  const targetUrl = normalizeUrl(url);
  if (!targetUrl) return;

  return chapterList.find(
    (chapter) => chapter.url && normalizeUrl(chapter.url) === targetUrl,
  );
};

/** 接管用户触发的前进/后退 */
export const handleUrlNavigation = (url: string) => {
  const manager = getChapterManager();
  if (!manager) return;
  const chapter = findChapterByUrl(manager, url);
  if (!chapter) return;

  // switchChapter 会强制打开阅读器，
  // 避免用户连续切多个章节后关闭阅读器按后退时，
  // 连按多次后退都不会有反应，导致用户困惑
  void switchChapter(chapter.id, false);
};
