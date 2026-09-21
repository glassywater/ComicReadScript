import { type MangaProps } from 'components/Manga';
import { log, wait } from 'helper';
import { type Promisable } from 'type-fest';

import { exitChapterMode, setupChapters } from '../chapters';
import { type Chapter, type ChapterId, type CoreContext } from '../types';
import { type CleanupFn, setupSiteAdapter } from './setupSiteAdapter';

type BaseSetupOptions<T extends Record<string, any>> = {
  name: string;
  /** 初始站点配置 */
  initOptions?: Partial<Record<string, any>>;

  /**
   * SpaInitOptions.getPageContext 的简化版，只用来判断漫画页
   *
   * 返回的对象会被当作 pageCtx，用来区分不同章节
   * （SPA 网站必须返回额外字段来区分）
   */
  isMangaPage?: () => Promisable<T | boolean | void>;

  onPrev?: () => Promisable<MangaProps['onPrev'] | undefined>;
  onNext?: () => Promisable<MangaProps['onNext'] | undefined>;
  onExit?: MangaProps['onExit'];

  // 给小众特殊需求留的接口
  handler?: (
    coreCtx: CoreContext,
    pageCtx: T & { type: 'manga' },
  ) => Promisable<void>;
};

export type SetupOptions<T extends Record<string, any> = Record<string, any>> =
  BaseSetupOptions<T> &
    (
      | {
          /** 单章模式：直接获取当前页面的图片列表 */
          getImgList: (
            coreCtx: CoreContext,
            pageCtx: T & { type: 'manga' },
          ) => Promisable<MangaProps['imgList']>;
          getChapterList?: undefined;
          getCurrentId?: undefined;
          getChapterImgList?: undefined;
        }
      | {
          /** 多章节模式：获取所有章节并按章节 id 加载图片 */
          getImgList?: undefined;
          getChapterList: () => Promisable<Chapter[]>;
          /** 返回当前所在章节的 id */
          getCurrentId: () => ChapterId;
          getChapterImgList: (
            chapterId: string | number,
            coreCtx: CoreContext,
          ) => Promisable<MangaProps['imgList']>;
        }
    );

/** 快速适配简单网站 */
export const setup = async <
  T extends Record<string, any> = Record<string, any>,
>({
  name,
  initOptions,
  isMangaPage,
  getImgList,
  getChapterList,
  getCurrentId,
  getChapterImgList,
  onPrev,
  onNext,
  onExit,
  handler: userHandler,
}: SetupOptions<T>) => {
  await setupSiteAdapter<T & { type: 'manga' }>({
    name,
    options: initOptions,
    getPageContext: async () => {
      const data = isMangaPage ? await isMangaPage() : {};
      if (!data) return;
      return { type: 'manga', ...(data === true ? {} : data) } as {
        type: 'manga';
      } & T;
    },
    handlers: {
      manga: async (coreCtx, pageCtx) => {
        const { setState } = coreCtx;

        setState((state) => {
          state.manga.onExit = (isEnd?: boolean) => {
            onExit?.(isEnd);
            setState('manga', 'show', false);
          };
        });

        const cleanup =
          getChapterList &&
          setupChapters(coreCtx, {
            getChapterList,
            getChapterImgList,
            currentId: getCurrentId(),
          });

        if (!getChapterList && getImgList) {
          // 单章模式下需要清掉可能残留的章节状态
          exitChapterMode();
          // 整体替换 '' 条目，避免残留
          setState((state) => {
            state.imgListMap[''] = {
              getImgList: (ctx) => getImgList(ctx, pageCtx),
            };
          });
        }

        try {
          await userHandler?.(coreCtx, pageCtx);
        } catch (error) {
          // 站点自定义逻辑的错误不应影响阅读器核心功能
          log.error(error);
        }

        // 章节模式下由 chapterManager 接管上下话切换
        if (cleanup) return cleanup;

        void (async () => {
          if (onPrev) {
            try {
              setState('manga', { onPrev: await wait(onPrev, 5000) });
            } catch (error) {
              log.error(error);
            }
          }
          if (onNext) {
            try {
              setState('manga', { onNext: await wait(onNext, 5000) });
            } catch (error) {
              log.error(error);
            }
          }
        })();
      },
    } as {
      manga: (
        coreCtx: CoreContext,
        pageCtx: T & { type: 'manga' },
      ) => Promisable<void | CleanupFn<T>>;
    },
  });
};
