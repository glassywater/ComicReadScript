import { requestIdleCallback } from '../other';
import { debounce } from '../throttleDebounce';
import {
  canCheckForStyle,
  getDarkByFastPath,
  isDarkBySampling,
} from './detect';

/** 网站色调检测状态机 */
export class SiteDarkDetector {
  private readonly selfDomSet = new WeakSet<Element>();

  private started = false;
  /** 采样是否正在进行 */
  private sampling = false;
  /** 上一次结论是否来自快路径；用于识别站点移除主题标记的情况 */
  private lastFromFastPath = false;
  private waitObserver: MutationObserver | undefined;
  private readyStateHandler: (() => void) | undefined;
  private themeObserver: MutationObserver | undefined;

  private readonly getSiteDark: () => boolean | undefined;
  /** 检测出网站色调时的回调 */
  private readonly onDark: (dark: boolean) => void;

  constructor(
    getSiteDark: () => boolean | undefined,
    onDark: (dark: boolean) => void,
  ) {
    this.getSiteDark = getSiteDark;
    this.onDark = onDark;
  }

  /** 登记脚本自身挂载的 DOM，避免影响采样 */
  registerSelfDom = (el: Element) => {
    this.selfDomSet.add(el);
  };

  /** 启动网站色调检测，幂等，重复调用无副作用 */
  start = () => {
    if (this.started) return;
    this.started = true;
    this.detect();
  };

  private readonly detect = () => {
    const fastResult = getDarkByFastPath();
    if (fastResult !== undefined) {
      this.lastFromFastPath = true;
      this.onDark(fastResult);
      this.startThemeObserver();
      return;
    }

    if (!canCheckForStyle()) return this.waitReady();

    void this.sample();
  };

  /** 等到页面就绪后再检测，避免「先白后黑」的误判 */
  private readonly waitReady = () => {
    if (this.waitObserver) return;
    this.waitObserver = new MutationObserver(() => {
      if (canCheckForStyle()) {
        this.stopWait();
        this.detect();
      }
    });
    this.waitObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    if (document.readyState !== 'complete') {
      this.readyStateHandler = () => {
        if (document.readyState !== 'complete') return;
        this.stopWait();
        this.detect();
      };
      document.addEventListener('readystatechange', this.readyStateHandler);
    }
  };

  private readonly stopWait = () => {
    this.waitObserver?.disconnect();
    this.waitObserver = undefined;
    if (this.readyStateHandler) {
      document.removeEventListener('readystatechange', this.readyStateHandler);
      this.readyStateHandler = undefined;
    }
  };

  private readonly sample = async () => {
    if (this.sampling) return;
    this.sampling = true;
    try {
      // 采样有一定开销，等到空闲时再执行
      await new Promise<void>((resolve) =>
        requestIdleCallback(() => resolve(), 2000),
      );
      this.lastFromFastPath = false;
      this.onDark(isDarkBySampling(this.selfDomSet));
      this.startThemeObserver();
    } finally {
      this.sampling = false;
    }
  };

  /** 监听 html / body 的主题标记变化，应对站点在检测后才切换主题的情况 */
  private readonly startThemeObserver = () => {
    if (this.themeObserver) return;
    const recheck = debounce(() => {
      if (this.sampling) return;
      const fastResult = getDarkByFastPath();
      if (fastResult !== undefined) {
        this.lastFromFastPath = true;
        if (fastResult !== this.getSiteDark()) this.onDark(fastResult);
        return;
      }
      // 之前的结论来自快路径、现在标记却消失了，说明站点切换了主题，需要重新采样
      if (this.lastFromFastPath) void this.sample();
    }, 500);

    this.themeObserver = new MutationObserver(recheck);
    for (const target of [document.documentElement, document.body]) {
      if (!target) continue;
      this.themeObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
    }
  };
}
