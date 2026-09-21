import { type MangaProps } from 'components/Manga';
import { createEffectOn, createRootMemo } from 'helper';
import { type Accessor } from 'solid-js';

import { getProgressId, restoreReadProgress } from './readProgress';
import { type CoreContext } from './types';

/** 处理传递给 Manga 的初始图片数据 */
export const useImgList = <T extends Record<string, any>>(
  coreCtx: CoreContext<T>,
  currentImgListId: Accessor<MangaProps['imgList'] | undefined>,
) => {
  /** 当前进度的存储标识，变化时需要重新查询阅读进度 */
  const progressId = createRootMemo(() => getProgressId(coreCtx));

  createEffectOn([currentImgListId, progressId], async ([imgList, id]) => {
    if (!imgList) return;

    const progress = (id && (await restoreReadProgress(id, imgList))) ||
      // 未启用进度功能或没有保存过进度时，直接使用现有图片列表
      {
        imgList,
        fillEffect: undefined,
        initialImgIndex: undefined,
      };
    // 查询期间漫画可能已切换，进度标识不一致时丢弃本次结果
    if (progressId() !== id) return;

    return coreCtx.setState('manga', progress);
  });
};
