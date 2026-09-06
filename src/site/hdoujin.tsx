import { request, setup } from 'core';
import { t } from 'helper';
import { type RequestDetails } from 'request';

// https://github.com/dyphire/hentai-assistant/blob/hdoujin/src/providers/hdoujin_api.py
const clearance = localStorage.getItem('clearance');
if (!clearance) throw new Error(t('site.changed_load_failed'));

const api = async <T,>(url: string, details?: RequestDetails<T>) => {
  const res = await request<T>(
    `https://api.hdoujin.org/books${url}?crt=${clearance}`,
    { fetch: true, responseType: 'json', ...details },
  );
  return res.response;
};

setup({
  name: 'HDoujin',
  isMangaPage: () => {
    const match =
      /\/g\/(?<galleryId>\d+)\/(?<galleryKey>.+?)(?:\/read\/\d+)?$/u.exec(
        location.pathname,
      )?.groups as { galleryId: string; galleryKey: string } | undefined;
    return match ? { type: 'manga', ...match } : false;
  },
  getImgList: async ({ dynamicLazyLoad }, { galleryId, galleryKey }) => {
    type ExtraData = { id: string; key: string; size: string };
    const { data } = await api<{ data: Record<string, ExtraData> }>(
      `/detail/${galleryId}/${galleryKey}`,
      { method: 'POST' },
    );

    // 选择最高分辨率
    const [[size]] = Object.entries(data)
      .filter(([, { id, key }]) => id && key)
      .toSorted(([a], [b]) => {
        if (a === '0') return -1;
        if (b === '0') return 1;
        return Number(b) - Number(a);
      });
    const { id: dataId, key: dataKey } = data[size];

    const { base, entries } = await api<{
      base: string;
      entries: { path: string }[];
    }>(`/data/${galleryId}/${galleryKey}/${dataId}/${dataKey}/${size}`);

    return dynamicLazyLoad({
      length: entries.length,
      loadImg: async (i) => {
        const res = await request<Blob>(`${base}${entries[i].path}`, {
          cookie: document.cookie,
          headers: {
            Referer: 'https://hdoujin.org/',
            Origin: 'https://hdoujin.org',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
          },
          responseType: 'blob',
          fetch: false,
        });

        const imgUrl = URL.createObjectURL(res.response);
        return imgUrl;
      },
    });
  },
});
