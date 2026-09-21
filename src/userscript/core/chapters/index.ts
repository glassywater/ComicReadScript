import { toast } from 'components/Toast';
import { isEqual, log, sleep, t } from 'helper';

import { addShowImgsListener } from '../showImgsChange';
import {
  type Chapter,
  type ChapterId,
  type ChapterImgListLoader,
  type CoreContext,
  type InitChaptersOptions,
} from '../types';
import {
  handleUrlNavigation,
  loadChapterImgList,
  loadComments,
  registerChapter,
  updateChapterNav,
} from './actions';
import { injectChapterButton, injectChapterStyles } from './panel';
import { chapterPrefetcher } from './prefetch';
import {
  type ChapterManager,
  getChapterManager,
  setChapterManager,
} from './state';

export { findChapterByUrl, switchChapter } from './actions';
export { getChapterManager } from './state';

/** 等待当前章节（临时条目）加载完成的超时时间 */
const TRANSFER_TIMEOUT = 10 * 1000;

/** 章节数据 */
type ChaptersOptions = {
  comicId: string;
  chapterList: Chapter[];
  currentId: ChapterId;
  getChapterImgList: ChapterImgListLoader;
  getComments?: InitChaptersOptions['getComments'];
};

/** 章节目录缓存，key 为 store.comicId（漫画唯一标识） */
const chapterListCache = new Map<string, Chapter[]>();

/** popstate 监听的注销函数 */
let stopUrlNavListener: (() => void) | undefined;

/** 确保接管用户前进/后退的 popstate 监听已注册，返回清理函数 */
const ensureUrlNavListener = () => {
  if (!stopUrlNavListener) {
    const onPopState = () => handleUrlNavigation(location.href);
    window.addEventListener('popstate', onPopState);
    stopUrlNavListener = () =>
      window.removeEventListener('popstate', onPopState);
  }
  return () => {
    stopUrlNavListener?.();
    stopUrlNavListener = undefined;
  };
};

/** 进入章节模式并注册相关监听器，返回退出章节模式并注销监听器的清理函数 */
const enterChapterMode = (manager: ChapterManager) => {
  manager.coreCtx.setState('flag', 'isChapterMode', true);
  const stopPrefetcher = addShowImgsListener(chapterPrefetcher.setup(manager));
  const stopUrlNav = ensureUrlNavListener();
  return () => {
    stopPrefetcher();
    stopUrlNav();
    manager.coreCtx.setState('flag', 'isChapterMode', false);
  };
};

/**
 * 退出章节模式并清空所有章节相关状态
 *
 * 在「确定不再处于章节模式」时调用，
 * 同漫画章节间切换走复用/重建逻辑，不调用此函数，以便保留缓存。
 *
 * 监听器的注销由 setupChapters 的收尾函数负责，
 * onUrlChange 的串行队列保证调用时机在其之后。
 */
export const exitChapterMode = () => {
  const manager = getChapterManager();
  if (!manager) return;

  setChapterManager(undefined);

  // 清空残留的章节相关状态
  manager.coreCtx.setState((state) => {
    state.currentImgListId = '';
    state.manga.title = '';
    state.manga.onPrev = undefined;
    state.manga.onNext = undefined;
    state.manga.editButtonList = undefined;
  });
};

/**
 * SPA 重入且章节列表与现有完全一致时，复用现有管理器；
 * 否则返回 undefined，由后续流程创建新管理器
 */
const reuseManager = (
  nowManager: ChapterManager | undefined,
  options: ChaptersOptions,
): (() => void) | undefined => {
  if (!nowManager) return;
  const {
    chapterList,
    coreCtx: {
      store: { imgListMap },
    },
    registrations,
    key,
  } = nowManager;

  // 章节列表与现有完全一致
  if (!isEqual(chapterList, options.chapterList)) return;
  // 各章节在 imgListMap 中注册的 getList 仍是管理器登记的加载函数，未被重置
  if (
    !chapterList.every(
      (chapter) =>
        imgListMap[key(chapter.id)]?.getImgList ===
        registrations.get(chapter.id),
    )
  )
    return;

  nowManager.getChapterImgList = options.getChapterImgList;
  nowManager.getComments = options.getComments;
  void loadComments(nowManager, options.currentId);
  return enterChapterMode(nowManager);
};

