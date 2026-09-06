import { type MangaProps } from 'components/Manga';
import { setup } from 'core';
import { fileType, querySelector, t } from 'helper';

(() => {
  const imgDom = querySelector<HTMLImageElement>(
    ':is(#thumbs_box, #thumbs_gallery_div, #append_thumbs, #ap_thumbs) img[data-src]',
  );
  if (!imgDom) return;
  const imgUrl = imgDom.dataset.src;
  if (!imgUrl || !unsafeWindow.g_th)
    throw new Error(t('site.changed_load_failed'));
  const baseUrl = imgUrl.replace(/\/\dt.[a-z]+$/u, '');

  setup({
    name: 'HentaiEnvy',
    getImgList() {
      const imgList: MangaProps['imgList'] = [];
      for (const [i, th] of Object.entries<string>(unsafeWindow.g_th)) {
        const [type, w, h] = th.split(',');
        imgList[Number(i) - 1] = {
          src: `${baseUrl}/${i}.${fileType[type]}`,
          width: Number(w),
          height: Number(h),
        };
      }
      return imgList;
    },
  });
})();
