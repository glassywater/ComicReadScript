import { request, setup } from 'core';
import { sleep } from 'helper';

const downloadImg = (url: string) =>
  new Promise<string>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open('GET', url);
    xhr.onload = () => {
      resolve(URL.createObjectURL(xhr.response));
    };
    xhr.send();
  });

const crt = localStorage.getItem('clearance');
setup({
  name: 'schale',
  isMangaPage: () => {
    const match =
      /\/g\/(?<galleryId>\d+)\/(?<galleryKey>.+?)(?:\/read\/\d+)?$/u.exec(
        location.pathname,
      )?.groups as { galleryId: string; galleryKey: string } | null;
    return match ?? false;
  },
  async getImgList({ dynamicLazyLoad }, { galleryId, galleryKey }) {
    type DetailRes = {
      created_at: number;
      updated_at: number;
      data: {
        id: number;
        key: string;
        size: number;
      }[];
    };
    const detailRes = await request<DetailRes>(
      `https://api.schale.network/books/detail/${galleryId}/${galleryKey}?crt=${crt}`,
      { fetch: true, responseType: 'json', method: 'POST' },
    );
    const [[w, { id, key }]] = Object.entries(detailRes.response.data)
      .filter(([, data]) => data.id && data.key)
      .toSorted(([, a], [, b]) => b.size - a.size);

    type DataRes = {
      base: string;
      entries: { path: string; dimensions: [number, number] }[];
    };
    const dataRes = await request<DataRes>(
      `https://api.schale.network/books/data/${galleryId}/${galleryKey}/${
        id
      }/${key}/${w}?crt=${crt}`,
      { fetch: true, responseType: 'json' },
    );
    const { base, entries } = dataRes.response;
    const { length } = entries;

    const loadImg = async (i: number) => {
      const { path, dimensions } = entries[i];
      const startTime = performance.now();
      const url = await downloadImg(`${base}${path}?w=${dimensions[0]}`);
      await sleep(500 - (performance.now() - startTime));
      return url;
    };

    return dynamicLazyLoad({ loadImg, length, concurrency: 1 });
  },
});
