// 参考 darkreader 的实现思路：层级判定 + 网格采样 + 时机门控
// https://github.com/darkreader/darkreader/blob/main/src/inject/detector.ts

import { getSRGBLightness, parseColor } from './color';

// 值来源于站方的显式声明，可靠性最高，命中任意一层即短路

/** <meta name="color-scheme"> 的严格声明 */
const getDarkByMeta = (): boolean | undefined => {
  const content = document
    .querySelector('meta[name="color-scheme" i]')
    ?.getAttribute('content')
    ?.toLowerCase();
  if (content === 'dark' || content === 'only dark') return true;
  if (content === 'light' || content === 'only light') return false;
};

/** html / body 上的 dark class 或 data-theme 标记 */
const getDarkByClass = (): boolean | undefined => {
  const html = document.documentElement;
  if (
    html.classList.contains('dark') ||
    document.body?.classList.contains('dark') ||
    html.dataset.theme?.toLowerCase() === 'dark'
  )
    return true;
};

/** 根元素自带反色或颜色方案 */
const getDarkByRootStyle = (): boolean | undefined => {
  const rootStyle = getComputedStyle(document.documentElement);
  if (
    rootStyle.filter.includes('invert(1)') ||
    rootStyle.filter.includes('invert(100%)')
  )
    return true;
  if (rootStyle.colorScheme === 'dark') return true;
};

export const getDarkByFastPath = () =>
  getDarkByMeta() ?? getDarkByClass() ?? getDarkByRootStyle();

// 网格参数：理想每格 256px，最多 4x4 个采样点
const CELL_SIZE = 256;
const MAX_ROW_COUNT = 4;

/** 像素级网格采样：在视口上取稀疏采样点统计明暗 */
export const isDarkBySampling = (selfDomSet: WeakSet<Element>): boolean => {
  const winWidth = window.innerWidth;
  const winHeight = window.innerHeight;
  const stepX = Math.floor(
    winWidth / Math.min(MAX_ROW_COUNT, Math.ceil(winWidth / CELL_SIZE)),
  );
  const stepY = Math.floor(
    winHeight / Math.min(MAX_ROW_COUNT, Math.ceil(winHeight / CELL_SIZE)),
  );
  if (stepX <= 0 || stepY <= 0) return false;

  const rootStyle = getComputedStyle(document.documentElement);
  /** 同一元素被多格命中只统计一次 */
  const processedElements = new WeakSet<Element>();

  for (let y = Math.floor(stepY / 2); y < winHeight; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < winWidth; x += stepX) {
      const element = document.elementFromPoint(x, y);
      if (
        !element ||
        processedElements.has(element) ||
        selfDomSet.has(element) ||
        // 图片常是大面积装饰，不代表页面真实明暗
        element.tagName.toLowerCase() === 'img'
      )
        continue;
      processedElements.add(element);

      const style =
        element === document.documentElement
          ? rootStyle
          : getComputedStyle(element);
      const bgColor = parseColor(style.backgroundColor);
      // 无法解析的颜色跳过
      if (!bgColor) continue;

      if (bgColor.a === 1) {
        // 不透明背景过亮 → 浅色
        if (getSRGBLightness(bgColor) > 0.6) return false;
      } else {
        const textColor = parseColor(style.color);
        if (!textColor) continue;
        // 透明背景时看文字色，文字过暗 → 浅色
        if (getSRGBLightness(textColor) < 0.4) return false;
      }
    }
  }

  // 网格未发现浅色区域时，用根元素和 body 的背景色按 alpha 加权合成判断
  const rootColor = parseColor(rootStyle.backgroundColor);
  const bodyColor = document.body
    ? parseColor(getComputedStyle(document.body).backgroundColor)
    : undefined;

  if ((!rootColor || rootColor.a === 0) && (!bodyColor || bodyColor.a === 0)) {
    // 两者都透明时看根元素文字色
    const textColor = parseColor(rootStyle.color);
    return textColor ? getSRGBLightness(textColor) > 0.5 : false;
  }

  // 透明部分的有效亮度按 1（最亮）计
  const rootLightness = rootColor
    ? 1 - rootColor.a + rootColor.a * getSRGBLightness(rootColor)
    : 1;
  const finalLightness = bodyColor
    ? (1 - bodyColor.a) * rootLightness +
      bodyColor.a * getSRGBLightness(bodyColor)
    : rootLightness;
  return finalLightness < 0.5;
};

/** 页面是否已有样式 */
const hasSomeStyle = () => {
  // 排除脚本注入的 adoptedStyleSheets，用 DOM 判断

  if (document.querySelector('style, link[rel~="stylesheet" i]')) return true;
  if (document.querySelector('meta[name="color-scheme" i]')) return true;
  const rootColor = parseColor(
    getComputedStyle(document.documentElement).backgroundColor,
  );
  if (rootColor?.a) return true;
  if (document.body) {
    const bodyColor = parseColor(
      getComputedStyle(document.body).backgroundColor,
    );
    if (bodyColor?.a) return true;
  }
  return false;
};

/** 页面是否已就绪到可以检测 */
export const canCheckForStyle = () => {
  const { body } = document;
  if (!body) return false;
  if (!(body.scrollHeight >= 32 && body.clientHeight >= 32)) return false;
  if (body.childElementCount === 0) return false;
  return hasSomeStyle();
};
