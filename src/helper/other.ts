import { type Promisable } from 'type-fest';

import { singleThreaded, wait } from './asyncControl';

const CRSD: Record<string, unknown> = {};
/** 将调试变量挂到全局 CRSD 对象上 */
export const exposeToGlobal = (obj: Record<string, unknown>) => {
  if (!isDevMode) return;
  if (typeof window !== 'undefined' && typeof unsafeWindow !== 'undefined')
    Object.assign(unsafeWindow ?? window, { CRSD });
  Object.assign(CRSD, obj);
};

export const getFileName = (url: string) =>
  /.+\/(?<name>[^?]+)/u.exec(url)?.groups?.name;

/** 找出数组中出现最多次的元素 */
export const getMostItem = <T>(list: T[]) => {
  const counts = new Map<T, number>();
  for (const val of list) counts.set(val, (counts.get(val) ?? 0) + 1);

  return [...counts.entries()].reduce((maxItem, item) =>
    maxItem[1] > item[1] ? maxItem : item,
  )[0];
};

/** 判断字符串是否为 URL */
export const isUrl = (text: string) => {
  // 等浏览器版本上来后可以直接使用 URL.canParse
  try {
    return Boolean(new URL(text));
  } catch {
    return false;
  }
};

/** 将 blob 数据作为文件保存至本地 */
export const saveAs = (blob: Blob, name = 'download') => {
  const a = document.createElementNS(
    'http://www.w3.org/1999/xhtml',
    'a',
  ) as HTMLAnchorElement;
  a.download = name;
  a.rel = 'noopener';
  a.href = URL.createObjectURL(blob);
  setTimeout(() => a.dispatchEvent(new MouseEvent('click')));
};

/**
 * 判断使用参数颜色作为默认值时是否需要切换为黑暗模式
 * @param hexColor 十六进制颜色。例如 #112233
 */
export const needDarkMode = (hexColor: string) => {
  // by: https://24ways.org/2010/calculating-color-contrast
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
};

export const clamp = (min: number, val: number, max: number) =>
  Math.max(Math.min(max, val), min);

export const inRange = (min: number, val: number, max: number) =>
  val >= min && val <= max;

/** 判断两个数是否在指定误差范围内相等 */
export const approx = (val: number, target: number, range = 1) =>
  Math.abs(target - val) <= range;

/** 等到指定 selector 匹配到指定数量的 dom 元素 */
export function waitDom(
  selector: string,
  count?: number,
): Promise<HTMLElement[]>;
export function waitDom(
  selector: string,
  count?: number,
  timeout?: number,
): Promise<HTMLElement[] | undefined>;
export function waitDom(selector: string, count = 1, timeout?: number) {
  return wait(() => {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    return elements.length >= count ? [...elements] : undefined;
  }, timeout);
}

/** 将指定的布尔值转换为字符串或未定义 */
export const boolDataVal = (val: boolean | undefined) => (val ? '' : undefined);

export const requestIdleCallback = (
  callback: IdleRequestCallback,
  timeout?: number,
) => {
  if (Reflect.has(window, 'requestIdleCallback'))
    return window.requestIdleCallback(callback, { timeout });
  return window.setTimeout(callback, 16);
};

/** 获取键盘事件的编码 */
export const getKeyboardCode = (e: KeyboardEvent) => {
  let { key } = e;
  switch (key) {
    case 'Shift':
    case 'Control':
    case 'Alt':
      return key;
  }

  key = key.replaceAll(/\b[A-Z]\b/gu, (match) => match.toLowerCase());
  if (e.ctrlKey) key = `Ctrl + ${key}`;
  if (e.altKey) key = `Alt + ${key}`;
  if (e.shiftKey) key = `Shift + ${key}`;
  return key;
};

/** 将快捷键的编码转换成更易读的形式 */
export const keyboardCodeToText = (code: string) =>
  code
    .replace('Control', 'Ctrl')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
    .replace(/^\s$/u, 'Space');

/**
 * 劫持修改原网页上的函数
 *
 * 如果传入函数的所需参数为零，将在原函数执行完后自动调用
 */
