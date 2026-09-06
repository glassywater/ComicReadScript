import { request, setupSiteAdapter, toast } from 'core';
import { css, querySelector, querySelectorAll } from 'helper';

import {
  type YamiboOptions,
  type YamiboPageContext,
  featureOptions,
  getPageContext,
} from './helper';
import { readProgress } from './readProgress';
import { threadHandler } from './thread';

// 多页
// https://bbs.yamibo.com/thread-43598-2-694.html
// 目录页
// https://bbs.yamibo.com/thread-496210-1-1.html

setupSiteAdapter<YamiboPageContext, YamiboOptions>({
  name: 'yamibo',
  options: featureOptions,
  getPageContext,
  handlers: {
    all: () => {
      css`
        #fab {
          --fab: #6e2b19;
        }

        .historyTag {
          border: 2px solid #6e2b19;
          white-space: nowrap;
        }

        a.historyTag {
          margin-left: 1em;
          padding: 1px 4px;
          border-radius: 4px 0 0 4px;

          font-weight: bold;
          color: #6e2b19;
        }

        a.historyTag:last-child {
          border-radius: 4px;
        }

        div.historyTag {
          display: initial;

          margin-left: -0.4em;
          padding: 1px;
          border-radius: 0 4px 4px 0;

          color: #ffedbb;

          background-color: #6e2b19;
        }

        #threadlisttableid tbody:nth-child(2n) div.historyTag {
          color: #fff6d7;
        }

        /* 将「回复/查看」列加宽一点 */
        .tl .num {
          width: 80px !important;
        }
      `;
    },

    thread: threadHandler,
  },
  features: {
    固定导航条: () =>
      css`
        .header-stackup {
          position: fixed !important;
        }
      `,

    关闭快捷导航的跳转: () =>
      querySelector('#qmenu a')?.setAttribute('href', 'javascript:;'),

    修正点击页数时的跳转判定: (_, pageCtx) => {
      if (pageCtx.type !== 'forum') return;
      const list = querySelectorAll('.tps>a');
      let i = list.length;
      while (i--) list[i].setAttribute('onClick', 'atarget(this)');
    },

    自动签到: async () => {
      if (!unsafeWindow.discuz_uid || unsafeWindow.discuz_uid === '0') return;

      const todayString = new Date().toLocaleDateString('zh-CN');
      // 判断当前日期与上次成功签到日期是否相同
      if (todayString === localStorage.getItem('signDate')) return;

      const sign = querySelector<HTMLInputElement>(
        '#scbar_form > input[name="formhash"]',
      )?.value;
      if (!sign) return;

      try {
        const res = await fetch(`plugin.php?id=zqlj_sign&sign=${sign}`);
        const body = await res.text();
        if (!/成功！|打过卡/u.test(body)) throw new Error('自动签到失败');
        toast.success('自动签到成功');
        localStorage.setItem('signDate', todayString);
      } catch {
        toast.error('自动签到失败');
      }
    },

    记录阅读进度: readProgress,

    移动端显示帖子权限: async (_, pageCtx) => {
      if (pageCtx.type !== 'forum' || !pageCtx.isMobile) return;

      const apiUrl = new URL(location.href);
      apiUrl.pathname = '/api/mobile/index.php';
      apiUrl.searchParams.set('module', apiUrl.searchParams.get('mod')!);
      apiUrl.searchParams.delete('mod');

      const res = await request<{
        Variables: {
          forum_threadlist: { tid: string; readperm: string }[];
        };
      }>(`${apiUrl}`, {
        responseType: 'json',
        errorText: '获取帖子权限时出错',
      });

      const readpermMap = new Map<number, number>();
      for (const { tid, readperm } of res.response.Variables.forum_threadlist)
        if (readperm !== '0') readpermMap.set(Number(tid), Number(readperm));

      for (const item of querySelectorAll('.threadlist li.list')) {
        const a = item.querySelector<HTMLAnchorElement>('a[href*="&tid="]')!;
        const tid = Number(new URLSearchParams(a.href).get('tid')!);
        if (!readpermMap.has(tid)) continue;
        item
          .querySelector('.threadlist_foot li.mr')!
          .insertAdjacentHTML(
            'beforeend',
            `<span style="margin-right: .5em; color: #EE1B2E">#权限${readpermMap.get(tid)}</span>`,
          );
      }
    },
  },
});
