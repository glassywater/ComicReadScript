import { request, setupSiteAdapter } from 'core';
import {
  createEffectOn,
  domParse,
  querySelector,
  querySelectorAll,
  querySelectorClick,
  waitDom,
} from 'helper';
import { useMultiSelectLoad } from 'userscript/multiSelect';

const kemonoOptions = {
  autoShow: false,
  defaultOption: { pageNum: 1 },
  /** 加载原图 */
  load_original_image: true,
  /** 按文件名重排缩略图 */
  sort_by_filename: true,
};
type KemonoOptions = typeof kemonoOptions;

type KemonoPageContext =
  | { type: 'manga'; id: string }
  | { type: 'list'; id: string; offset: number };

const fileNameOf = (a: HTMLAnchorElement | null) => {
  if (!a) return '';
  const name =
    a.getAttribute('download') ?? new URL(a.href).searchParams.get('f');
  return name ? decodeURIComponent(name) : '';
};

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** 对元素列表按文件名自然排序，返回排序后的新数组 */
const sortByFileName = <T extends Element>(
  items: T[],
  getFileName: (el: T) => string,
) => {
  if (items.length < 2) return items;
  // 用 WeakMap 缓存文件名，排序时直接查表，避免比较器重复解析
  const names = new WeakMap<T, string>();
  for (const e of items) names.set(e, getFileName(e));
  return items.toSorted((a, b) => naturalCompare(names.get(a)!, names.get(b)!));
};

const getThumbs = (root: ParentNode, sort: boolean) => {
  const items = [
    ...root.querySelectorAll<HTMLAnchorElement>('.post__thumbnail a'),
  ];
  if (!sort) return items;
  return sortByFileName(items, fileNameOf);
};

const original = (root: ParentNode = document, sort = false) =>
  getThumbs(root, sort).map((e) => e.href);
const thumbnail = (root: ParentNode = document, sort = false) =>
  getThumbs(root, sort).map(
    (e) => e.querySelector<HTMLImageElement>('img')!.src,
  );

const handlePwa = () => {
  const zipExtension = new Set(['zip', 'rar', '7z', 'cbz', 'cbr', 'cb7']);
  for (const e of querySelectorAll<HTMLAnchorElement>('.post__attachment a')) {
    if (!zipExtension.has(e.href.split('.').pop()!)) continue;
    const a = document.createElement('a');
    a.href = `https://comic-read.pages.dev/?url=${encodeURIComponent(e.href)}`;
    a.textContent = e.textContent.replace('Download ', 'ComicReadPWA - ');
    a.className = e.className;
    a.style.opacity = '.6';
    e.parentNode!.insertBefore(a, e.nextElementSibling);
  }
};

setupSiteAdapter<KemonoPageContext, KemonoOptions>({
  name: 'kemono',
  options: {
    autoShow: false,
    defaultOption: { pageNum: 1 },
    /** 加载原图 */
    load_original_image: true,
    /** 站点图片顺序错乱，按文件名重排缩略图 */
    sort_by_filename: true,
  },
  getPageContext: () => {
    const { listId, postId } =
      /\/user\/(?<listId>[^/]+)(?:\/post\/(?<postId>[^/]+))?/u.exec(
        location.pathname,
      )?.groups ?? {};

    if (postId) return { type: 'manga', id: postId } as const;

    if (listId) {
      const offset = Number(new URLSearchParams(location.search).get('o')) || 0;
      // 传递 offset 是为了在翻页时能被判定为页面改变
      return { type: 'list', id: listId, offset } as const;
    }
  },

  handlers: {
    manga: async ({ store, setState, showComic }) => {
      await waitDom('.post__thumbnail');
      handlePwa();

      createEffectOn(
        () => store.options.load_original_image,
        (isOriginal, prev) => {
          setState('nowComic', isOriginal ? 'original' : 'thumbnail');
          if (prev) void showComic();
        },
      );

      setState((state) => {
        state.comicMap.original = {
          getImgList: () => original(document, store.options.sort_by_filename),
        };
        state.comicMap.thumbnail = {
          getImgList: () => thumbnail(document, store.options.sort_by_filename),
        };
        state.manga.onNext = querySelectorClick('.post__nav-link.next');
        state.manga.onPrev = querySelectorClick('.post__nav-link.prev');
      });
    },
    list: async (coreCtx, { id }) => {
      const ms = await useMultiSelectLoad(coreCtx, {
        id,
        onStart: () => {
          for (const item of querySelectorAll('.post-card'))
            item.style.position = 'relative';
        },
        getImgList: async (postId) => {
          const res = await request(`${location.pathname}/post/${postId}`);
          const doc = domParse(res.responseText);
          return coreCtx.options.load_original_image
            ? original(doc, coreCtx.options.sort_by_filename)
            : thumbnail(doc, coreCtx.options.sort_by_filename);
        },
      });

      await ms.registerItems(id, async (map) => {
        for (const dom of await waitDom('.post-card', 20))
          map.set(dom, dom.dataset.id!);
      });

      return ms.createCleanup(id);
    },
  },

  features: {
    sort_by_filename: () => {
      const container = querySelector('.post__files');
      if (!container) return;
      for (const el of sortByFileName(
        [...container.querySelectorAll('.post__thumbnail')],
        (el) => fileNameOf(el.querySelector('a')),
      ))
        container.append(el);
    },
  },
});
