import { request, setup } from 'core';
import { querySelectorClick } from 'helper';

setup({
  name: 'MangaDex',
  isMangaPage: () =>
    /^\/chapter\/(?<id>[^/]+)/u.exec(location.pathname)?.groups as
      | { id: string }
      | undefined,
  async getImgList() {
    const chapter_id = location.pathname.split('/').at(2);
    const {
      response: {
        baseUrl,
        chapter: { data, hash },
      },
    } = await request<{
      baseUrl: string;
      chapter: { data: string[]; hash: string };
    }>(
      `https://api.mangadex.org/at-home/server/${chapter_id}?forcePort443=false`,
      { responseType: 'json' },
    );
    return data.map((e) => `${baseUrl}/data/${hash}/${e}`);
  },

  onPrev: () =>
    querySelectorClick(
      `#chapter-selector > a[href^="/chapter/"]:nth-of-type(1)`,
    ),
  onNext: () =>
    querySelectorClick(
      `#chapter-selector > a[href^="/chapter/"]:nth-of-type(2)`,
    ),
});
