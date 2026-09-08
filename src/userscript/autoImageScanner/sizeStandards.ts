import { type ImageSizeInfo } from './ImageWatcher';

/**
 * 本模块所有「尺寸标准」的唯一汇集处。
 *
 * 每条标准由「私有常量（数值）+ 导出的判定函数（比较逻辑）」配套组成，
 * 调用方只接触判定函数，不接触具体比较细节。
 * 各标准分别作用于识别流程的不同阶段、过滤目标互不相同，
 * 数值相互独立，调整其中之一不影响也无需联动其他。
 */

// ── 合格图片集合的筛选 ──

/**
 * 图片进入合格图片集合的最小显示尺寸，宽高都需大于该值。
 *
 * 用于滤掉显然不可能是漫画图片的小图。
 *
 * 同时是集合内尺寸记录的更新条件：
 * 已进入集合的图片缩小到该值以下后，
 * 集合中的尺寸记录会停留在旧值、不再更新。
 */
const MIN_DISPLAY_SIZE = 100;

/**
 * 图片进入合格图片集合的最小原图尺寸，宽高都需大于该值。
 *
 * 原图尺寸是最可靠的判断标准，用于排除被 CSS 拉大显示的小图（比如加载占位图），
 * 且原图尺寸在加载完成前为 0，尚未加载出内容的图片天然不通过。
 */
const MIN_NATURAL_SIZE = 500;

/** 判断图片的显示尺寸是否满足进入合格图片集合的条件 */
export const hasQualifiedDisplaySize = (size: {
  width: number;
  height: number;
}) => size.width > MIN_DISPLAY_SIZE && size.height > MIN_DISPLAY_SIZE;

/** 判断图片的原图尺寸是否满足进入合格图片集合的条件 */
export const hasQualifiedNaturalSize = (size: {
  width: number;
  height: number;
}) => size.width > MIN_NATURAL_SIZE && size.height > MIN_NATURAL_SIZE;

// ── 种子图片的筛选 ──

/**
 * 参与成组识别（作为种子）图片的最小显示宽度，宽高都需大于该值。
 *
 * 进入合格图片集合的图片里，仍会混有推荐缩略图、相关封面，
 * 其原图可能不小，只是被显示得小，只能靠显示尺寸区分。
 */
export const MIN_IMAGE_DISPLAY_WIDTH = 300;

/** 参与成组识别的图片的最小显示高度 */
export const MIN_IMAGE_DISPLAY_HEIGHT = 300;

/** 判断图片的显示尺寸是否已达到可参与成组识别的最小标准 */
export const hasPotentialMangaSize = (
  map: Map<HTMLImageElement, ImageSizeInfo>,
  img: HTMLImageElement,
) => {
  const size = map.get(img)?.display;
  return (
    size !== undefined &&
    size.width >= MIN_IMAGE_DISPLAY_WIDTH &&
    size.height >= MIN_IMAGE_DISPLAY_HEIGHT
  );
};

// ── 图片槽位的筛选 ──

/**
 * 容器成为图片槽位所需的最小宽高，大于该值即通过。
 *
 * 成组识别在种子图片的祖先层级寻找「相似兄弟元素」，
 * 该值用于过滤相似兄弟元素里的小容器（如页数提示）。
 * 阈值较为宽松，是因为这里只做初步过滤，最终成组还有组内数量条件来判断过滤
 */
const MIN_SLOT_SIZE = 100;

/** 判断容器的尺寸是否有资格作为图片槽位 */
export const hasValidSize = (element: HTMLElement) => {
  const { width, height } = element.getBoundingClientRect();
  return width >= MIN_SLOT_SIZE && height >= MIN_SLOT_SIZE;
};

// ── 懒加载完成的判定 ──

/** 视为「已加载出真实内容」的原图尺寸，宽或高任一维大于该值即算过 */
const LAZY_LOADED_PROOF_SIZE = 500;

/** 判断图片是否已加载出足够大的真实内容 */
export const hasLazyLoadProofSize = (img: HTMLImageElement) =>
  img.naturalWidth > LAZY_LOADED_PROOF_SIZE ||
  img.naturalHeight > LAZY_LOADED_PROOF_SIZE;

// ── 组间宽度过滤 ──

/**
 * 组间宽度过滤的保留比例：组宽中位数达到最宽组的该比例以上才保留。
 *
 * 用于过滤侧边、正文底部的「相关推荐」，
 * 侧边、正文底部的「相关推荐」中的图片同样会成组，
 * 因此要靠与最宽组（正文组）的相对宽度来过滤。
 */
const WIDTH_KEEP_RATIO = 0.8;

/** 判断组的宽度是否与最宽组足够接近 */
export const hasComparableWidth = (width: number, baselineWidth: number) =>
  width >= baselineWidth * WIDTH_KEEP_RATIO;
