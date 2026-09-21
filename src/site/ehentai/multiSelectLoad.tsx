import { askInput } from 'components/InputDialog';
import { useMultiSelectLoad } from 'core';
import {
  css,
  descRange,
  extractRange,
  inRange,
  log,
  querySelectorAll,
  range,
  singleThreaded,
  t,
} from 'helper';

import { detectAd } from './detectAd';
import { type GalleryHandler } from './helper';
import {
  checkMpvKey,
  checkShowkey,
  ensureImgPageUrl,
  getImgUrl,
} from './helper/api';

export const multiSelectLoad: GalleryHandler<
  Promise<{
    handleClick: (e: MouseEvent) => Promise<void>;
  }>
> = async (coreCtx, pageCtx) => {
  const { setState } = coreCtx;

  css`
    #gdt > a [title] {
      position: relative;
    }
  `;

  const checkAd = detectAd(coreCtx, pageCtx);

  // 在加载到最后十页时，再使用图片内容来检查广告页
  setState('manga', {
    onLoading: (_, img) => {
      if (!img) return;
      const index = pageCtx.imgList.indexOf(img.src);
      const { length } = pageCtx.imgList;
      if (inRange(length - 10, index, length)) void checkAd?.checkContent();
    },
  });

  const ensureSetup = singleThreaded(async () => {
    await ensureImgPageUrl(pageCtx, 0);
    void checkAd?.checkFileName();

    try {
      await checkMpvKey(pageCtx);
      await checkShowkey(pageCtx, pageCtx.pageList[0]);
    } catch (error) {
      log.warn('checkKey failed', error);
    }
  });

  const ms = await useMultiSelectLoad(coreCtx, {
    id: pageCtx.galleryId,
    allItemIds: () => range(pageCtx.imgNum).map(String),
    registerItems: (map) => {
      for (const dom of querySelectorAll<HTMLAnchorElement>('#gdt a')) {
        const imgIndex = Number(/(?<=-)\d+(?:\?|$)/u.exec(dom.href)?.[0]) - 1;
        if (!Number.isNaN(imgIndex))
          map.set(dom.querySelector('[title]')!, String(imgIndex));
      }
    },
    getImgList: async (id) => {
      await ensureSetup();
      const i = Number(id);
      await ensureImgPageUrl(pageCtx, i);
      pageCtx.imgList[i] ||= await getImgUrl(pageCtx, i);
      return [{ src: pageCtx.imgList[i], name: pageCtx.fileNameList[i] }];
    },
  });

  return {
    handleClick: async (e: MouseEvent) => {
      if (!e.shiftKey) return;
      e.stopPropagation();

      const defaultValue = descRange(
        ms.selectedIds().map(Number),
        pageCtx.imgNum,
      );

      const [message, tip] = t('other.page_range').split('\n');
      const pageRange = await askInput({ message, tip, defaultValue });
      if (!pageRange) return;

      // 进入多选模式，确保退出阅读模式后能看到选中的页面
      if (!ms.isEnabled()) ms.start();
      ms.setSelectedIds(
        [...extractRange(pageRange, pageCtx.imgNum)].map(String),
      );

      await ms.load();
    },
  };
};
