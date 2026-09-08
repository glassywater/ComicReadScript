import { isImageElement } from 'helper';

import { type ImageSizeInfo } from '../ImageWatcher';
import {
  MIN_IMAGE_DISPLAY_HEIGHT,
  MIN_IMAGE_DISPLAY_WIDTH,
  hasPotentialMangaSize,
  hasValidSize,
} from '../sizeStandards';
import { isImageHostIneligible, isSimilarElement } from './similarity';
import { type ImageSlot, type ImageSlotGroup } from './types';

/** 成组图片槽位所需的最少槽位/覆盖图片数量 */
export const MIN_GROUP_SIZE = 3;

/** 单张图片作为候选漫画图片所需的最小显示面积 */
export const MIN_IMAGE_DISPLAY_AREA =
  MIN_IMAGE_DISPLAY_WIDTH * MIN_IMAGE_DISPLAY_HEIGHT;

/** 候选容器面积至少达到 MIN_GROUP_SIZE 张最小候选图显示面积之和 */
export const MIN_CONTAINER_AREA = MIN_GROUP_SIZE * MIN_IMAGE_DISPLAY_AREA;

/** 计算一组数值的中位数，空数组返回 0 */
const median = (numbers: number[]) => {
  if (numbers.length === 0) return 0;
  const sorted = numbers.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** 收集一个槽位内所有通过候选筛选的图片 */
const addSlotImgs = (
  slot: ImageSlot,
  rawImgSet: Set<HTMLImageElement>,
  coveredImgs: Set<HTMLImageElement>,
) => {
  if (isImageElement(slot)) {
    if (rawImgSet.has(slot)) coveredImgs.add(slot);
  } else {
    for (const innerImg of slot.querySelectorAll('img'))
      if (rawImgSet.has(innerImg)) coveredImgs.add(innerImg);
  }
};

/** 查找最近一层的「与当前元素相似」且数量足够的兄弟图片槽位 */
const findSimilarImageSlots = (
  element: HTMLElement,
  threshold: number,
): ImageSlot[] => {
  let current: HTMLElement | undefined = element;

  while (current?.parentElement) {
    const siblingList = current.parentElement.children;
    if (siblingList.length >= threshold) {
      const similarElements: ImageSlot[] = [];
      for (const sibling of siblingList) {
        if (
          !(sibling instanceof HTMLElement) ||
          !isSimilarElement(sibling, current) ||
          isImageHostIneligible(sibling) ||
          (!isImageElement(sibling) && !hasValidSize(sibling))
        )
          continue;
        similarElements.push(sibling);
      }
      if (similarElements.length >= threshold) return similarElements;
    }
    current = current.parentElement;
  }

  return [];
};

/** 根据一组相似槽位构建 ImageSlotGroup，图片不足或缺少父元素时返回 undefined */
const buildGroup = (
  slots: ImageSlot[],
  rawImgSet: Set<HTMLImageElement>,
): ImageSlotGroup | undefined => {
  const parent = slots[0].parentElement;
  if (!parent) return undefined;

  const coveredImgs = new Set<HTMLImageElement>();
  for (const slot of slots) addSlotImgs(slot, rawImgSet, coveredImgs);
  if (coveredImgs.size < MIN_GROUP_SIZE) return undefined;

  const widths = slots.map((slot) => slot.getBoundingClientRect().width);

  return {
    parent,
    slots,
    coveredImgs,
    medianWidth: median(widths),
  };
};

/** 找出包含足够图片、但尚未形成组的「最小候选容器」 */
const findObservingCandidates = (
  rawImgs: HTMLImageElement[],
  groups: ImageSlotGroup[],
): HTMLElement[] => {
  if (rawImgs.length < MIN_GROUP_SIZE) return [];

  // 统计每个祖先容器内包含多少张候选图，用于找出“足够小但已经含有足够图片”的容器
  const countMap = new Map<HTMLElement, number>();
  for (const img of rawImgs) {
    let node = img.parentElement;
    while (node && node !== document.body) {
      countMap.set(node, (countMap.get(node) ?? 0) + 1);
      node = node.parentElement;
    }
  }

  // 已确认组所在层级不需要再重复观察，避免 observing 与 groups 职责重叠
  const groupParents = groups.map((group) => group.parent);
  const hasOverlapWithGroup = (element: HTMLElement) =>
    groupParents.some(
      (parent) =>
        element === parent ||
        parent.contains(element) ||
        element.contains(parent),
    );

  const candidates: HTMLElement[] = [];
  for (const [element, count] of countMap) {
    if (
      count < MIN_GROUP_SIZE ||
      !element.isConnected ||
      !element.checkVisibility() ||
      hasOverlapWithGroup(element)
    )
      continue;

    const rect = element.getBoundingClientRect();
    if (rect.width * rect.height < MIN_CONTAINER_AREA) continue;

    // 只要某个直接子元素已经拥有足够图片，就优先观察更小的子容器
    let hasChildCandidate = false;
    for (const child of element.children) {
      if ((countMap.get(child as HTMLElement) ?? 0) >= MIN_GROUP_SIZE) {
        hasChildCandidate = true;
        break;
      }
    }
    if (hasChildCandidate) continue;

    candidates.push(element);
  }

  return candidates;
};

export type FinderResult = {
  /** 当前已确认的成组图片槽位 */
  groups: ImageSlotGroup[];
  /** 当前尚未成组，但之后可能有成组图片槽位的候选容器 */
  observing: HTMLElement[];
};

/** 从一组种子图片开始寻找成组图片槽位 */
const findGroupsFromSeeds = (
  seedImgs: HTMLImageElement[],
  rawImgSet: Set<HTMLImageElement>,
): FinderResult => {
  const coveredImgSet = new Set<HTMLImageElement>();
  const groups: ImageSlotGroup[] = [];

  // 对每张尚未被任何组覆盖的种子图片，找到最近的相似兄弟槽位组
  // 被覆盖的图片会在后续循环中跳过
  for (const img of seedImgs) {
    if (coveredImgSet.has(img)) continue;

    const slots = findSimilarImageSlots(img, MIN_GROUP_SIZE);
    if (slots.length === 0) continue;

    const group = buildGroup(slots, rawImgSet);
    if (!group) continue;

    for (const coveredImg of group.coveredImgs) coveredImgSet.add(coveredImg);
    groups.push(group);
  }

  return {
    groups,
    observing: findObservingCandidates(seedImgs, groups),
  };
};

/** 从合格图片集合中找出所有可能的成组图片槽位及待观察候选容器 */
export const findImageSlotGroupsAndObserving = (
  map: Map<HTMLImageElement, ImageSizeInfo>,
  selector?: string,
): FinderResult => {
  // 先剔除显示尺寸过小的图片，减少推荐小图对组识别的干扰
  const rawImgs = [...map.keys()].filter((img) =>
    hasPotentialMangaSize(map, img),
  );
  const rawImgSet = new Set(rawImgs);

  // 有 selector 时优先只从 selector 匹配的图片开始成组
  if (selector) {
    const selectorImgs = rawImgs.filter((img) => img.matches(selector));
    if (selectorImgs.length > 0) {
      const result = findGroupsFromSeeds(selectorImgs, rawImgSet);
      if (result.groups.length > 0) return result;
    }
  }

  return findGroupsFromSeeds(rawImgs, rawImgSet);
};
