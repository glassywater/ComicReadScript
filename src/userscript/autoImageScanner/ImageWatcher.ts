import { ReactiveMap, isHTMLElement, isImageElement } from 'helper';

export type ImageSizeInfo = {
  display: { width: number; height: number };
  natural: { width: number; height: number };
};

export type ImageWatcherOptions = {
  /**
   * 判断图片是否符合条件的过滤器
   * @param img 图片元素
   * @param display 显示尺寸
   * @param natural 原始尺寸
   */
  filterImg: (info: ImageSizeInfo, img: HTMLImageElement) => boolean;

  /** 当符合条件的图片集合发生变化时触发的回调 */
  onChanged: (map: Map<HTMLImageElement, ImageSizeInfo>) => void;

  /** 当 DOM 结构发生增删时触发的回调，用于决定是否需要重新识别内容区 */
  onStructureChange?: () => void;
};

/** 遍历节点及其子树中的所有图片元素 */
const forEachImage = (
  nodes: NodeList,
  callback: (img: HTMLImageElement) => void,
): void => {
  for (const node of nodes) {
    if (isImageElement(node)) callback(node);
    else if (isHTMLElement(node))
      for (const img of node.querySelectorAll('img')) callback(img);
  }
};

/** 监听网页上的所有图片元素的变化，筛选出符合条件的图片 */
export class ImageWatcher {
  private readonly options: ImageWatcherOptions;

  private readonly ro: ResizeObserver;

  private readonly mo: MutationObserver;

  // 记录已经符合条件的图片元素及其尺寸信息
  // 如果图片的 src 发生改变，会将其从这里移除，重新进行检查
  private readonly qualifiedMap = new ReactiveMap<
    HTMLImageElement,
    ImageSizeInfo
  >();

  // 记录已通过 observeImage 观察过的图片，便于 stop/remove 时取消监听
  private readonly observedImages = new Set<HTMLImageElement>();

  // 需要监听的属性列表
  private readonly targetAttributes = [
    'src',
    'srcset',
    'data-src',
    'data-original',
    'data-srcset',
  ];

  constructor(options: ImageWatcherOptions) {
    this.options = options;
    this.ro = new ResizeObserver(this.handleResize);
    this.mo = new MutationObserver(this.handleMutation);
  }

  public start(): void {
    // 监视页面当前所有图片，确保脚本加载前已经存在的图片也被处理
    let changed = false;
    for (const e of document.querySelectorAll('img')) {
      this.observeImage(e);
      if (this.tryQualify(e)) changed = true;
    }
    if (changed) this.options.onChanged(this.qualifiedMap);

    this.mo.observe(document.body, {
      childList: true, // 监听节点增删
      subtree: true, // 监听所有子孙节点
      attributes: true, // 监听属性变化
      attributeFilter: this.targetAttributes, // 只监听特定的图片相关属性
    });
  }

  /** 停止监听并清理资源 */
  public stop(): void {
    this.mo.disconnect();
    this.ro.disconnect();
    for (const img of this.observedImages) {
      img.removeEventListener('load', this.handleImageLoad);
      this.ro.unobserve(img);
    }
    this.observedImages.clear();
    this.qualifiedMap.clear();
  }

  /** 图片 load 时的处理方法，保留引用以便在 stop/remove 时取消监听 */
  private readonly handleImageLoad = (event: Event) => {
    const img = event.currentTarget as HTMLImageElement;
    if (this.tryQualify(img, undefined, true))
      this.options.onChanged(this.qualifiedMap);
  };

  /** 使用 ResizeObserver 监测图片尺寸变化，并在图片加载完成后重新检查 */
  private readonly observeImage = (img: HTMLImageElement) => {
    this.observedImages.add(img);
    this.ro.observe(img);

    if (img.complete) return;

    img.removeEventListener('load', this.handleImageLoad);
    img.addEventListener('load', this.handleImageLoad, { once: true });
  };

