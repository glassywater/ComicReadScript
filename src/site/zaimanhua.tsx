import { request, setup, toast } from 'core';
import {
  log,
  querySelector,
  querySelectorAll,
  querySelectorClick,
  sleep,
  t,
  wait,
} from 'helper';

import { getZaiManHuaCommentList } from '../userscript/zaimanhuaApi';

if (location.hostname === 'm.zaimanhua.com') {
  // 再漫画移动端
  const api = async <T,>(apiPath: string): Promise<T> => {
    const res = await request(
      `https://v4api.zaimanhua.com/app/v1/comic${apiPath}?_v=15`,
      { responseType: 'json' },
    );
    if (res.response.errno)
      toast.error(`${t('alert.comic_load_error')}: ${res.response.errmsg}`, {
        throw: true,
      });
    return res.response.data.data as T;
  };

  const getPageData = (comicId: number, chapterId: number) =>
    api<{
      page_url: string[];
      page_url_hd: string[];
    }>(`/chapter/${comicId}/${chapterId}`);

  const getComicData = (comicId: number) =>
    api<{
      chapters: { data: { chapter_id: number; chapter_order: number }[] }[];
    }>(`/detail/${comicId}`);

  setup({
    name: 'zaiManHua',
    isMangaPage: () => {
      if (location.pathname !== '/pages/comic/page') return false;

      const urlParams = new URLSearchParams(location.search);
      const comicId = Number(urlParams.get('comic_id'));
      const chapterId = Number(urlParams.get('chapter_id'));
      if (!comicId || !chapterId)
        throw new Error(t('site.changed_load_failed'));
      return { comicId, chapterId };
    },
    async getImgList({ setState }, { comicId, chapterId }) {
      const comicData = await getComicData(comicId);

      // 顺手用数据设置下章节跳转
      const chapter = (
        comicData.chapters.length === 1
          ? comicData.chapters[0]
          : comicData.chapters.find((chapter) =>
              chapter.data.find((data) => data.chapter_id === chapterId),
            )!
      ).data.toSorted((a, b) => a.chapter_order - b.chapter_order);
      const chapterIndex = chapter.findIndex(
        ({ chapter_id }) => chapter_id === chapterId,
      );
      const createChapterNav = (targetIndex: number) =>
        targetIndex in chapter
          ? () =>
              location.assign(
                `/pages/comic/page?comic_id=${comicId}&chapter_id=${chapter[targetIndex].chapter_id}`,
              )
          : undefined;
      setState('manga', {
        onPrev: createChapterNav(chapterIndex - 1),
        onNext: createChapterNav(chapterIndex + 1),
      });

      const pageData = await getPageData(comicId, chapterId);
      return pageData.page_url_hd;
    },
    handler: ({ setState }, { comicId, chapterId }) => {
      // 评论异步获取，不影响其他功能
      void (async () => {
        try {
          const comments = await getZaiManHuaCommentList(comicId, chapterId);
          if (comments.length > 0) setState('manga', 'commentList', comments);
        } catch (error) {
          log.error(error);
        }
      })();
    },
  });
} else {
  // 再漫画 PC 端
  setup({
    name: 'zaiManHua',
    isMangaPage: async () => {
      if (!location.pathname.startsWith('/view/')) return false;
      await wait(() => Boolean(querySelector('.scrollbar-demo-item')));
      return true;
    },
    getImgList: async () => {
      // 切换到上下滚动
      await wait(() => {
        const dom = querySelector('#qiehuan_txt');
        if (!dom) return;
        if (dom.textContent !== '切换到上下滚动阅读') return true;
        dom.click();
        return sleep(1000);
      });
      return querySelectorAll<HTMLImageElement>('.scrollbar-demo-item img').map(
        (img) => img.src,
      );
    },
    onNext: () => querySelectorClick('#next_chapter'),
    onPrev: () => querySelectorClick('#prev_chapter'),
    handler: ({ setState }) => {
      const [, , , comicId, chapterId] = location.pathname.split('/');
      if (!comicId || !chapterId)
        throw new Error(t('site.changed_load_failed'));

      // 评论异步获取，不影响其他功能
      void (async () => {
        try {
          const comments = await getZaiManHuaCommentList(comicId, chapterId);
          if (comments.length > 0) setState('manga', 'commentList', comments);
        } catch (error) {
          log.error(error);
        }
      })();
    },
  });
}
