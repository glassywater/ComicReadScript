import { listenHotkey } from 'components/Manga';
import { request, setup } from 'core';
import { t } from 'helper';

(() => {
  if (/^\/\d+-/u.exec(location.pathname) === null) return;

  listenHotkey({
    scroll_right: () => unsafeWindow.nextImg(),
    scroll_left: () => unsafeWindow.backImg(),
  });

  setup({
    name: 'nude-moon',
    initOptions: {
      autoShow: false,
      defaultOption: { pageNum: 1 },
    },
    async getImgList() {
      if (unsafeWindow.images)
        return (unsafeWindow.images as HTMLImageElement[]).map((e) => e.src);

      const url = location.href.replace(
        /(?<slug>\/[^/-]+)(?<dash>-)/u,
        '$<slug>-online-',
      );
      const { response: html } = await request<string>(url);
      const imgList = Array.from(
        html.matchAll(/images\[\d+\]\.src = '(?<src>.+?)';/gu),
        ({ groups: { src } }) => `https://nude-moon.org${src}`,
      );
      if (imgList.length === 0) throw new Error(t('site.changed_load_failed'));
      return imgList;
    },
  });
})();
