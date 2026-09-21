import {
  exposeToGlobal,
  isEqual,
  log,
  onUrlChange,
  requestIdleCallback,
  sleep,
  wait,
  waitUrlChange,
} from 'helper';
import { type Promisable } from 'type-fest';

import {
  exitChapterMode,
  findChapterByUrl,
  getChapterManager,
  switchChapter,
} from '../chapters';
import { type CoreContext } from '../types';
import { useInit } from '../useInit';

/** 用于适配 SPA 站点的页面上下文类型 */
export type SpaPageContext = {
  type: string;
  /** 漫画的唯一标识符。提供此字段后才会启用阅读进度、章节模式等功能 */
  id?: string | null;
  /**
   * 当站点有多个不同 type 的页面都是漫画页时，需要显式设为 true 来标识，
   * 否则只会把 type === 'manga' 的页面当作漫画页
   */
  isManga?: boolean;
} & Record<string, unknown>;

export type CleanupFn<PageContext> = (
  nextPageCtx?: PageContext,
) => Promisable<void>;

export type PageHandler<
  PageContext extends SpaPageContext = SpaPageContext,
  Options extends Record<string, unknown> = Record<string, unknown>,
> = (
  coreCtx: CoreContext<Options>,
  pageCtx: PageContext,
) => Promisable<void | CleanupFn<PageContext>>;

export type SpaInitOptions<
  PageContext extends SpaPageContext = SpaPageContext,
  Options extends Record<string, unknown> = Record<string, unknown>,
> = {
  name: string;
  options?: Partial<Options>;
  /**
   * 获取当前页面的上下文信息
   *
   * 返回的对象中，type 字段用于匹配对应的 handler，其值变化将触发重新初始化。
   * 对于同一类型下的不同页面实例（如不同画廊、不同章节），
   * 需通过添加自定义标识字段（如 galleryId、chapterId 等）来区分。
   */
  getPageContext: (
    lastPageCtx?: PageContext,
  ) => Promisable<PageContext | undefined>;
  /** 根据 PageContext 自动调用匹配的 handler */
  handlers: {
    /** 在匹配到的 handler 执行前调用，用于放置在所有页面上都要执行的逻辑 */
    all?: (
      coreCtx: CoreContext<Options>,
      pageCtx: PageContext | undefined,
    ) => Promisable<void | CleanupFn<PageContext>>;
  } & {
    [K in PageContext['type']]?: (
      coreCtx: CoreContext<Options>,
      pageCtx: Extract<PageContext, { type: K }>,
    ) => Promisable<void | CleanupFn<PageContext>>;
  };
  /**
   * 类似 handlers.all，但只会在对应的 options 启用时执行
   *
   * 在匹配的 handlers 执行前调用
   *
   * 如果没有使用 `pageCtx` 参数，会在所有页面执行
   */
  features?: {
    [FeatureName in keyof Options]?: PageHandler<PageContext, Options>;
  };
};

export const setupSiteAdapter = async <
  PageContext extends SpaPageContext = SpaPageContext,
  Options extends Record<string, any> = Record<string, any>,
