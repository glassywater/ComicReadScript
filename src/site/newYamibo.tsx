import { request, setup } from 'core';
import { querySelector, querySelectorClick, scrollIntoView, t } from 'helper';

(() => {
  if (location.pathname !== '/manga/view-chapter') return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;

  /** 总页数 */
  const totalPageNum = Number(
    querySelector(
      'section div:first-of-type div:last-of-type',
    )!.innerHTML.split('：')[1],
  );
  if (Number.isNaN(totalPageNum))
    throw new Error(t('site.changed_load_failed'));

  /** 获取指定页数的图片 url */
  const loadImg = async (i: number) => {
    const res = await request(
      `https://www.yamibo.com/manga/view-chapter?id=${id}&page=${i}`,
    );
    return /(?<=<img id=['"]imgPic['"].+?src=['"]).+?(?=['"])/u
      .exec(res.responseText)![0]
      .replaceAll('&amp;', '&')
      .replaceAll('http://', 'https://');
  };

  setup({
    name: 'newYamibo',
    getImgList: ({ dynamicLazyLoad }) =>
      dynamicLazyLoad({ loadImg, length: totalPageNum }),
    onNext: () => querySelectorClick('#btnNext'),
    onPrev: () => querySelectorClick('#btnPrev'),
    onExit: (isEnd) => isEnd && scrollIntoView('#w1'),
  });
})();
