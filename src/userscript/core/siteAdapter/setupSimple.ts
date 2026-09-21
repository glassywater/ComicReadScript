import { type MangaProps } from 'components/Manga';
import { createEffectOn, waitDom } from 'helper';
import { type Promisable } from 'type-fest';
import { AutoImageScanner } from 'userscript/autoImageScanner';

import { type CoreContext } from '../types';
import { type SetupOptions } from './setup';
import { type CleanupFn, setupSiteAdapter } from './setupSiteAdapter';

export type SimpleSetupOptions<
  T extends Record<string, any> = Record<string, any>,
> = {
  name: string;
  /** 初始站点配置 */
  initOptions?: Partial<Record<string, any>>;
  isMangaPage?: SetupOptions<T>['isMangaPage'];
  onPrev?: SetupOptions<T>['onPrev'];
  onNext?: SetupOptions<T>['onNext'];
  onExit?: MangaProps['onExit'];
  /** 站点显式提供的首选 selector；缺失时直接使用启发式发现 */
  selector?: string;
  /** 是否按图片在页面中的垂直位置排序，否则将按 Dom 顺序排序 */
  sortImageByTop?: boolean;
};

/** 适配「将所有图片显示在一个页面上」的网站 */
export const setupSimple = async <
  T extends Record<string, any> = Record<string, any>,
>({
  name,
  initOptions,
  isMangaPage,
  onPrev,
  onNext,
  onExit,
  selector,
  sortImageByTop,
}: SimpleSetupOptions<T>) => {
  let scanner: AutoImageScanner;

  await setupSiteAdapter<T & { type: 'manga' }>({
    name,
    options: initOptions,
    getPageContext: async () => {
      if (isMangaPage) {
        const data = await isMangaPage();
        if (!data) return;
        return { type: 'manga', ...(data === true ? {} : data) } as {
          type: 'manga';
        } & T;
      }

      // 没有 isMangaPage 但传了 selector 时，用 selector 是否匹配到多个元素来判断漫画页
      if (selector && !(await waitDom(selector, 2, 1000))) return;

      return { type: 'manga' } as { type: 'manga' } & T;
    },
    handlers: {
      manga: ({ setState, store }) => {
        scanner ??= new AutoImageScanner({
          selector,
          sortImageByTop,
          onImgListChange: (imgList) => setState('imgListMap', '', { imgList }),
          onChapterSwitchChange: async ({ prev, next }) => {
            const customPrev = onPrev ? await onPrev() : undefined;
            const customNext = onNext ? await onNext() : undefined;
            setState('manga', {
              onPrev: customPrev ?? prev,
              onNext: customNext ?? next,
            });
          },
          shouldTriggerLazyLoad: () =>
            store.manga.show || store.manga.imgList.length === 0,
        });

        setState((state) => {
          state.imgListMap[''] = {
            getImgList: () => {
              scanner.start();
              void scanner.triggerLazyLoad();
              return scanner.waitFirstImage(10_000);
            },
          };
          state.manga.onExit = (isEnd?: boolean) => {
            onExit?.(isEnd);
            setState('manga', 'show', false);
          };
        });

        createEffectOn(
          () => store.manga.show,
          (show) => show && void scanner.triggerLazyLoad(),
        );

        return () => scanner.stop();
      },
    } as {
      manga: (
        coreCtx: CoreContext,
        pageCtx: T & { type: 'manga' },
      ) => Promisable<void | CleanupFn<T>>;
    },
  });
};
