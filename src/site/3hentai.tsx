import { request, setup } from 'core';
import { domParse } from 'helper';

(() => {
  const isMangaPage = () =>
    /^\/d\/(?<gid>\d+)(?:\/(?<page>\d+))?\/?/u.exec(location.pathname)
      ?.groups as { gid: string; page?: string } | undefined;
  if (!isMangaPage()) return;

  setup({
    name: '3Hentai',
    isMangaPage,
    initOptions: { autoShow: false },
    async getImgList(_coreCtx, { gid, page }) {
      const root = page
        ? domParse((await request(`/d/${gid}`)).responseText)
        : document;
      return Array.from(
        root.querySelectorAll<HTMLImageElement>('img[data-src$="t.jpg"]'),
        (img) =>
          img.dataset.src!.replace(
            /(?<path>\/[^/]*)t(?<ext>\.[^/]+)$/u,
            '$<path>$<ext>',
          ),
      );
    },
  });
})();
