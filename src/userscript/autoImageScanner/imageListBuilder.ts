import { isImageElement, plimit, throttle } from 'helper';

import {
  BlobUrlResolver,
  PlaceholderImgList,
  sortElementsByDomOrder,
  sortElementsByTop,
} from './helper';
import { getDatasetUrl, isLazyLoadFailed } from './triggerLazyLoad';

type ImageListUpdateResult = {
  /** 本轮异步解析后是否有 URL 发生变化 */
  isEdited: boolean;
  /** 更新后是否没有可展示的槽位 */
  isEmpty: boolean;
};

/** 根据传入的图片槽位列表，维护最终可用的 imgList */
export class ImageListBuilder {
  private readonly enableSortImageByTop: boolean;
  private readonly onImgListChange?: (imgList: string[]) => void;
  private readonly onEmpty?: () => void;

  private readonly blobUrlResolver = new BlobUrlResolver();
  private readonly placeholderImgList = new PlaceholderImgList();
  private readonly updatePlaceholderImgList = throttle((imgList: string[]) => {
    this.placeholderImgList.update(imgList);
  });

  private isUpdatingImgList = false;
  /** AutoImageScanner 传入的代际标记，scanner 停止后作废过期的 update */
  private generation = 0;
  /**
   * update 的并发序号
   *
   * 新一次 update 开始时自增，旧 update 的异步闭包检测到序号落后即放弃写入
   */
  private updateSeq = 0;

  constructor(options: {
    enableSortImageByTop: boolean;
    onImgListChange?: (imgList: string[]) => void;
    onEmpty?: () => void;
  }) {
    this.enableSortImageByTop = options.enableSortImageByTop;
    this.onImgListChange = options.onImgListChange;
    this.onEmpty = options.onEmpty;
  }

  /** 过滤后用于展示的图片槽位列表 */
  private _slotElements: HTMLElement[] = [];
  /** 过滤后用于展示的图片槽位列表 */
  get slotElements() {
    return this._slotElements;
  }

  /** 当前找到的所有符合条件的图片 url */
  private _imgList: string[] = [];
  /** 当前找到的所有符合条件的图片 url */
  get imgList(): readonly string[] {
    return this._imgList;
  }

  /** 根据最新图片槽位列表，更新 slotElements 与 imgList */
  async update(
    selectedSlots: HTMLElement[],
    generation: number,
  ): Promise<ImageListUpdateResult> {
    const seq = ++this.updateSeq;
    this.generation = generation;

    this._slotElements = this.enableSortImageByTop
      ? sortElementsByTop(selectedSlots)
      : sortElementsByDomOrder(selectedSlots);

    if (this._slotElements.length === 0) {
      if (this._imgList.length > 0) {
        this._imgList = [];
        this.onImgListChange?.([]);
      }
      this.onEmpty?.();
      return { isEdited: false, isEmpty: true };
    }

    // 随着图片的增加，需要补上空缺位置，避免变成稀疏数组
    if (this._imgList.length < this._slotElements.length)
      this._imgList = [
        ...this._imgList,
        ...Array.from(
          { length: this._slotElements.length - this._imgList.length },
          () => '',
        ),
      ];
    // colamanga 会创建随机个数的假 img 元素，导致刚开始时高估页数，需要删掉多余的页数
    else if (this._imgList.length > this._slotElements.length)
      this._imgList = this._imgList.slice(0, this._slotElements.length);

    this.onImgListChange?.([...this._imgList]);
    this.updatePlaceholderImgList(this._imgList);

    let isEdited = false;
    this.isUpdatingImgList = true;
    try {
      await plimit(
        this._slotElements.map((e, i) => async () => {
          if (seq !== this.updateSeq || generation !== this.generation) return;
          // 非 img 槽位直接跳过不做处理
          if (!isImageElement(e)) return;

          try {
            let newUrl = await this.blobUrlResolver.resolve(e);
            if (seq !== this.updateSeq || generation !== this.generation)
              return;
            if (this.placeholderImgList.has(newUrl))
              newUrl = getDatasetUrl(e) ?? '';
            if (newUrl === this._imgList[i]) return;

            isEdited ||= true;
            this._imgList[i] = newUrl;
          } catch {
            if (seq !== this.updateSeq || generation !== this.generation)
              return;
            if (this._imgList[i] === '') return;
            isEdited ||= true;
            this._imgList[i] = '';
          }
        }),
      );
    } finally {
      // 只有当前这次 update 仍然是最新一次时，才复位更新标记；
      // 否则可能把重叠的新 update 的标记提前清掉。
      if (seq === this.updateSeq) this.isUpdatingImgList = false;
    }

    if (seq !== this.updateSeq || generation !== this.generation)
      return { isEdited: false, isEmpty: true };
    this.removeFailedSlots();
    if (this._slotElements.length === 0) return { isEdited, isEmpty: true };
    // removeFailedSlots 内部会调用 onImgListChange / onEmpty 外部回调，
    // 回调可能（直接或经同步的响应式 effect 链）再次触发 update 或 clear，
    // 改变 updateSeq / generation，故此处复查以丢弃过期的本轮结果
    if (seq !== this.updateSeq || generation !== this.generation)
      return { isEdited: false, isEmpty: true };
    return { isEdited, isEmpty: false };
  }

  /** 在异步 URL 解析完成后，通知外部最终 imgList 变化 */
  notifyFinalImgListChange(isEdited: boolean) {
    if (!isEdited || this._slotElements.length === 0) return;
    this.onImgListChange?.([...this._imgList]);
    this.updatePlaceholderImgList(this._imgList);
  }

  /** 懒加载失败后的回调：在非更新期间立即剔除失败槽位 */
  onLazyLoadFailed() {
    if (!this.isUpdatingImgList) this.removeFailedSlots();
  }

  /** 从当前展示列表中移除多次触发懒加载仍失败的槽位 */
  private removeFailedSlots() {
    if (this._slotElements.length === 0) return;

    const keptSlotElements: HTMLElement[] = [];
    const keptImgList: string[] = [];
    for (let i = 0; i < this._slotElements.length; i++) {
      const slot = this._slotElements[i];
      if (isLazyLoadFailed(slot)) continue;
      keptSlotElements.push(slot);
      keptImgList.push(this._imgList[i]);
    }

    if (keptSlotElements.length === this._slotElements.length) return;

    this._slotElements = keptSlotElements;
    this._imgList = keptImgList;

    if (this._slotElements.length === 0) return this.onEmpty?.();

    this.onImgListChange?.([...this._imgList]);
    this.updatePlaceholderImgList(this._imgList);
  }

  /** 合格图片集合为空时，清空当前列表状态并通知外部 */
  clearListState() {
    this.updateSeq++;
    this.isUpdatingImgList = false;
    if (this._slotElements.length === 0 && this._imgList.length === 0) return;
    this._slotElements = [];
    this._imgList = [];
    this.onImgListChange?.([]);
  }

  /** 停止扫描时清理资源 */
  clear() {
    this.updateSeq++;
    this.isUpdatingImgList = false;
    this.blobUrlResolver.clear();
    this.placeholderImgList.clear();
    this._slotElements = [];
    this._imgList = [];
  }
}
