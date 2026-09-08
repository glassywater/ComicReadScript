import { isImageElement } from 'helper';

import { type ImageSizeInfo } from '../ImageWatcher';
import { findImageSlotGroupsAndObserving } from './finder';
import { filterGroupsByWidth, isSameGroupList } from './helper';
import { type ImageSlot, type ImageSlotGroup } from './types';

export type { ImageSlotGroup, ImageSlot } from './types';

/** 管理当前已确认的成组图片槽位，并在存在待观察候选时保留用于重扫的数据 */
export class ImageSlotGroupManager {
  /** 最近一次成组扫描的输入快照与观察结果 */
  private lastScan:
    | {
        map: Map<HTMLImageElement, ImageSizeInfo>;
        selector?: string;
        imgSet: Set<HTMLImageElement>;
        observing: HTMLElement[];
      }
    | undefined;

  /** 当前确认可输出的成组图片槽位 */
  private _groups: ImageSlotGroup[] = [];

  /** 当前确认可输出的成组图片槽位 */
  get groups(): readonly ImageSlotGroup[] {
    return this._groups;
  }

  /** 将当前所有成组图片槽位展开为去重后的展示用槽位/图片列表 */
  buildSlotElements(): ImageSlot[] {
    const elements = new Set<ImageSlot>();

    for (const group of this._groups) {
      const slotImgsMap = new Map<ImageSlot, HTMLImageElement[]>();

      for (const img of group.coveredImgs) {
        let node = img.parentElement;
        while (
          node &&
          node !== group.parent &&
          node.parentElement !== group.parent
        )
          node = node.parentElement;
        if (!node || node === group.parent) continue;

        const imgs = slotImgsMap.get(node) ?? [];
        imgs.push(img);
        slotImgsMap.set(node, imgs);
      }

      for (const slot of group.slots) {
        if (isImageElement(slot)) {
          if (group.coveredImgs.has(slot)) elements.add(slot);
          continue;
        }

        const imgs = slotImgsMap.get(slot);
        if (imgs && imgs.length > 0) for (const img of imgs) elements.add(img);
        else elements.add(slot);
      }
    }

    return [...elements];
  }

  /** 重新扫描内容区与成组图片槽位，返回本次扫描后 groups 是否发生变化 */
  scan(map: Map<HTMLImageElement, ImageSizeInfo>, selector?: string): boolean {
    const oldGroups = this._groups;
    const result = findImageSlotGroupsAndObserving(map, selector);

    // 先找到所有可能的组，再按宽度中位数过滤掉明显像推荐/侧栏的组
    const newGroups = filterGroupsByWidth(result.groups);
    this._groups = newGroups;
    const observing = this.filterObservingCandidates(
      result.observing,
      this._groups,
    );

    this.lastScan = {
      map,
      selector,
      imgSet: new Set(map.keys()),
      observing,
    };
    return !isSameGroupList(oldGroups, newGroups);
  }

  /** 当前 map 中是否有新合格图片落在未成组观察候选容器内 */
  hasNewQualifiedImageInsideObserving(
    map: Map<HTMLImageElement, ImageSizeInfo>,
  ): boolean {
    if (!this.lastScan || this.lastScan.observing.length === 0) return false;

    for (const img of map.keys()) {
      if (this.lastScan.imgSet.has(img)) continue;
      if (this.lastScan.observing.some((element) => element.contains(img)))
        return true;
    }
    return false;
  }

  /** 对仍存在未成组候选的扫描结果做重试，返回扫描后 groups 是否发生变化 */
  retryObserving(): boolean {
    if (!this.lastScan || this.lastScan.observing.length === 0) return false;
    return this.scan(this.lastScan.map, this.lastScan.selector);
  }

  /** 清空全部状态 */
  clear() {
    this._groups = [];
    this.lastScan = undefined;
  }

  /** 过滤出仍有效且不与已确认组重叠的观察容器 */
  private filterObservingCandidates(
    candidates: HTMLElement[],
    groups: readonly ImageSlotGroup[],
  ): HTMLElement[] {
    const groupParents = groups.map((group) => group.parent);
    return candidates.filter((element) => {
      if (!element.isConnected || !element.checkVisibility()) return false;

      return !groupParents.some(
        (parent) =>
          element === parent ||
          parent.contains(element) ||
          element.contains(parent),
      );
    });
  }
}
