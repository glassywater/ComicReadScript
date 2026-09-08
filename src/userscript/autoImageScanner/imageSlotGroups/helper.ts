import { hasComparableWidth } from '../sizeStandards';
import { type ImageSlot, type ImageSlotGroup } from './types';

/** 保留图片槽位宽度接近最宽组的组，用于排除侧边/底部宽度明显较小的推荐图 */
export const filterGroupsByWidth = (
  groups: ImageSlotGroup[],
): ImageSlotGroup[] => {
  if (groups.length === 0) return [];

  const baseline = Math.max(...groups.map((group) => group.medianWidth));
  if (baseline <= 0) return groups;

  return groups.filter((group) =>
    hasComparableWidth(group.medianWidth, baseline),
  );
};

/** 判断两组槽位列表的元素引用是否完全一致 */
const isSameSlotList = (a: readonly ImageSlot[], b: readonly ImageSlot[]) =>
  a.length === b.length && a.every((slot, index) => slot === b[index]);

/** 判断两个组是否代表相同的可展示槽位集合 */
const isSameGroup = (a: ImageSlotGroup, b: ImageSlotGroup) =>
  a.parent === b.parent &&
  isSameSlotList(a.slots, b.slots) &&
  a.coveredImgs.size === b.coveredImgs.size &&
  [...a.coveredImgs].every((img) => b.coveredImgs.has(img));

/** 判断两组 groups 是否发生变化 */
export const isSameGroupList = (
  a: readonly ImageSlotGroup[],
  b: readonly ImageSlotGroup[],
) =>
  a.length === b.length &&
  a.every((group, index) => isSameGroup(group, b[index]));
