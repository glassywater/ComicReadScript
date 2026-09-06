import { setupSiteAdapter } from 'core';
import { querySelectorAll } from 'helper';

let current = 0;
// 轮流使用不同服务器来分流
const domain = () => {
  current = (current % 4) + 1;
  return `wx${current}.sinaimg.cn`;
};
/** 通过 pid 构建图片 url */
const imgUrl = (pid: string | null | undefined) =>
  pid && `https://${domain()}/large/${pid}.jpg`;

setupSiteAdapter({
  name: 'weibo',
  options: { autoShow: false },
  getPageContext: () => {
    const match =
      /^(?:\/(?<isTarticle>ttarticle\/p\/show)|\/(?<isDetail>\d+\/[A-Za-z0-9]+))$/u.exec(
        location.pathname,
      )?.groups;

    if (match?.isTarticle)
      return {
        type: 'tarticle',
        isManga: true,
        id: new URLSearchParams(location.search).get('id'),
      };
    else if (match?.isDetail)
      return { type: 'detail', isManga: true, id: location.pathname };
  },
  handlers: {
    tarticle: ({ setState }) => {
      const getImgList = () =>
        querySelectorAll<HTMLImageElement>(
          '[node-type="articleContent"] figure img',
        ).map((e) => imgUrl(e.getAttribute('pid')) || e.src);
      setState('comicMap', '', { getImgList });
    },
    detail: ({ setState }) => {
      const getImgList = () =>
        querySelectorAll<HTMLImageElement>(
          '.woo-box-wrap .woo-picture-img',
        ).map(
          (e) =>
            imgUrl(/(?<pid>[^/]+)\.jpg$/u.exec(e.src)?.groups?.pid) || e.src,
        );
      setState('comicMap', '', { getImgList });
    },
  },
});
