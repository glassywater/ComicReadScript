import { setup } from 'core';
import { querySelectorClick } from 'helper';

(() => {
  type Page = { url: string; width: number; height: number };
  const pages: Page[] = unsafeWindow.args.pages;
  if (!pages?.length) return;

  const getImgUrl = (url: string) =>
    new Promise<string>((resolve) => {
      unsafeWindow.ImageLoader.getInstance(
        unsafeWindow.jQuery,
        window,
      ).loadImage(url, (img: string) => resolve(img));
    });

  setup({
    name: 'nico',
    getImgList: ({ dynamicLazyLoad }) =>
      dynamicLazyLoad({
        loadImg: async (i) => {
          const { url, width, height } = pages[i];
          return { src: await getImgUrl(url), width, height };
        },
        length: pages.length,
      }),
    onPrev: () =>
      querySelectorClick('#full_episode_control_bar .prev a:not(.disabled)'),
    onNext: () =>
      querySelectorClick('#full_episode_control_bar .next a:not(.disabled)'),
  });
})();
