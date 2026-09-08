import {
  getMostItem,
  querySelectorAll,
  singleThreaded,
  t,
  throttle,
  wait,
} from 'helper';
import { type Promisable } from 'type-fest';

import { type ChapterSwitch, getChapterSwitch } from './chapterSwitch';
import { getEleSelector } from './eleSelector';
import { ImageListBuilder } from './imageListBuilder';
import { type ImageSlotGroup, ImageSlotGroupManager } from './imageSlotGroups';
import { type ImageSizeInfo } from './ImageWatcher';
import { LazyLoadController } from './lazyLoadController';
import { QualifiedImageWatcher } from './qualifiedImageWatcher';

const SELECTOR_FALLBACK_TIMEOUT = 3000;

/**
 * 自动发现网页上的所有漫画图片的通用扫描器
 *
 * 数据流（各步骤对应的文件见同目录）：
 * - QualifiedImageWatcher：监听全页图片的增删/属性/尺寸变化，过滤出合格图片
 * - ImageSlotGroupManager：将合格图片按「相似兄弟元素」识别成组
 * - ImageListBuilder：把组内槽位解析为最终 URL 列表，
 *   通过 onImgListChange / onChapterSwitchChange 回调交给阅读器
 * - LazyLoadController：在后台模拟滚动+停留，触发网站懒加载出新图
 *
 * 并发防护：用 generation（stop 时自增）作废过期异步回调，
 * 见各 async 方法中的 generation 检查
 */
export class AutoImageScanner {
  /** 能获取到所有图片的 selector */
  private readonly initSelector?: string;
  /** 是否要按图片在页面中的垂直位置排序，否则将按文档顺序排序 */
  private readonly enableSortImageByTop: boolean;

  /** 自定义图片过滤规则 */
  private readonly filterImg?: (
    info: ImageSizeInfo,
    img: HTMLImageElement,
  ) => boolean;
  /** 是否触发懒加载的条件 */
  private readonly shouldTriggerLazyLoad?: () => boolean;

  /** 图片列表变化时的回调 */
  private readonly onImgListChange?: (imgList: string[]) => void;
  /** 章节切换按钮变化时的回调 */
  private readonly onChapterSwitchChange?: (
    sw: ChapterSwitch,
  ) => Promisable<void>;
  /** 页面上没有符合条件的图片时的回调 */
  private readonly onEmpty?: () => void;
  /** 发现新的正确的能获取到所有图片的 selector 时的回调 */
  private readonly onSelectorSuggest?: (selector: string) => void;

  /** 是否已开始监听 */
  private started = false;
  /** 当前生效的图片 selector */
  private imgSelector: string;
  /** 上次执行成组扫描时使用的 selector，用于检测 selector 变化并触发重扫 */
  private lastScannedSelector: string | undefined;
  /** 显式 selector 回退定时器 */
  private selectorFallbackTimer: number | undefined;
  /**
   * 代际标记，用于作废 stop 之后的过期异步回调：
   * stop() 时自增，旧回调闭包捕获的 generation 随之失效，
   * 各 async 方法据此直接返回，避免污染新一轮扫描的状态
   */
  private generation = 0;
  /** DOM 结构是否发生过增删，用于触发内容区重新识别 */
  private structureDirty = false;

  private readonly imageWatcher: QualifiedImageWatcher;
  private readonly imageListBuilder: ImageListBuilder;
  private readonly lazyLoadController: LazyLoadController;
  private readonly imageSlotGroupManager = new ImageSlotGroupManager();

  /** 当前识别到的章节切换按钮 */
  chapterSwitch: ChapterSwitch = {};

