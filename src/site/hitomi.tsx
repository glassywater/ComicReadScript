import { setup } from 'core';
import { wait } from 'helper';

setup({
  name: 'Hitomi',
  isMangaPage: () =>
    wait(
      () =>
        (unsafeWindow.galleryinfo as object | undefined) &&
        Reflect.has(unsafeWindow.galleryinfo, 'files') &&
        unsafeWindow.galleryinfo.type !== 'anime',
      1000 * 5,
    ),
  getImgList: () =>
    (unsafeWindow.galleryinfo!.files as object[]).map(
      (img) =>
        unsafeWindow.url_from_url_from_hash(
          unsafeWindow.galleryinfo.id,
          img,
          'webp',
        ) as string,
    ),
  initOptions: {
    // 默认开启图像识别，避免图片 url 过期后还要刷新
    defaultOption: { imgRecognition: { enabled: true } },
  },
});
