import { setup, toast } from 'core';
import { querySelector, querySelectorAll, querySelectorClick, t } from 'helper';

(() => {
  if (!Reflect.has(unsafeWindow, 'MANGABZ_CID')) return;

  const imgNum: number =
    unsafeWindow.MANGABZ_IMAGE_COUNT ?? unsafeWindow.imgsLen;
  if (!(Number.isSafeInteger(imgNum) && imgNum > 0)) {
    toast.error(t('site.changed_load_failed'));
    return;
  }

  const getPageImg = async (i: number) => {
    const res = await unsafeWindow.$.ajax({
      type: 'GET',
      url: 'chapterimage.ashx',
      data: {
        cid: unsafeWindow.MANGABZ_CID,
        page: i,
        key: '',
        _cid: unsafeWindow.MANGABZ_CID,
        _mid: unsafeWindow.MANGABZ_MID,
        _dt: unsafeWindow.MANGABZ_VIEWSIGN_DT,
        _sign: unsafeWindow.MANGABZ_VIEWSIGN,
      },
    });
    return eval(res) as string[]; // oxlint-disable-line no-eval
  };

  const getChapterNav = (pcSelector: string, mobileText: string) =>
    querySelectorClick(
      () =>
        querySelector(pcSelector) ??
        querySelectorAll('.bottom-bar-tool a').find((e) =>
          e.textContent?.includes(mobileText),
        ),
    );

  setup({
    name: 'mangabz',
    getImgList: ({ dynamicLoad }) =>
      dynamicLoad(async (setImg) => {
        const imgList = new Set<string>();
        while (imgList.size < imgNum) {
          // 因为每次会返回指定页数及上一页的图片链接，所以加个1减少请求次数
          for (const url of await getPageImg(imgList.size + 1)) {
            if (imgList.has(url)) continue;
            imgList.add(url);
            setImg(imgList.size - 1, url);
          }
        }
      }, imgNum),
    onNext: () =>
      getChapterNav('body > .container a[href^="/"]:last-child', '下一'),
    onPrev: () =>
      getChapterNav('body > .container a[href^="/"]:first-child', '上一'),
  });
})();