  /**
   * @param options 扫描器配置
   */
  constructor(options: {
    selector?: AutoImageScanner['initSelector'];
    filterImg?: AutoImageScanner['filterImg'];
    onImgListChange?: AutoImageScanner['onImgListChange'];
    onEmpty?: AutoImageScanner['onEmpty'];
    onChapterSwitchChange?: AutoImageScanner['onChapterSwitchChange'];
    onSelectorSuggest?: AutoImageScanner['onSelectorSuggest'];
    shouldTriggerLazyLoad?: AutoImageScanner['shouldTriggerLazyLoad'];
    sortImageByTop?: AutoImageScanner['enableSortImageByTop'];
  }) {
    this.initSelector = options.selector;
    this.filterImg = options.filterImg;
    this.onImgListChange = options.onImgListChange;
    this.onEmpty = options.onEmpty;
    this.onChapterSwitchChange = options.onChapterSwitchChange;
    this.onSelectorSuggest = options.onSelectorSuggest;
    this.shouldTriggerLazyLoad = options.shouldTriggerLazyLoad;
    this.imgSelector = options.selector ?? '';
    this.enableSortImageByTop = options.sortImageByTop ?? false;

    this.imageWatcher = new QualifiedImageWatcher({
      getImgSelector: () => this.imgSelector,
      filterImg: this.filterImg,
      onChanged: (map) => this.handleChanged(map, this.generation),
      onStructureChange: () => {
        this.structureDirty = true;
      },
    });

    this.imageListBuilder = new ImageListBuilder({
      enableSortImageByTop: this.enableSortImageByTop,
      onImgListChange: (imgList) => this.onImgListChange?.(imgList),
      onEmpty: () => this.onEmpty?.(),
    });

    this.lazyLoadController = new LazyLoadController({
      getImgSelector: () => this.imgSelector,
      getImageSlotGroups: () => this.imageSlotGroupManager.groups,
      getAllImg: () => this.imageWatcher.getAllImg(),
      runCondition: () => this.shouldTriggerLazyLoad?.() ?? true,
      onLazyLoadFailed: () => this.imageListBuilder.onLazyLoadFailed(),
    });
  }

  /** 最终选中的图片 url */
  get imgList() {
    return this.imageListBuilder.imgList;
  }

  /** 最终选中的图片槽位 */
  get slotElements() {
    return this.imageListBuilder.slotElements;
  }

  /** 开始寻找页面图片 */
  start() {
    if (this.started) return;
    this.started = true;
    this.imageWatcher.start();
    void this.lazyLoadController.trigger();

    // options.initSelector 有值，但又找不到图片，说明网站结构发生变化
    // 需要当 initSelector 不存在，重新对网页上的所有图片进行扫描
    if (this.initSelector && this.imgSelector === this.initSelector) {
      this.selectorFallbackTimer = window.setTimeout(() => {
        if (querySelectorAll(this.imgSelector).length > 0) return;
        this.imgSelector = '';
        void this.lazyLoadController.trigger();
      }, SELECTOR_FALLBACK_TIMEOUT);
    }
  }

  /** 停止监听并清理资源 */
  stop() {
    this.started = false;
    this.generation++;
    this.structureDirty = false;
    this.handleChanged.clear();
    this.imageWatcher.stop();
    this.imageListBuilder.clear();
    this.imageSlotGroupManager.clear();
    this.lastScannedSelector = undefined;
    if (this.selectorFallbackTimer !== undefined)
      window.clearTimeout(this.selectorFallbackTimer);
    this.selectorFallbackTimer = undefined;
    this.lazyLoadController.clear();
    this.chapterSwitch = {};
  }

  /** 等到发现首张图片 */
  async waitFirstImage(timeout = 10 * 1000) {
    const list = await wait(
      () => (this.imgList.some(Boolean) ? [...this.imgList] : undefined),
      timeout,
    );
    if (!list?.length) throw new Error(t('site.changed_load_failed'));
    return list;
  }

  /** 手动触发一轮懒加载 */
  triggerLazyLoad() {
    this.start();
    return this.lazyLoadController.trigger();
  }

