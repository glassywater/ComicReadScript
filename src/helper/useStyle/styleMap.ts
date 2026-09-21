import { type Accessor, type JSX } from 'solid-js';

import { createEffectOn, createRootMemo } from '../solidJs';
import { useStyleSheet } from './stylesheet';

export type StyleMap = {
  [P in keyof JSX.CSSProperties]: Accessor<JSX.CSSProperties[P]>;
};

export type StyleMapArg =
  | StyleMap
  | Accessor<JSX.CSSProperties>
  | (StyleMap | Accessor<JSX.CSSProperties>)[];

/**
 * 将同一帧内的所有 CSS 变更合并为一次 DOM 写入
 *
 * 避免相关属性因更新时序不一致导致浏览器判定值无效
 */
const setStyle = (() => {
  const list: [CSSStyleDeclaration, string, string | number | undefined][] = [];
  let id = 0;

  const flush = () => {
    id = 0;
    for (const [style, key, val] of list) {
      if (val === undefined || val === '') style.removeProperty(key);
      else style.setProperty(key, typeof val === 'string' ? val : `${val}`);
    }
    list.length = 0;
  };

  return (style: CSSStyleDeclaration, key: string, val?: string | number) => {
    list.push([style, key, val]);
    id ||= requestAnimationFrame(flush);
  };
})();

/** 用 CSSStyleSheet 实现和修改 style 一样的效果 */
export const useStyleMemo = (
  selector: string | Accessor<string>,
  styleMapArg: StyleMapArg,
  e?: Element,
) => {
  const styleSheet = useStyleSheet(e);
  const getSelector =
    typeof selector === 'string' ? () => selector : createRootMemo(selector);

  styleSheet.insertRule(`${getSelector()} { }`);
  const { style } = styleSheet.cssRules[0] as CSSStyleRule;
  if (typeof selector !== 'string')
    createEffectOn(getSelector, (s) => {
      (styleSheet.cssRules[0] as CSSStyleRule).selectorText = s;
    });
  // TODO: 等火狐实现了 CSS Typed OM 后改用 styleMap 性能会更好，
  // 也能使用 CSS Typed OM 的 单位

  const styleMapList = Array.isArray(styleMapArg) ? styleMapArg : [styleMapArg];
  for (const styleMap of styleMapList) {
    if (typeof styleMap === 'object') {
      for (const [key, val] of Object.entries(styleMap)) {
        const styleText = createRootMemo(val);
        createEffectOn(styleText, (newVal) => setStyle(style, key, newVal));
      }
    } else {
      const styleMemoMap = createRootMemo(styleMap);
      createEffectOn(styleMemoMap, (map) => {
        for (const [key, val] of Object.entries(map)) setStyle(style, key, val);
      });
    }
  }
};
