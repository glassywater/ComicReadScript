import { type Promisable } from 'type-fest';

import { singleThreaded, sleep, wait } from './asyncControl';

const claimUrlEvent = 'comic-read:url-change';
let expectedUrl: string | undefined;

/** 标记一次由脚本接管的 url 变更，让 onUrlChange 不将其视为发生了变更 */
export const claimUrlChange = (url: string) => {
  expectedUrl = new URL(url, location.origin).href;
  window.dispatchEvent(new Event(claimUrlEvent));
};

/** 监听 url 变化 */
export const onUrlChange = (
  fn: (lastUrl: string, nowUrl: string) => Promisable<void>,
  handleUrl = (location: Location) => location.href,
) => {
  let lastUrl = '';
  const refresh = singleThreaded(
    async () => {
      if (!(await wait(() => handleUrl(location) !== lastUrl, 5000))) return;
      // 浏览器是先更新 url 再派发 popstate，轮询若恰好插在两者的间隙中命中，
      // 不等待就会漏掉刚设置的标记，导致误判触发
      // 所以这里等待一下，让同批 popstate 事件的监听器先调用 claimUrlChange
      await sleep(0);
      const nowUrl = handleUrl(location);

      // 脚本主动变更的 url 不算页面变化，跳过回调；
      // 无论是否命中都清除标记，防止残留导致误判后续导航
      if (expectedUrl !== undefined) {
        const hit = expectedUrl === nowUrl;
        expectedUrl = undefined;
        if (hit) {
          lastUrl = nowUrl;
          return;
        }
      }

      await fn(lastUrl, nowUrl);
      lastUrl = nowUrl;
    },
    // url 总是实时读取，所以积压的条目只需保留最后一个
    { latestOnly: true },
  );

  const controller = new AbortController();
  for (const eventName of ['click', 'popstate', claimUrlEvent])
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
