import { request, setup } from 'core';
import { querySelectorClick } from 'helper';

const apiUrl = () => {
  const apiPath = /\/comic\/.+/u.exec(location.pathname)?.[0] ?? '';
  return `https://comic.hypergryph.com/api${apiPath}`;
};

const loadImg = async (i: number) => {
  const res = await request(`${apiUrl()}/page?pageNum=${i + 1}`);
  return JSON.parse(res.responseText).data.url as string;
};

const handlePrevNext = (text: string) =>
  querySelectorClick('footer button:not([disabled]) a', text);

setup({
  name: 'terraHistoricus',
  isMangaPage: () => location.href.includes('episode') && { id: location.href },
  async getImgList({ dynamicLazyLoad }) {
    const res = await request<{ data: { pageInfos: unknown[] } }>(apiUrl(), {
      responseType: 'json',
    });
    const pageList = res.response.data.pageInfos;
    if (pageList.length === 0 && location.pathname.includes('episode'))
      throw new Error('获取图片列表时出错');
    return dynamicLazyLoad({ loadImg, length: pageList.length });
  },
  onPrev: () => handlePrevNext('上一'),
  onNext: () => handlePrevNext('下一'),
});
