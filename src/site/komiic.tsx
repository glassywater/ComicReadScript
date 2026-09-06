import { request, setup } from 'core';
import { gql, querySelectorClick } from 'helper';

const query = gql`
  query imagesByChapterId($chapterId: ID!) {
    imagesByChapterId(chapterId: $chapterId) {
      id
      kid
      height
      width
      __typename
    }
  }
`;

const getChapterNav = (text: string) =>
  querySelectorClick(
    '.v-bottom-navigation__content button:not([disabled])',
    text,
  );

setup({
  name: 'Komiic',
  isMangaPage: () => {
    const match =
      /^\/comic\/(?<comicId>\d+)\/chapter\/(?<chapterId>\d+)\//u.exec(
        location.pathname,
      )?.groups as { comicId: string; chapterId: string } | null;
    return match ?? false;
  },
  getImgList: async (_, { chapterId }) => {
    const res = await request('/api/query', {
      method: 'POST',
      responseType: 'json',
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({
        operationName: 'imagesByChapterId',
        variables: { chapterId },
        query,
      }),
    });
    return (res.response.data.imagesByChapterId as { kid: string }[]).map(
      ({ kid }) => `/api/image/${kid}`,
    );
  },
  onPrev: () => getChapterNav('上一'),
  onNext: () => getChapterNav('下一'),
});
