import { request, setup } from 'core';
import {
  querySelector,
  querySelectorAll,
  querySelectorClick,
  range,
  wait,
} from 'helper';

if (location.hostname === 'noy1.top') {
  // noy1.top 是 hash 路由的 SPA
  setup({
    name: 'NoyAcg',
    isMangaPage: () =>
      location.hash.startsWith('#/read/') && { id: location.hash },
    async getImgList() {
      const [, , id] = location.hash.split('/');

      // 随便拿一个图片来获取 cdn url
      const img = await wait(() =>
        querySelector<HTMLImageElement>('.lazy-load-image-background img'),
      );
      const [cdn] = img.src.split(id);

      const imgNum = await wait(
        () => querySelectorAll('.lazy-load-image-background').length,
      );
      return range(imgNum, (i) => `${cdn}${id}/${i + 1}.webp`);
    },
  });
} else {
  setup({
    name: 'NoyAcg',
    isMangaPage: () =>
      // 单章漫画的章节号为 0，例如 /reader/13349/0
      /reader\/(?<bookId>\d+)\/(?<chapterId>\d+)/u.exec(location.pathname)
        ?.groups as { bookId: string; chapterId: string },
    getImgList: async (_, { bookId, chapterId }) => {
      // https://noymanga.com/reader/13349
      /** 本子等单章作品返回的数据 */
      type NoySingleRes = { data: { count: number } };

      // https://noymanga.com/reader/60142/582549
      /** 有章节的作品返回的数据 */
      type NoyChapterRes = NoySingleRes & {
        chapter: { this: { count: number } };
      };

      const { response } = await request<NoyChapterRes | NoySingleRes>(
        `/api/v4/book/detail/${bookId}/${chapterId}`,
        { responseType: 'json' },
      );
      const isChapter = 'chapter' in response;
      const count = isChapter
        ? response.chapter.this.count
        : response.data.count;
      const imgPrefix = isChapter ? `${bookId}/${chapterId}` : bookId;
      return range(
        count,
        (i) => `https://img.noymanga.com/${imgPrefix}/${i + 1}.webp`,
      );
    },
    onPrev: () =>
      querySelectorClick(() =>
        querySelector('path[d="m15 18-6-6 6-6"]')?.closest('button'),
      ),
    onNext: () =>
      querySelectorClick(() =>
        querySelector('path[d="m9 18 6-6-6-6"]')?.closest('button'),
      ),
  });
}
