/**
 * 对 document.querySelector 的封装
 * 将默认返回类型改为 HTMLElement
 */
export const querySelector = <T extends HTMLElement = HTMLElement>(
  selector: string,
) => document.querySelector<T>(selector);

/**
 * 对 document.querySelector 的封装
 * 将默认返回类型改为 HTMLElement
 */
export const querySelectorAll = <T extends HTMLElement = HTMLElement>(
  selector: string,
) => [...document.querySelectorAll<T>(selector)];

/**
 * 根据选择器查找元素，若存在则返回点击该元素的函数
 *
 * 调用时（而非返回的点击函数被调用时）立即查找一次元素；
 * 若元素不存在则返回 `undefined`
 *
 * `selector` 支持两种形式：
 * - 字符串：作为 CSS 选择器查找
 * - 函数：延迟返回元素（适合元素尚未渲染、需要动态获取的场景）
 *   ```ts
 *   querySelectorClick(() => document.querySelector('.page')?.querySelector('a'));
 *   ```
 *
 * 传入字符串选择器时，还可通过 `textContent` 匹配文本内容，会从所有匹配元素中
 * 找出文本包含 `textContent` 的第一个元素（相当于 `:has-text()`）：
 * ```ts
 * querySelectorClick('.tab', '我的收藏')?.();
 * ```
 */
export const querySelectorClick = (
  selector: string | (() => HTMLElement | undefined | null),
  textContent?: string,
) => {
  let getDom: () => HTMLElement | null | undefined;

  if (typeof selector === 'function') getDom = selector;
  else if (textContent) {
    getDom = () =>
      querySelectorAll(selector).find((e) =>
        e.textContent?.includes(textContent),
      );
  } else getDom = () => querySelector(selector);

  if (getDom()) return () => getDom()?.click();
};

/** 滚动页面到指定元素的所在位置 */
export const scrollIntoView = (
  selector: string,
  behavior: ScrollBehavior = 'instant',
) => querySelector(selector)?.scrollIntoView({ behavior });

/** 将 HTML 字符串转换为 DOM 对象 */
export const domParse = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');
