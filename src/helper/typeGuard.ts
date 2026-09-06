export const isString = (val: unknown): val is string =>
  typeof val === 'string';

export const isNumber = (val: unknown): val is number =>
  typeof val === 'number';

export const isArray = (val: unknown): val is unknown[] => Array.isArray(val);

/** 判断节点是否为元素节点 */
export const isHTMLElement = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE;

/** 判断节点是否为图片元素节点 */
export const isImageElement = (node: Node): node is HTMLImageElement =>
  node.nodeName === 'IMG';
