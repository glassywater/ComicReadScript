import { inRange } from '../other';

/** 解析逗号或空格分隔的颜色分量 */
const parseRGBNumbers = (
  raw: string,
  scale: number,
): Required<RGBColor> | undefined => {
  const parts = raw.split(/[\s,/]+/u).filter(Boolean);
  if (!inRange(3, parts.length, 4)) return;

  const conv = (part: string) => {
    // oxlint-disable-next-line unicorn/prefer-number-coercion
    const num = Number.parseFloat(part);
    if (!Number.isFinite(num)) return;
    return part.endsWith('%') ? (num / 100) * scale : num;
  };

  const r = conv(parts[0]);
  const g = conv(parts[1]);
  const b = conv(parts[2]);
  const a = parts.length === 4 ? conv(parts[3]) : 1;
  if (r === undefined || g === undefined || b === undefined || a === undefined)
    return;
  return { r, g, b, a };
};

/** 解析 getComputedStyle 返回的颜色值 */
export const parseColor = (text: string): Required<RGBColor> | undefined => {
  const str = text.trim().toLowerCase();
  if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const rgbText = /^rgba?\((?<rgb>[^)]+)\)$/u.exec(str)?.groups?.rgb;
  if (rgbText) return parseRGBNumbers(rgbText, 255);

  const srgbText = /^color\(srgb(?<srgb>[^)]+)\)$/u.exec(str)?.groups?.srgb;
  if (srgbText) {
    // color(srgb ...) 的分量取值范围为 0-1
    const color = parseRGBNumbers(srgbText, 1);
    if (!color) return;
    return {
      r: color.r * 255,
      g: color.g * 255,
      b: color.b * 255,
      a: color.a,
    };
  }
};

/** sRGB 相对亮度（Rec.709 加权） */
export const getSRGBLightness = ({ r, g, b }: RGBColor) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