/** 创建章节管理器并注册全部章节（会替换现有管理器） */
const createManager = (coreCtx: CoreContext, options: ChaptersOptions) => {
  const manager: ChapterManager = {
    coreCtx,
    comicId: options.comicId,
    key: (id) => `${options.comicId}:${id}`,
    chapterList: [...options.chapterList],
    getChapterImgList: options.getChapterImgList,
    getComments: options.getComments,
    cache: new Map(),
    registrations: new Map(),
  };
  setChapterManager(manager);
  for (const chapter of manager.chapterList) registerChapter(manager, chapter);
  return manager;
};

/**
 * 激活章节模式：先接管导航和目录，再等待当前章节数据就绪后才切换显示状态，
 * 避免加载失败后阅读器内容与标题脱节。加载失败且阅读器正在显示其他内容时
 * 不切换显示状态，用户仍可通过 popstate、目录按钮重试。返回收尾函数。
 *
 * @param oldManager 被替换的旧管理器，切换成功后清理其章节数据
 */
const activateManager = (
  manager: ChapterManager,
  chapter: Chapter | undefined,
  oldManager?: ChapterManager,
): (() => void) => {
  const {
    coreCtx: { setState, store },
    key,
  } = manager;
  const currentId = chapter?.id ?? '';

  let cancelled = false;
  const stopChapterMode = enterChapterMode(manager);

  void (async () => {
    // 当前章节还没有数据时先加载
    if (chapter && !store.imgListMap[key(chapter.id)]?.imgList?.length) {
      try {
        await loadChapterImgList(manager, chapter.id);
      } catch (error) {
        log.error(error);
        // 已被取消或管理器被替换时不提醒
        if (!cancelled && getChapterManager() === manager)
          toast.error((error as Error).message);
        // 阅读器正在显示其他内容时保持现状，避免内容与标题脱节；
        // 未打开时切状态无可见影响，仍激活以保留 autoShow 轮询的重试通道
        if (store.manga.show) return;
      }
    }
    if (cancelled || getChapterManager() !== manager) return;

    setState((state) => {
      state.currentImgListId = chapter ? key(chapter.id) : '';
      state.manga.title = chapter?.title ?? '';
      updateChapterNav(state.manga, manager, currentId);
      // 换漫画时清理旧管理器的章节数据
      if (oldManager) {
        const deleteKeys = oldManager.chapterList
          .map(({ id }) => oldManager.key(id))
          .filter((entryKey) => Reflect.has(state.imgListMap, entryKey));
        for (const entryKey of deleteKeys) delete state.imgListMap[entryKey];
      }
    });

    if (chapter) {
      injectChapterButton(manager);
      // 阅读器没有打开时要主动加载打开
      if (
        store.flag.needAutoShow &&
        store.options.autoShow &&
        !store.manga.show
      )
        void manager.coreCtx.showComic();
    }
    void loadComments(manager, currentId);
  })();

  return () => {
    cancelled = true;
    stopChapterMode();
  };
};

/**
 * 转移场景：站点先设置 imgListMap[''] 让当前章节立即开始加载，拿到完整章节
 * 列表后才调用 setupChapters。此时等待当前章节加载完成，再把结果无感转移到
 * 正式章节条目上（引用相同，切换 currentImgListId 不会触发阅读器重置）
 */
const transferToChapters = (
  coreCtx: CoreContext,
  options: ChaptersOptions,
  currentChapter: Chapter,
): (() => void) => {
  const currentId = currentChapter.id;

  const manager = createManager(coreCtx, options);
  const { store, setState } = manager.coreCtx;

  let cancelled = false;
  // 真正的清理函数要等转移落地后才存在，通过局部变量延迟绑定
  let exit: () => void = () => {};
  const cleanup = () => {
    cancelled = true;
    exit();
  };

  // 落地前不启用目录按钮、上/下一话和 popstate 接管，避免转移被中途切换打断
  void (async () => {
    const deadline = Date.now() + TRANSFER_TIMEOUT;
    let { imgList } = store.imgListMap[''];
    while (!imgList?.length && Date.now() < deadline) {
      // 等待期间页面已切换或被取消，放弃转移
      if (cancelled || getChapterManager() !== manager) return;
      await sleep(100);
      ({ imgList } = store.imgListMap['']);
    }
    // 等待期间当前章节切换到了其他章节，放弃转移
    if (
      cancelled ||
      getChapterManager() !== manager ||
      store.currentImgListId !== ''
    )
      return;

    if (imgList?.length) {
      // 预写缓存，避免之后重新进入本章时重复请求
      manager.cache.set(currentId, Promise.resolve(imgList));
      setState('imgListMap', manager.key(currentId), { imgList });
    }

    exit = activateManager(manager, currentChapter);
  })();

  return cleanup;
};

