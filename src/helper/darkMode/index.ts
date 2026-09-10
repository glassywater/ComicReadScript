import { type Accessor, createSignal } from 'solid-js';

import { createRootMemo } from '../solidJs';
import { SiteDarkDetector } from './detector';

// #region 全局色调状态

const [getSiteDark, setSiteDark] = createSignal<boolean | undefined>(undefined);
const [getManualDark, setManualDarkSignal] = createSignal<boolean | undefined>(
  undefined,
);

/**
 * 网站自身是否为深色调
 *
 * undefined 表示尚未检测出结果
 */
export const siteDark: Accessor<boolean | undefined> = getSiteDark;

/**
 * 用户手动设置的色调
 *
 * undefined 表示未手动设置，将跟随网站色调
 */
export const manualDark: Accessor<boolean | undefined> = getManualDark;

/**
 * 手动设置色调
 *
 * 传入 undefined 清除设置，恢复跟随网站
 */
export const setManualDark = (val: boolean | undefined) =>
  setManualDarkSignal(val);

/** 当前应用应使用的色调 */
export const effectiveDark: Accessor<boolean> = createRootMemo(
  () => manualDark() ?? siteDark() ?? false,
);

// #endregion

const detector = new SiteDarkDetector(
  () => siteDark(),
  (dark) => setSiteDark(dark),
);

/** 登记脚本自身挂载的 DOM，避免影响采样 */
export const registerSelfDom = (el: Element) => detector.registerSelfDom(el);

/** 启动网站色调检测，幂等，重复调用无副作用 */
export const startDetectSiteDark = () => detector.start();
