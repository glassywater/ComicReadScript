export const isNumber = (val: unknown): val is number =>
  typeof val === 'number' && !Number.isNaN(val);

export const isSafeInteger = (val: unknown): val is number =>
  Number.isSafeInteger(val);

/** 判断节点是否为元素节点 */
export const isHTMLElement = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE;

/** 判断节点是否为图片元素节点 */
export const isImageElement = (node: Node): node is HTMLImageElement =>
  node.nodeName === 'IMG';
