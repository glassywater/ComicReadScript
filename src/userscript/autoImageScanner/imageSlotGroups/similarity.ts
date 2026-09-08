import { isImageElement } from 'helper';

import { isLazyLoadFailed } from '../triggerLazyLoad';

/** 判断两个元素的 dataset 是否具有相同的键结构 */
const hasSameDatasetStructure = (a: HTMLElement, b: HTMLElement) => {
  const keysA = Object.keys(a.dataset);
  const keysB = Object.keys(b.dataset);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => keysB.includes(key));
};

/** 判断两个元素是否相似 */
export const isSimilarElement = (a: HTMLElement, b: HTMLElement) =>
  a === b ||
  (a.className && a.className === b.className) ||
  hasSameDatasetStructure(a, b);

/** 明显不可能是图片槽位承载者的标签集合 */
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'HEAD',
  'TEMPLATE',
]);

/** 判断元素是否为明显不可能是图片槽位 */
export const isImageHostIneligible = (element: HTMLElement) => {
  // 元素不可见
  if (!element.checkVisibility()) return true;
  // 自己就是图片槽位
  if (isImageElement(element)) return false;
  // 被黑名单标记
  if (SKIP_TAGS.has(element.tagName)) return true;
  // 没有任何子元素
  if (element.children.length === 0) return true;
  // 多次触发懒加载仍未成功加载出图片，不可能是图片槽位
  if (isLazyLoadFailed(element)) return true;
  return false;
};
