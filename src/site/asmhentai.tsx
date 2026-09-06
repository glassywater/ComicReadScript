import { setup } from 'core';
import { querySelector, range, t } from 'helper';

(() => {
  const isMangaPage = () =>
    /^\/(?:g\/\d+\/|gallery\/\d+\/\d+\/)/u.test(location.pathname);
  if (!isMangaPage()) return;

  const getImgList = () => {
    const loadId = querySelector<HTMLInputElement>(
      '#load_id, #gallery_id',
    )?.value;
    const loadDir = querySelector<HTMLInputElement>(
      '#load_dir, #image_dir',
    )?.value;
    const pageCount = Number(
      querySelector<HTMLInputElement>('#t_pages, #pages')?.value,
    );
    if (!loadId || !loadDir || !Number.isFinite(pageCount) || pageCount <= 0)
      throw new Error(t('site.changed_load_failed'));
    return range(
      pageCount,
      (i) => `https://images.asmhentai.com/${loadDir}/${loadId}/${i + 1}.jpg`,
    );
  };

  setup({
    name: 'AsmHentai',
    isMangaPage,
    getImgList,
    initOptions: { autoShow: false },
  });
})();