>({
  name,
  options: initOptions,
  getPageContext,
  handlers,
  features,
}: SpaInitOptions<PageContext, Options>) => {
  let pageCtx: PageContext | undefined;
  const cleanupFns: CleanupFn<PageContext>[] = [];

  // 没有 handlers.all 时，等到进入可识别页面再继续
  pageCtx = handlers.all
    ? await getPageContext(pageCtx)
    : await waitUrlChange(() => getPageContext(pageCtx));
  if (isDevMode) exposeToGlobal({ pageCtx });

  const coreCtx = await useInit(name, initOptions);
  const { store, setState, showComic, loadComic, init, options } = coreCtx;

  const processPageContext = async (
    newPageCtx: PageContext | undefined,
    force = false,
  ) => {
    if (!force && isEqual(pageCtx, newPageCtx)) return;

    const wasMangaPage = pageCtx?.isManga ?? pageCtx?.type === 'manga';

    for (const cleanup of cleanupFns) await cleanup(newPageCtx);
    cleanupFns.length = 0;
    pageCtx = newPageCtx;
    const isMangePage = newPageCtx?.isManga ?? newPageCtx?.type === 'manga';

    // 在漫画页间切换时不退出阅读模式，避免闪烁
    const keepShow = wasMangaPage && isMangePage && store.manga.show;

    // 页面类型变化时章节模式必然不再有效，需要清掉残留状态
    if (!keepShow) exitChapterMode();

    setState((state) => {
      state.flag.hasPageHandler =
        Boolean(newPageCtx?.type) && Reflect.has(handlers, newPageCtx!.type);
      if (!keepShow) {
        state.manga.show = false;
        // 页面类型切换时重置 imgListMap，触发响应式更新
        state.imgListMap = {
          '': {
            getImgList: Object.assign(() => [], { type: 'init' as const }),
          },
        };
      }
      state.comicId = (isMangePage && newPageCtx?.id) || undefined;
    });

    // handlers.all 需要在所有页面运行，包括 pageCtx 为 undefined 的页面
    try {
      const allCleanup = await handlers.all?.(coreCtx, newPageCtx);
      if (allCleanup) cleanupFns.push(allCleanup);
    } catch (error) {
      // 站点适配代码的错误不应中断核心流程
      log.error(error);
    }

    if (features) {
      for (const [featureName, handler] of Object.entries(features)) {
        if (!options[featureName as keyof Options] || !handler) continue;
        // 接收 pageCtx 参数的 feature 依赖页面类型，在页面无法识别时跳过
        if (handler.length >= 2 && !newPageCtx) continue;
        // oxlint-disable-next-line no-loop-func
        requestIdleCallback(async () => {
          const cleanup = await handler(coreCtx, newPageCtx!);
          if (cleanup && pageCtx === newPageCtx) cleanupFns.push(cleanup);
        }, 1000);
      }
    }

    if (!newPageCtx) return;

    init(isMangePage);

    try {
      const handlerCleanup = await handlers[
        newPageCtx.type as PageContext['type']
      ]?.(
        coreCtx,
        newPageCtx as Extract<PageContext, { type: PageContext['type'] }>,
      );
      if (handlerCleanup) cleanupFns.push(handlerCleanup);
    } catch (error) {
      // 站点适配代码的错误不应中断核心流程
      log.error(error);
    }

    if (keepShow) {
      // 章节模式下站点自身导航切章时，由章节管理器接管，避免阅读器内容与 url 脱节
      const manager = getChapterManager();
      const chapter =
        manager &&
        store.flag.isChapterMode &&
        findChapterByUrl(manager, location.href);
      if (manager && chapter) {
        // 站点导航已修改 url，无需 switchChapter 再改
        if (manager.key(chapter.id) !== store.currentImgListId)
          await switchChapter(chapter.id, false);
        return;
      }

      // 章节切换时 imgListMap 中可能已有图片列表，无需重复加载
      if (store.imgListMap[store.currentImgListId]?.imgList) return;

      try {
        await loadComic();
      } catch {
        // 新章节图片加载失败时退出阅读模式
        setState('manga', 'show', false);
      }
      return;
    }

    if (!isMangePage || !store.options.autoShow) return;

    const lastImg = store.imgListMap[store.currentImgListId].imgList?.[0];
    const res = await wait(async () => {
      await sleep(200);
      // 占位符条目没有加载意义，等章节模式激活后再触发加载
      if (store.imgListMap[store.currentImgListId]?.getImgList?.type === 'init')
        return false;
      try {
        await loadComic();
        return (
          store.imgListMap[store.currentImgListId].imgList?.[0] !== lastImg
        );
      } catch (error) {
        log.error(error);
        return false;
      }
    }, 10 * 1000);
    if (res) await showComic();
  };

  onUrlChange(async (lastUrl) => {
    if (!lastUrl) return await processPageContext(pageCtx, true);
    await processPageContext(await getPageContext(pageCtx));
  });
};
