/** 漫画图片槽位：可能是 img，也可能是包裹 img 的容器 */
export type ImageSlot = HTMLElement;

/** 一组相似且可视为是漫画图片载体的图片槽位 */
export type ImageSlotGroup = {
  /** 成组图片槽位的共同父元素 */
  parent: HTMLElement;
  /** 成组的图片槽位。可能是 img，也可能是包裹 img 的容器 */
  slots: ImageSlot[];
  /** 组内所有通过候选筛选的图片 */
  coveredImgs: Set<HTMLImageElement>;
  /** 组内槽位显示宽度中位数 */
  medianWidth: number;
};
