import { querySelectorAll } from 'helper';

import { isEleSelector } from './eleSelector';
import { type ImageSizeInfo, ImageWatcher } from './ImageWatcher';
import {
  hasQualifiedDisplaySize,
  hasQualifiedNaturalSize,
} from './sizeStandards';

const IMG_BLACK_LIST_SELECTOR = [
  // 东方永夜机的预加载图片
  '#pagetual-preload',
  // 177picyy 上会在图片下加一个 noscript，本来只是图片元素的 html 代码
  // 但经过东方永夜机加载后就会变成真的图片元素，导致重复
  'noscript',
].join(',');

/** 判断图片元素是否处于黑名单内 */
const isInBlackList = (img: HTMLImageElement) =>
  Boolean(img.closest(IMG_BLACK_LIST_SELECTOR));

/** 监听并获取网页上所有符合条件的图片元素 */
export class QualifiedImageWatcher {
  private readonly getImgSelector: () => string;
  private readonly filterImg?: (
    info: ImageSizeInfo,
    img: HTMLImageElement,
  ) => boolean;

  private readonly imageWatcher: ImageWatcher;

  constructor(options: {
    /** 获取当前生效的图片 selector */
    getImgSelector: () => string;
    /** 自定义图片过滤规则 */
    filterImg?: (info: ImageSizeInfo, img: HTMLImageElement) => boolean;
    /** 当符合条件的图片集合发生变化时触发的回调 */
    onChanged: (map: Map<HTMLImageElement, ImageSizeInfo>) => void;
    /** 当 DOM 结构发生增删时触发的回调 */
    onStructureChange?: () => void;
  }) {
    this.getImgSelector = options.getImgSelector;
    this.filterImg = options.filterImg;

    this.imageWatcher = new ImageWatcher({
      filterImg: (info, img) =>
        this.filterImage(info, img) && !isInBlackList(img), // 始终排除黑名单
      onChanged: options.onChanged,
      onStructureChange: options.onStructureChange,
    });
  }

  /** 开始监听网页图片 */
  start() {
    this.imageWatcher.start();
  }

  /** 停止监听并清理资源 */
  stop() {
    this.imageWatcher.stop();
  }

  /** 获取页面上所有不在黑名单中的图片元素 */
  getAllImg() {
    return querySelectorAll<HTMLImageElement>(
      `:not(${IMG_BLACK_LIST_SELECTOR}) > img`,
    );
  }

  /** 判断图片是否符合扫描条件 */
  private readonly filterImage = (
    info: ImageSizeInfo,
    img: HTMLImageElement,
  ) => {
    // 排除显示尺寸小的
    if (
      !hasQualifiedDisplaySize(info.display) ||
      !hasQualifiedNaturalSize(info.natural)
    )
      return false;

    const imgSelector = this.getImgSelector();
    // 记录在案的直接通过
    if (imgSelector && isEleSelector(img, imgSelector)) return true;
    // 定义了过滤规则的按定义的来
    if (this.filterImg) return this.filterImg(info, img);
    return true;
  };
}
