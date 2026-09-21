import { type Accessor } from 'solid-js';

import { type CssArg, recordCssArgs } from './dedupe';
import { type StyleMapArg, useStyleMemo } from './styleMap';
import { useStyle } from './stylesheet';

export type { StyleMap } from './styleMap';

/**
 * 通过 CSSStyleSheet 注入全局样式，自动将样式挂载到当前文档或 shadow DOM 的 root 上。
 *
 * 支持三种调用方式：
 *
 * 1. **标签模板** — 模板中的表达式可以是普通值，也可以是函数（会自动追踪响应式变化）。
 *    将 Element 作为模板的第一个插值可以让样式挂载到正确的 root 上。
 *
 *    @example
 *    css`#comicRead { position: fixed; top: 0; left: 0; }`
 *    @example
 *    css`${shadowElement}
 *      .foo { color: ${getComputedStyle(el).color}; }
 *    `
 *
 * 2. **CSS 文本** — 字符串或响应式信号，信号变化时自动更新。
 *    可传入 Element 指定样式挂载到正确的 root 上。
 *
 *    @example
 *    css(cssText)
 *    @example
 *    css(cssText, shadowElement)
 *    @example
 *    css(createRootMemo(() => `.ad { filter: blur(8px); }`))
 *
 * 3. **选择器 + 样式映射** — 属性级的响应式更新，避免全量 CSS 重解析。
 *    支持 StyleMap、Accessor<JSX.CSSProperties>、
 *    以及二者的混合数组。可传入 Element 指定样式挂载到正确的 root 上。
 *
 *    @example
 *    css('#fab', { '--left': () => `${x}px` })
 *    @example
 *    css('.root', { '--bg': () => bg }, shadowElement)
 *    @example
 *    css('.root', () => (dark ? darkStyle : lightStyle))
 *    @example
 *    css('.root', [{ '--bg': () => bg }, () => themeStyle])
 *
 * 相同参数的重复调用只会在首次实际注入，之后直接跳过。
 * 返回本次是否实际注入
 */
export function css(styles: TemplateStringsArray, ...values: any[]): boolean;
export function css(
  cssText: string | Accessor<string>,
  e?: Element | null,
): boolean;
export function css(
  selector: string | Accessor<string>,
  styleMap: StyleMapArg,
  e?: Element,
): boolean;
export function css(
  arg1: TemplateStringsArray | string | Accessor<string>,
  arg2?: CssArg,
  ...rest: CssArg[]
): boolean {
  if (!recordCssArgs([arg1, arg2, ...rest])) return false;

  if (typeof arg1 !== 'object' || !('raw' in arg1)) {
    if (arg2 instanceof Element || arg2 === null || arg2 === undefined) {
      useStyle(arg1, arg2);
      return true;
    }
    useStyleMemo(arg1, arg2 as StyleMapArg, rest[0] as Element | undefined);
    return true;
  }

  const [styles, ...values] = [arg1, arg2, ...rest];
  let e: Element | undefined;
  let startIdx = 0;

  if (values[0] instanceof Element) {
    [e] = values;
    startIdx = 1;
  }

  useStyle(() => {
    let text = styles[startIdx];
    for (let i = startIdx; i < values.length; i++)
      text += `${
        typeof values[i] === 'function' ? (values[i] as () => any)() : values[i]
      }${styles[i + 1]}`;
    return text;
  }, e);
  return true;
}
