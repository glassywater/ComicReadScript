import { querySelector } from 'helper';

export const featureOptions = {
  记录阅读进度: true,
  关闭快捷导航的跳转: true,
  修正点击页数时的跳转判定: true,
  固定导航条: true,
  自动签到: true,
  移动端显示帖子权限: true,
};

export type YamiboOptions = typeof featureOptions;

export type ThreadProgress = {
  tid: string;
  lastPageNum: number;
  lastReplies: number;
  lastAnchor: string;
};

/** 从 URL 字符串中提取 fid */
export const extractFid = (url: string | undefined): number | undefined => {
  if (!url) return undefined;
  const fid = new URLSearchParams(url).get('fid');
  return fid ? Number(fid) : undefined;
};

export const getPageContext = () => {
  // 判断当前页是帖子
  if (/thread(?:-\d+){3}|mod=viewthread/u.test(document.URL)) {
    const tid =
      unsafeWindow.tid ??
      new URLSearchParams(location.search).get('tid') ??
      /\/thread-(?<tid>\d+)-\d+-\d+.html/u.exec(location.pathname)?.groups?.tid;
    if (!tid) return;

    const fid =
      unsafeWindow.fid ||
      extractFid(location.search) ||
      extractFid(
        querySelector<HTMLAnchorElement>('h2 > a, .bm.cl a[href*="fid="]')
          ?.href,
      );
    const isManga = fid === 30 || fid === 37;
    const pageContext = { type: 'thread', tid, fid, isManga } as const;
    return pageContext;
  }

  // 判断当前页是板块
  if (/forum(?:-\d+){2}|mod=forumdisplay/u.test(document.URL)) {
    const isMobile = !document.querySelector('#flk');
    const pageContext = { type: 'forum', isMobile } as const;
    return pageContext;
  }
};

export type YamiboPageContext = NonNullable<ReturnType<typeof getPageContext>>;
