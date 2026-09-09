import { createEffectOn, t, throttle } from 'helper';

import { setState, store } from '../store';
import { getImg } from './helper';
import { activePage, isUpscale } from './memo';
import { resetPage } from './renderPage';

/** 获取指定图片的提示文本 */
export const getImgTip = (i: number) => {
  if (i === -1) return t('other.fill_page');
  const img = getImg(i);

  // 如果图片未加载完毕则在其 index 后增加显示当前加载状态
  if (img.loadType !== 'loaded')
    return `${i + 1} (${t(`img_status.${img.loadType}`)})`;

  if (
    img.translationType &&
    img.translationType !== 'hide' &&
    img.translationMessage
  )
    return `${i + 1}：${img.translationMessage}`;

  if (isUpscale() && img.upscaleUrl !== undefined)
    return `${i + 1} (${img.upscaleUrl ? t('upscale.upscaled') : t('upscale.upscaling')})`;

  return `${i + 1}`;
};

/** 获取指定页面的提示文本 */
export const getPageTip = (pageIndex: number): string => {
  const page = store.pageList[pageIndex];
  if (!page) return 'null';
  const pageIndexText = page.map((index) =>
    index === -1 ? t('other.fill_page') : `${index + 1}`,
  ) as [string] | [string, string];
  if (pageIndexText.length === 1) return pageIndexText[0];
  if (store.option.dir === 'rtl') pageIndexText.reverse();
  return pageIndexText.join(' | ');
};

createEffectOn(
  () => store.activePageIndex,
  () => store.show.endPage && setState('show', 'endPage', undefined),
  { defer: true },
);

createEffectOn(
  activePage,
  throttle(
    () => store.isDragMode || store.isTurnAnimating || setState(resetPage),
  ),
);

// 在关闭工具栏的同时关掉滚动条的强制显示
createEffectOn(
  () => store.show.toolbar,
  () => {
    if (store.show.toolbar) return;
    setState((state) => {
      state.show.scrollbar = false;
      state.show.pageTip = false;
    });
  },
  { defer: true },
);