export const hijackFn = <T extends unknown[] = unknown[], R = unknown>(
  fnName: string,
  fn: (rawFn: (...args: T) => R, args: T) => R,
) => {
  const rawFn = unsafeWindow[fnName] as (...args: T) => R;
  unsafeWindow[fnName] =
    fn.length === 0
      ? (...args: T) => {
          const res = rawFn(...args);
          (fn as () => R)();
          return res;
        }
      : (...args: T) => fn(rawFn, args);
};

/**
 * 确保指定 key 的值一定存在
 * 如果对应值不存在，则使用 defaultValue 来设置值，然后返回该值
 * defaultValue 可以是默认值，或者返回默认值的函数
 * 也可以是使用了 GM.setValue 来设置默认值的函数（此时也会返回被设置的值）
 */
export const ensureGmValue = async <
  T extends string | number | object = string,
>(
  name: string,
  defaultValue: string | (() => Promisable<void | string>),
): Promise<T> => {
  const value = await GM.getValue<T>(name);
  if (value !== undefined) return value;

  if (typeof defaultValue !== 'function') {
    await GM.setValue(name, defaultValue);
    return defaultValue as T;
  }

  const fnRes = await defaultValue();
  if (fnRes !== undefined) {
    await GM.setValue(name, fnRes);
    return fnRes as T;
  }
  return (await GM.getValue(name)) as T;
};

/** 监听 url 变化 */
export const onUrlChange = (
  fn: (lastUrl: string, nowUrl: string) => Promisable<void>,
  handleUrl = (location: Location) => location.href,
) => {
  let lastUrl = '';
  const refresh = singleThreaded(async () => {
    if (!(await wait(() => handleUrl(location) !== lastUrl, 5000))) return;
    const nowUrl = handleUrl(location);
    await fn(lastUrl, nowUrl);
    lastUrl = nowUrl;
  });

  const controller = new AbortController();
  for (const eventName of ['click', 'popstate'])
    window.addEventListener(eventName, refresh, {
      capture: true,
      signal: controller.signal,
    });
  void refresh();

  return () => controller.abort();
};

/** wait，但是只在 url 变化时判断 */
export const waitUrlChange = <T = unknown>(isValidUrl: () => T) =>
  new Promise<NonNullable<T>>((resolve) => {
    const abort = onUrlChange(async () => {
      const res = await isValidUrl();
      if (!res) return;
      resolve(res);
      abort();
    });
  });

export abstract class AnimationFrame {
  animationId = 0;
  abstract frame: (timestamp: DOMHighResTimeStamp) => void;

  call = (force?: boolean) => {
    if (!force && this.animationId) return;
    this.animationId = requestAnimationFrame(this.frame);
  };

  cancel = () => {
    if (!this.animationId) return;
    cancelAnimationFrame(this.animationId);
    this.animationId = 0;
  };
}

/** 锁定屏幕禁止自动熄屏 */
export class WakeLock {
  isSupported = false;

  lock: WakeLockSentinel | null = null;

  constructor() {
    if (!('wakeLock' in navigator)) return;
    this.isSupported = true;
  }

  on = async () => {
    if (!this.isSupported) return null;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      return this.lock.released;
    } catch {
      return false;
    }
  };

  off = async () => {
    if (!this.lock) return;
    await this.lock.release();
    this.lock = null;
  };
}

export const withEventStop =
  <T extends Event>(handler?: (e: T) => void) =>
  (e: T) => {
    e.stopPropagation();
    e.preventDefault();
    if (handler) handler(e);
  };

/** 判断版本号1是否小于版本号2 */
export const versionLt = (version1: string, version2: string) => {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const num1 = v1[i] ?? 0;
    const num2 = v2[i] ?? 0;
    if (num1 !== num2) return num1 < num2;
  }
  return false;
};

/**
 * 用于书写 GraphQL 查询的模板标签函数
 *
 * 变量值应通过 GraphQL 变量语法（$varName）与 variables 传递
 */
export const gql = (strings: TemplateStringsArray, ...values: string[]) =>
  strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');

/** 尽量模拟 Windows 资源管理器的默认文件名排序行为 */
export const getNaturalCollator = () =>
  // 为了在「中日韩英」四语下都能稳定，要使用 ja-JP，避免 zh 的多音字问题
  new Intl.Collator('ja-JP', {
    numeric: true,
    sensitivity: 'base',
  });
