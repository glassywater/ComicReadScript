import { setup } from 'core';
import { t } from 'helper';

(() => {
  const isMangaPage = () => /^\/(?:read|view)\/\d+/u.test(location.pathname);
  if (!isMangaPage()) return;

  // hentainexus 会将 `pageData` 数组通过 RC4 加密后由注入为全局变量
  // 元素类型为 `image`（单图）或 `spread`（左右双图）

  type ImagePageData = {
    label: string;
    /** 页面在地址栏 hash 中的标识，如 `001` */
    url_label: string;
    type: 'image';
    image_source?: string;
    image_avif?: string;
    image_fallback?: string;
  };

  type SpreadPageData = {
    label: string;
    url_label: string;
    type: 'spread';
    left_source?: string;
    left_avif?: string;
    left_fallback?: string;
    right_source?: string;
    right_avif?: string;
    right_fallback?: string;
  };

  const getImgList = () => {
    const data = unsafeWindow.pageData as
      | (ImagePageData | SpreadPageData)[]
      | undefined;
    if (!data) throw new Error(t('site.changed_load_failed'));
    const imgList: string[] = [];
    for (const item of data) {
      if (item.type === 'spread') {
        const left = item.left_avif ?? item.left_fallback ?? item.left_source;
        if (left) imgList.push(left);
        const right =
          item.right_avif ?? item.right_fallback ?? item.right_source;
        if (right) imgList.push(right);
      } else {
        const src = item.image_avif ?? item.image_fallback ?? item.image_source;
        if (src) imgList.push(src);
      }
    }
    if (imgList.length === 0) throw new Error(t('site.changed_load_failed'));
    return imgList;
  };

  setup({
    name: 'HentaiNexus',
    isMangaPage,
    getImgList,
    initOptions: { autoShow: false },
  });
})();
