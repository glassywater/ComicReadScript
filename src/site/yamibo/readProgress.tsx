import { type CoreContext, request } from 'core';
import {
  createEffectOn,
  querySelector,
  querySelectorAll,
  useCache,
} from 'helper';
import { Show, createMemo, createSignal } from 'solid-js';
import { render } from 'solid-js/web';

import {
  type ThreadProgress,
  type YamiboOptions,
  type YamiboPageContext,
} from './helper';

// 记录阅读进度
export const readProgress = async (
  _: CoreContext<YamiboOptions>,
  pageCtx: YamiboPageContext,
) => {
  if (pageCtx.type === 'thread') {
    const { tid } = pageCtx;

    /** 回复数 */
    let allReplies: number | undefined;
    try {
      const res = await request(
        `/api/mobile/index.php?module=viewthread&tid=${tid}`,
        {
          responseType: 'json',
          errorText: '获取帖子回复数时出错',
          noTip: true,
        },
      );
      // oxlint-disable-next-line unicorn/prefer-number-coercion
      allReplies = Number.parseInt(
        res.response?.Variables?.thread?.allreplies,
        10,
      );
    } catch {}

    /** 当前所在页数 */
    // oxlint-disable-next-line unicorn/prefer-number-coercion
    const currentPageNum = Number.parseInt(
      querySelector('#pgt strong')?.textContent ??
        querySelector<HTMLSelectElement>('#dumppage')?.value ??
        '1',
      10,
    );

    const cache = await useCache<{ history: ThreadProgress }>({
      history: 'tid',
    });
    const data = await cache.get('history', `${tid}`);
    // 如果是在翻阅之前页数的内容，则跳过不处理
    if (data && currentPageNum < data.lastPageNum) return;

    // 如果有上次阅读进度的数据，则监视上次的进度之后的楼层，否则监视所有
    /** 监视楼层列表 */
    const watchFloorList = querySelectorAll(
      data?.lastAnchor && currentPageNum === data.lastPageNum
        ? `#${data.lastAnchor} ~ div`
        : '#postlist > div, .plc.cl',
    );
    if (watchFloorList.length === 0) return;

    let id = 0;
    /** 储存数据，但是防抖 */
    const debounceSave = (saveData: ThreadProgress) => {
      if (id) window.clearTimeout(id);
      id = window.setTimeout(async () => {
        id = 0;
        await cache.set('history', saveData);
      }, 200);
    };

    // 在指定楼层被显示出来后重新存储进度数据
    const observer = new IntersectionObserver(
      (entries) => {
        // 找到触发楼层
        const trigger = entries.find((e) => e.isIntersecting);
        if (!trigger) return;

        // 取消触发楼层上面楼层的监视
        const triggerIndex = watchFloorList.indexOf(
          trigger.target as HTMLElement,
        );
        if (triggerIndex === -1) return;
        for (const e of watchFloorList.splice(0, triggerIndex + 1))
          observer.unobserve(e);

        // 储存数据
        debounceSave({
          tid: `${tid}`,
          lastPageNum: currentPageNum,
          lastReplies: allReplies || data?.lastReplies || 0,
          lastAnchor: trigger.target.id,
        });
      },
      { rootMargin: '-160px' },
    );
    for (const e of watchFloorList) observer.observe(e);

    return () => observer.disconnect();
  }

  // 在板块页显示阅读进度标签
  if (pageCtx.type === 'forum') {
    const { isMobile } = pageCtx;
    const cache = await useCache<{ history: ThreadProgress }>({
      history: 'tid',
    });

    const [updateFlag, setUpdateFlag] = createSignal(false);
    const updateHistoryTag = () => setUpdateFlag((val) => !val);

    const { listSelector, getTid, getUrl } = isMobile
      ? {
          listSelector: '.threadlist li.list',
          getTid: (e: HTMLElement) =>
            new URLSearchParams(e.children[1].getAttribute('href')!).get(
              'tid',
            )!,
          getUrl: (data: ThreadProgress, tid: string) =>
            `forum.php?mod=viewthread&tid=${tid}&extra=page%3D1&mobile=2&page=${data.lastPageNum}#${data.lastAnchor}`,
        }
      : {
          listSelector: 'tbody[id^=normalthread]',
          getTid: (e: HTMLElement) => e.id.split('_')[1],
          getUrl: (data: ThreadProgress, tid: string) =>
            `thread-${tid}-${data.lastPageNum}-1.html#${data.lastAnchor}`,
        };

    for (const e of querySelectorAll(listSelector)) {
      const tid = getTid(e);

      render(
        () => {
          const [data, setData] = createSignal<ThreadProgress | undefined>();

          createEffectOn(updateFlag, () =>
            cache.get('history', tid).then(setData),
          );

          const url = createMemo(() => (data() ? getUrl(data()!, tid) : ''));

          const lastReplies = createMemo(() =>
            !isMobile && data()
              ? Number(e.querySelector('.num a')!.innerHTML) -
                data()!.lastReplies
              : 0,
          );

          return (
            <Show when={Boolean(data())}>
              {isMobile ? (
                <li>
                  <a
                    onClick={unsafeWindow.atarget}
                    href={url()}
                    style={{ color: 'unset' }}
                  >
                    回第{data()?.lastPageNum}页
                  </a>
                  {/* 因为移动版的回复数貌似有延迟，显示不准，所以移动版上不提示 lastReplies */}
                </li>
              ) : (
                <>
                  <a
                    class="historyTag"
                    onClick={unsafeWindow.atarget}
                    href={url()}
                  >
                    回第{data()?.lastPageNum}页{' '}
                  </a>
                  <Show when={lastReplies() > 0}>
                    <div class="historyTag">+{lastReplies()}</div>
                  </Show>
                </>
              )}
            </Show>
          );
        },
        isMobile ? e.children[3] : e.getElementsByTagName('th')[0],
      );
    }

    // 切换回当前页时更新提示
    document.addEventListener('visibilitychange', updateHistoryTag);
    // 点击下一页后更新提示
    querySelector('#autopbn')?.addEventListener('click', updateHistoryTag);

    return () =>
      document.removeEventListener('visibilitychange', updateHistoryTag);
  }
};
