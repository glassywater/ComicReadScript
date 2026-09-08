import { isImageElement, querySelectorAll } from 'helper';

import { type ImageSlotGroup } from './imageSlotGroups';
import {
  lazyLoadTrigger,
  needTrigger,
  triggerLazyLoad,
} from './triggerLazyLoad';

export class LazyLoadController {
  /** 当前生效的图片 selector */
  private readonly getImgSelector: () => string;
  /** 所有图片槽位组 */
  private readonly getImageSlotGroups: () => readonly ImageSlotGroup[];
  /** 页面上所有不在黑名单中的图片元素 */
  private readonly getAllImg: () => HTMLImageElement[];
  /** 当前是否允许触发懒加载 */
  private readonly runCondition: () => boolean;
  /** 懒加载失败后的回调 */
  private readonly onLazyLoadFailed?: () => void;

  /** 懒加载触发 promise，用于避免重复触发 */
  private triggerPromise: Promise<void> | undefined;

  constructor(options: {
    getImgSelector: LazyLoadController['getImgSelector'];
    getImageSlotGroups: LazyLoadController['getImageSlotGroups'];
    getAllImg: LazyLoadController['getAllImg'];
    runCondition: LazyLoadController['runCondition'];
    onLazyLoadFailed?: LazyLoadController['onLazyLoadFailed'];
  }) {
    this.getImgSelector = options.getImgSelector;
    this.getImageSlotGroups = options.getImageSlotGroups;
    this.getAllImg = options.getAllImg;
    this.runCondition = options.runCondition;
    this.onLazyLoadFailed = options.onLazyLoadFailed;

    // 同一时间只会有一个 AutoImageScanner 在工作，因此将回调直接注册到全局单例
    lazyLoadTrigger.onFailed = () => this.onLazyLoadFailed?.();
    lazyLoadTrigger.runCondition = this.runCondition;
  }

  /** 手动触发一轮完整的懒加载 */
  trigger() {
    if (!this.runCondition()) return Promise.resolve();
    if (this.triggerPromise) return this.triggerPromise;

    this.triggerPromise = (async () => {
      try {
        // 优先触发大概率是漫画图片的懒加载
        const imgSelector = this.getImgSelector();
        if (imgSelector) {
          await this.triggerExpectImg(3);
          await this.triggerExpectImg();
        }
        await this.triggerAllRemainingLazyLoad();
      } finally {
        this.triggerPromise = undefined;
      }
    })();

    return this.triggerPromise;
  }

  /** 停止时清理触发状态 */
  clear() {
    this.triggerPromise = undefined;
  }

  /** 触发大概率是漫画图片且还未成功触发懒加载的元素的懒加载 */
  private readonly triggerExpectImg = async (num?: number) => {
    const selector = this.getImgSelector();
    if (!selector) return;
    let expectImgList =
      querySelectorAll<HTMLImageElement>(selector).filter(needTrigger);
    if (num) expectImgList = expectImgList.slice(0, num);
    await triggerLazyLoad(expectImgList);
  };

  /** 触发所有未收敛的 img 和图片容器 */
  private readonly triggerAllRemainingLazyLoad = async () => {
    // 针对不使用 img 来触发懒加载的网站，也要触发图片容器元素
    // https://www.twmanga.com/comic/chapter/sanjiaoguanxirumen-founai/0_0.html
    // https://klz9.com/love-live-flowers-hasunosora-jogakuin-school-idol-club-chapter-1.html
    if (!this.runCondition()) return;

    /** 当前已确认的成组图片槽位列表 */
    const activeGroups = this.getImageSlotGroups();

    let targets: HTMLElement[];
    if (activeGroups.length > 0) {
      // 有成组结果时，只处理组内需要触发懒加载的元素
      targets = [];
      for (const group of activeGroups) {
        for (const slot of group.slots)
          if (!isImageElement(slot) && needTrigger(slot)) targets.push(slot);
        for (const img of group.coveredImgs)
          if (needTrigger(img)) targets.push(img);
      }
    } else if (this.getImgSelector()) {
      // 有 selector 但找不到成组图片时，
      // 因为 selector 匹配的图片已由 triggerExpectImg 处理，故不进行触发
      return;
    } else {
      // 无 selector 且找不到成组图片时，对所有图片进行触发
      targets = this.getAllImg().filter(needTrigger);
    }

    if (targets.length > 0) await triggerLazyLoad(targets);
  };
}