  /**
   * 将图片加入或更新 qualifiedMap。
   * 返回 true 表示本次调用让 qualifiedMap 产生了变化；
   * updateExisting 为 true 时，已存在的图片如果尺寸发生变化也会更新。
   */
  private tryQualify(
    img: HTMLImageElement,
    display?: { width: number; height: number },
    updateExisting = false,
  ): boolean {
    const oldInfo = this.qualifiedMap.get(img);
    if (oldInfo && !updateExisting) return false;

    const rect = display ?? img.getBoundingClientRect();
    const imageInfo = createImageInfo(img, rect);

    if (!this.options.filterImg(imageInfo, img)) return false;

    if (oldInfo && sameImageInfo(oldInfo, imageInfo)) return false;

    this.qualifiedMap.set(img, imageInfo);
    return true;
  }

  /** 处理 ResizeObserver 的回调，只有在图片尺寸发生实际变化（或初始化）时才会触发 */
  private readonly handleResize = (entries: ResizeObserverEntry[]): void => {
    let changed = false;

    for (const entry of entries) {
      const img = entry.target as HTMLImageElement;

      if (this.tryQualify(img, entry.contentRect, true)) changed = true;
    }

    if (changed) this.options.onChanged(this.qualifiedMap);
  };

  /** 将图片从 qualifiedMap 移除，返回是否真的移除了 */
  private readonly deleteImg = (img: HTMLImageElement) => {
    if (!this.qualifiedMap.has(img)) return false;
    this.qualifiedMap.delete(img);
    return true;
  };

  /** 取消对单张图片的 RO 与 load 监听 */
  private readonly unobserveImage = (img: HTMLImageElement) => {
    img.removeEventListener('load', this.handleImageLoad);
    this.ro.unobserve(img);
    this.observedImages.delete(img);
  };

  /** 处理新增节点中的图片 */
  private handleAddedNodes(nodes: NodeList): boolean {
    let changed = false;
    forEachImage(nodes, (img) => {
      this.observeImage(img);
      if (this.tryQualify(img)) changed = true;
    });
    return changed;
  }

  /** 处理移除节点中的图片 */
  private handleRemovedNodes(nodes: NodeList): boolean {
    let changed = false;
    forEachImage(nodes, (img) => {
      this.unobserveImage(img);
      if (this.deleteImg(img)) changed = true;
    });
    return changed;
  }

  /** 处理图片属性变化 */
  private handleAttributeMutation(node: Node): boolean {
    if (!isImageElement(node)) return false;

    const oldInfo = this.qualifiedMap.get(node);
    const imageInfo = createImageInfo(node, node.getBoundingClientRect());

    if (this.options.filterImg(imageInfo, node)) {
      // 尺寸没有变化时跳过
      if (oldInfo && sameImageInfo(oldInfo, imageInfo)) return false;
      this.qualifiedMap.set(node, imageInfo);
      this.observeImage(node);
      return true;
    }

    // 不符合条件时（可能只是新图尚未加载完成）移出集合，视为新图对待，
    // 挂上监听等加载完再重新判定
    this.observeImage(node);
    return this.deleteImg(node);
  }

  /** 处理监听节点的增删改 */
  private readonly handleMutation = (mutations: MutationRecord[]): void => {
    let changed = false;
    let structureChanged = false;

    for (const mutation of mutations) {
      switch (mutation.type) {
        case 'childList': {
          structureChanged = true;
          changed = this.handleAddedNodes(mutation.addedNodes) || changed;
          changed = this.handleRemovedNodes(mutation.removedNodes) || changed;
          break;
        }

        case 'attributes': {
          changed = this.handleAttributeMutation(mutation.target) || changed;
          break;
        }
      }
    }

    if (structureChanged) this.options.onStructureChange?.();
    if (changed) this.options.onChanged(this.qualifiedMap);
  };
}

/** 构造图片尺寸信息 */
const createImageInfo = (
  img: HTMLImageElement,
  display: { width: number; height: number },
): ImageSizeInfo => ({
  display,
  natural: { width: img.naturalWidth, height: img.naturalHeight },
});

/** 判断两张图片尺寸信息是否完全一致 */
const sameImageInfo = (a: ImageSizeInfo, b: ImageSizeInfo) =>
  a.display.width === b.display.width &&
  a.display.height === b.display.height &&
  a.natural.width === b.natural.width &&
  a.natural.height === b.natural.height;