/**
 * 设置章节模式，返回本次章节模式的收尾函数。
 *
 * 不再需要当次章节数据时（如切换到其他漫画、离开漫画页）必须调用收尾函数：
 * - 章节模式已激活时调用将退出章节模式并注销相关监听器；
 * - 尚未激活（章节列表未就绪，或数据转移未完成）是调用将让本次章节模式作废。
 */
export const setupChapters = <Id extends ChapterId = ChapterId>(
  coreCtx: CoreContext,
  options: InitChaptersOptions<Id>,
) => {
  // 章节模式的阅读进度和目录缓存都以漫画 id 为准，缺失时无法正确工作
  const { comicId } = coreCtx.store;
  if (!comicId) {
    log.error(new Error('缺少漫画 id，无法进入章节模式'));
    // 无法进入章节模式时清掉上一个漫画残留的章节状态
    exitChapterMode();
    return () => {};
  }

  // '' 条目可能残留上一个页面的图片，需要清理一下，
  // 确保只会转移本次进入后由当前 loader 加载的数据
  if (coreCtx.store.imgListMap[''].imgList)
    coreCtx.setState('imgListMap', '', 'imgList', undefined);

  requestAnimationFrame(injectChapterStyles);

  /** 数据加载完成并激活后才绑定的清理函数 */
  let exit: () => void = () => {};
  let cancelled = false;

  void (async () => {
    try {
      let chapterList = chapterListCache.get(comicId);
      if (!chapterList) {
        chapterList = await options.getChapterList();
        // 失败抛错，不写入缓存，等下次重试
        if (chapterList.length === 0) {
          log.error(new Error(t('alert.fetch_chapter_list_failed')));
          throw new Error(t('alert.fetch_chapter_list_failed'));
        }
        chapterListCache.set(comicId, chapterList);
      }
      if (cancelled) return;
      exit = initChapters(coreCtx, {
        comicId,
        chapterList,
        currentId: options.currentId,
        getChapterImgList: options.getChapterImgList as ChapterImgListLoader,
        getComments: options.getComments as ChaptersOptions['getComments'],
      });
    } catch (error) {
      if (cancelled) return;
      toast.error((error as Error).message);
      log.error(error);
    }
  })();

  return () => {
    cancelled = true;
    exit();
  };
};

/** 目录数据就绪后，复用或创建管理器并激活章节模式，返回清理函数 */
const initChapters = (
  coreCtx: CoreContext,
  options: ChaptersOptions,
): (() => void) => {
  const nowManager = getChapterManager();
  const reused = reuseManager(nowManager, options);
  if (reused) return reused;

  const { store } = coreCtx;

  // currentId 不在章节列表中时回退到第一个章节，避免 currentImgListId 指向未注册的章节
  const currentChapter =
    options.chapterList.find((chapter) => chapter.id === options.currentId) ??
    options.chapterList[0];

  /** 实际生效的当前章节 id */
  const currentId = currentChapter?.id ?? '';

  // 站点先用 imgListMap[''] 加载当前章节、拿到完整列表后才调用时，走无感转移
  if (
    currentId !== '' &&
    store.currentImgListId === '' &&
    store.imgListMap[''].getImgList?.type === undefined &&
    // 已有其他漫画的 manager 时，'' 上的数据必然是上个页面残留的
    (!nowManager || nowManager.comicId === options.comicId)
  ) {
    return transferToChapters(coreCtx, options, currentChapter);
  }

  // 换漫画时旧管理器的章节数据由 activateManager 在加载成功后清理
  return activateManager(
    createManager(coreCtx, options),
    currentChapter,
    nowManager,
  );
};
