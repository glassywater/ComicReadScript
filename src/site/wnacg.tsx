import { type SetupOptions, request, setup } from 'core';
import { querySelector, t } from 'helper';

(() => {
  // 突出显示下拉阅读的按钮
  const buttonDom = querySelector('#bodywrap a.btn');
  if (buttonDom) {
    buttonDom.style.setProperty('background-color', '#607d8b');
    buttonDom.style.setProperty('background-image', 'none');
  }

  // 旧版：https://www.wnacg.com/photos-slist-aid-376223.html
  // 新版：https://www.wnacg.com/photos-slide-aid-376223.html
  // 条漫（？）：https://www.wnacg.com/photos-list-aid-376223.html
  // 阅读器有多种类型，网址始终是 photos-<类型>-aid-<id> 的格式
  // <类型> 仅影响阅读器，不影响资源的加载

  const match = /\/photos-(?<type>slist|slide|list)-aid-(?<id>\d+)/u.exec(
    location.pathname,
  )?.groups;
  if (!match?.type || !match?.id || match?.type === 'index') return;

  const getImgList: SetupOptions['getImgList'] | undefined =
    unsafeWindow.imglist
      ? () =>
          (unsafeWindow.imglist as { url: string; caption: string }[])
            .filter(
              ({ caption }) => caption !== '喜歡紳士漫畫的同學請加入收藏哦！',
            )
            .map(({ url }) => url)
      : async () => {
          const res = await request<string>(
            `/photos-item-aid-${match.id}.html`,
          );
          const pageUrl = /"page_url":(?<pageUrl>\[.+\]),/u.exec(
            res.responseText,
          )?.groups.pageUrl;
          if (!pageUrl) throw new Error(t('site.changed_load_failed'));
          return eval(pageUrl) as string[]; // oxlint-disable-line no-eval
        };

  setup({ name: 'wnacg', getImgList });
})();