  /** 判断本轮是否需要重新扫描槽位组，返回原因 */
  private consumeRescanReason(
    map: Map<HTMLImageElement, ImageSizeInfo>,
  ):
    | 'structure'
    | 'selector'
    | 'noGroups'
    | 'newImgInGroup'
    | 'newImgInObserving'
    | undefined {
    const { structureDirty } = this;
    this.structureDirty = false;

    // DOM 结构刚发生过增删，容器层级可能变化
    if (structureDirty) return 'structure';
    // 当前生效的 selector 与上次扫描时不同（selector 回退或自动发现新 selector）
    if (this.imgSelector !== this.lastScannedSelector) return 'selector';

    const { groups } = this.imageSlotGroupManager;
    // 还没有任何组（首次扫描或组被清空）
    if (groups.length === 0) return 'noGroups';
    // 已有组内出现新的合格图片，组的覆盖范围可能变化
    if (this.hasNewQualifiedImageInsideGroups(map, groups))
      return 'newImgInGroup';
    // 观察候选容器内出现新的合格图片，可能凑齐成组条件
    if (this.imageSlotGroupManager.hasNewQualifiedImageInsideObserving(map))
      return 'newImgInObserving';
    return undefined;
  }

  /** 判断是否有新合格图片出现在现有 active groups 内部，是否需要重新扫描组 */
  private readonly hasNewQualifiedImageInsideGroups = (
    map: Map<HTMLImageElement, ImageSizeInfo>,
    groups: readonly ImageSlotGroup[],
  ) => {
    const covered = new Set<HTMLImageElement>();
    for (const group of groups)
      for (const img of group.coveredImgs) covered.add(img);

    for (const img of map.keys())
      if (
        !covered.has(img) &&
        groups.some((group) => group.parent.contains(img))
      )
        return true;
    return false;
  };

  /** 记录传入的图片元素中最常见的那个 selector（仅 initSelector 失效时） */
  private readonly saveImgEleSelector = (list: HTMLElement[]) => {
    // initSelector 仍生效时跳过
    if (
      list.length < 7 ||
      (this.initSelector && this.imgSelector === this.initSelector)
    )
      return;

    const newSelector = getMostItem(list.map(getEleSelector));
    if (newSelector !== this.imgSelector) {
      this.imgSelector = newSelector;
      this.onSelectorSuggest?.(newSelector);
    }
  };

  /** 图片集合变化时更新图片列表、章节按钮并触发懒加载 */
  private readonly handleChanged = throttle(
    singleThreaded(
      async (
        _state,
        map: Map<HTMLImageElement, ImageSizeInfo>,
        generation: number,
      ) => {
        if (generation !== this.generation) return;

        if (map.size === 0) {
          this.imageSlotGroupManager.clear();
          this.lastScannedSelector = undefined;
          this.imageListBuilder.clearListState();
          return this.onEmpty?.();
        }

        // 页面图片始终通过图片槽位组过滤；selector 只作为成组扫描的优先种子。
        const rescanReason = this.consumeRescanReason(map);
        if (rescanReason) {
          this.imageSlotGroupManager.scan(map, this.imgSelector || undefined);
          this.lastScannedSelector = this.imgSelector;
        }

        await this.syncImageList(generation);
        if (generation !== this.generation) return;

        // 完整的懒加载可能很耗时，所以不直接 await
        (async () => {
          await this.lazyLoadController.trigger();
          if (
            generation === this.generation &&
            this.imageSlotGroupManager.retryObserving()
          )
            await this.syncImageList(generation);
        })();
      },
      { latestOnly: true },
    ),
    500,
  );

  /** 将当前槽位组同步到图片列表 */
  private async syncImageList(generation: number) {
    const selectedSlots = this.imageSlotGroupManager.buildSlotElements();

    const { isEdited, isEmpty } = await this.imageListBuilder.update(
      selectedSlots,
      generation,
    );
    if (generation !== this.generation) return;
    if (isEmpty) return;

    if (isEdited) this.saveImgEleSelector(selectedSlots);

    this.chapterSwitch = getChapterSwitch();
    await this.onChapterSwitchChange?.({ ...this.chapterSwitch });
    if (generation !== this.generation) return;
    this.imageListBuilder.notifyFinalImgListChange(isEdited);
  }
}
