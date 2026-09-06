import { setup, toast } from 'core';
import {
  isUrl,
  querySelector,
  querySelectorAll,
  querySelectorClick,
  scrollIntoView,
  t,
} from 'helper';

(() => {
  if (!Reflect.has(unsafeWindow, 'DM5_CID')) return;

  const imgNum: number = unsafeWindow.DM5_IMAGE_COUNT ?? unsafeWindow.imgsLen;
  if (!(Number.isSafeInteger(imgNum) && imgNum > 0)) {
    toast.error(t('site.changed_load_failed'));
    return;
  }

  const getPageImg = async (i: number) => {
    const res = await unsafeWindow.$.ajax({
      type: 'GET',
      url: 'chapterfun.ashx',
      data: {
        cid: unsafeWindow.DM5_CID,
        page: i,
        key:
          unsafeWindow.$('#dm5_key').length > 0
            ? unsafeWindow.$('#dm5_key').val()
            : '',
        language: 1,
        gtk: 6,
        _cid: unsafeWindow.DM5_CID,
        _mid: unsafeWindow.DM5_MID,
        _dt: unsafeWindow.DM5_VIEWSIGN_DT,
        _sign: unsafeWindow.DM5_VIEWSIGN,
      },
    });
    return eval(res) as string[]; // oxlint-disable-line no-eval
  };

  const getChapterNav = (pcSelector: string, mobileText: string) =>
    querySelectorClick(
      () =>
        querySelector(pcSelector) ??
        querySelectorAll('.view-bottom-bar a').find((e) =>
          e.textContent?.includes(mobileText),
        ),
    );

  setup({
    name: 'DM5',
    getImgList({ dynamicLoad }) {
      // manhuaren 和 1kkk 的移动端上会直接用一个变量存储所有图片的链接
      if (
        Array.isArray(unsafeWindow.newImgs) &&
        unsafeWindow.newImgs.every(isUrl)
      )
        return unsafeWindow.newImgs as string[];

      return dynamicLoad(async (setImg) => {
        const imgList = new Set<string>();
        while (imgList.size < imgNum) {
          // 因为每次会返回指定页数及上一页的图片链接，所以加个1减少请求次数
          for (const url of await getPageImg(imgList.size + 1)) {
            if (imgList.has(url)) continue;
            imgList.add(url);
            setImg(imgList.size - 1, url);
          }
        }
      }, imgNum);
    },
    onPrev: () => getChapterNav('.logo_1', '上一章'),
    onNext: () => getChapterNav('.logo_2', '下一章'),
    onExit: (isEnd) => isEnd && scrollIntoView('.postlist'),
  });
})();
