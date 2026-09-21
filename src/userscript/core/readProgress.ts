import { type MangaProps } from 'components/Manga';
import { promisifyRequest, throttle, useCache } from 'helper';

import { addShowImgsListener } from './showImgsChange';
import { type CoreContext } from './types';

type ShowImgsInfo = Parameters<NonNullable<MangaProps['onShowImgsChange']>>[0];

type ReadProgress = {
  id: string;
  /** 保存时间 */
  time: number;
  /** 当前显示的第一张图片的索引 */
  index: number;
  // 在卷轴模式下直接跳到上次阅读进度，在阅读进度前的图片不会立刻开始加载，
  // 拿不到图片尺寸的话，在实际加载了图片后就会导致抖动
  imgSize: Record<number, [number, number]>;
  // 双页模式下需要提前知道填充页设置，避免自动识别填充页时可能出现的抖动
  fillEffect: NonNullable<MangaProps['fillEffect']>;
};

let cache = undefined as unknown as AsyncReturnType<
  typeof useCache<{ progress: ReadProgress }>
>;
const initCache = async () => {
  if (cache) return cache;
  cache = await useCache({ progress: 'id' }, 'ReadProgress');

  // 清除过时的进度
  const nowTime = Date.now();
  cache.each('progress', (data, cursor) => {
    if (nowTime - data.time < 1000 * 60 * 60 * 24 * 29) return;
    return promisifyRequest(cursor.delete());
  });
};

/** 计算当前进度的存储标识 */
export const getProgressId = <T extends Record<string, any>>({
  store: { comicId, currentImgListId, flag },
}: CoreContext<T>) => {
  if (!comicId) return;
  return flag.isChapterMode ? `${currentImgListId}` : comicId;
};

let saveInfo: ShowImgsInfo | undefined;
/** 与 saveInfo 同批快照的进度标识，防止保存执行期间漫画切换导致存错 */
let saveId: string | undefined;
let lastIndex = -1;

const doSave = throttle(async () => {
  const info = saveInfo;
  const id = saveId;
  if (!info || !id) return;

  const index = info.activeImgIndex;
  if (index === lastIndex) return;
  lastIndex = index;

  await initCache();

  if (
    // 只保存 50 页以上漫画的进度
    info.imgList.length < 50 ||
    // 翻到最后几页时不保存
    index >= info.imgList.length - 5
  )
    return await cache.del('progress', id);

  const imgSize: Record<number, [number, number]> = {};
  for (const [i, img] of info.imgList.entries())
    if (img.width && img.height) imgSize[i] = [img.width, img.height];

  await cache.set('progress', {
    id,
    time: Date.now(),
    index,
    imgSize,
    fillEffect: info.fillEffect,
  });
}, 1000);

/** 监听当前显示图片的变化，存储图片显示相关数据 */
export const useReadProgress = <T extends Record<string, any>>(
  coreCtx: CoreContext<T>,
) => {
  addShowImgsListener((info) => {
    saveInfo = info;
    saveId = getProgressId(coreCtx);
    doSave();
  });
};

/** 根据存储的阅读进度创建初始图片显示数据 */
export const restoreReadProgress = async (
  id: string,
  imgList: MangaProps['imgList'],
) => {
  await initCache();
  const progress = await cache.get('progress', id);
  if (!progress) return;

  return {
    imgList: imgList.map((item, i) => {
      const size = progress.imgSize[i];
      if (!size) return item;
      return typeof item === 'string'
        ? { src: item, width: size[0], height: size[1] }
        : { ...item, width: size[0], height: size[1] };
    }),
    fillEffect: progress.fillEffect,
    initialImgIndex: Math.min(progress.index, imgList.length - 1),
  };
};
