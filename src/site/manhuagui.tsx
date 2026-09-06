import { setup, toast } from 'core';
import { css, querySelector, querySelectorAll, t } from 'helper';

(() => {
  if (!/\/comic\/\d+\/\d+\.html/u.test(location.pathname)) return;

  let comicInfo: {
    sl: Record<string, string>;
    files?: string[];
    images?: string[];
    prevId: number;
    nextId: number;
  };
  try {
    const dataScript = querySelectorAll('body > script:not([src])').find(
      (script) => script.innerHTML.startsWith('window['),
    );
    if (!dataScript) throw new Error(t('site.changed_load_failed'));
    comicInfo = JSON.parse(
      // 只能通过 eval 获得数据
      // oxlint-disable-next-line no-eval
      eval(dataScript.innerHTML.slice(26)).match(/(?<=\()\{.+\}/u)[0],
    );
  } catch {
    toast.error(t('site.changed_load_failed'));
    return;
  }

  // 让切换章节的提示可以显示在漫画页上
  css`
    #smh-msg-box {
      z-index: 2147483647 !important;
    }
  `;

  const createChapterNav = (cid: number) => {
    if (cid === 0) return;
    const newUrl = location.pathname.replace(/(?<=\/)\d+(?=\.html)/u, `${cid}`);
    return () => location.assign(newUrl);
  };

  setup({
    name: 'manhuagui',
    getImgList() {
      const sl = Object.entries(comicInfo.sl)
        .map((attr) => `${attr[0]}=${attr[1]}`)
        .join('&');

      if (comicInfo.files)
        return comicInfo.files.map(
          (file) => `${unsafeWindow.pVars.manga.filePath}${file}?${sl}`,
        );
      if (comicInfo.images) {
        const { origin } = new URL(
          querySelector<HTMLImageElement>('#manga img')!.src,
        );
        return comicInfo.images.map((url) => `${origin}${url}?${sl}`);
      }

      toast.error(t('site.changed_load_failed'), { throw: true });
      return [];
    },
    onNext: () => createChapterNav(comicInfo.nextId),
    onPrev: () => createChapterNav(comicInfo.prevId),
  });
})();
