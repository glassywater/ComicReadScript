import { type CoreContext, request } from 'core';
import {
  hijackFn,
  querySelector,
  querySelectorAll,
  scrollIntoView,
} from 'helper';

import { type YamiboOptions, type YamiboPageContext } from './helper';

// 漫画阅读模式
export const threadHandler = (
  { setState, options, showComic, loadComic }: CoreContext<YamiboOptions>,
  { isManga }: Extract<YamiboPageContext, { type: 'thread' }>,
) => {
  // 修复微博图床的链接
  for (const e of querySelectorAll('img[file*="sinaimg.cn"]'))
    e.setAttribute('referrerpolicy', 'no-referrer');

  const readMode = () => {
    const isFirstPage = !querySelector('.pg > .prev');
    // 第一页以外不自动加载
    if (!isFirstPage) setState('flag', 'needAutoShow', false);

    let imgList = querySelectorAll<HTMLImageElement>(
      ':is(.t_fsz, .message) img',
    );

    const getImgList = () => {
      let i = imgList.length;
      while (i--) {
        const img = imgList[i];

        // 触发懒加载
        const file = img.getAttribute('file');
        if (file && img.src !== file) {
          img.setAttribute('src', file);
          img.setAttribute('lazyloaded', 'true');
        }

        // 测试例子：https://bbs.yamibo.com/thread-502399-1-1.html

        // 删掉表情和小图
        if (
          img.src.includes('static/image') ||
          (img.complete &&
            img.naturalHeight &&
            img.naturalWidth &&
            img.naturalHeight < 500 &&
            img.naturalWidth < 500)
        )
          imgList.splice(i, 1);
      }

      return imgList.map((img) => img.src);
    };
    setState('comicMap', '', { getImgList });

    setState('manga', {
      // 在图片加载完成后再检查一遍有没有小图，有就删掉
      onLoading(_imgList, img) {
        if (img && img.width! < 500 && img.height! < 500) return loadComic();
      },
      onExit(isEnd) {
        if (isEnd)
          scrollIntoView('.psth, .rate, #postlist > div:nth-of-type(2)');
        setState('manga', 'show', false);
      },
    });

    if (querySelector('div.pti > div.authi')) {
      querySelector('div.pti > div.authi')!.insertAdjacentHTML(
        'beforeend',
        '<span class="pipe show">|</span><a id="comicReadMode" class="show" href="javascript:;">漫画阅读</a>',
      );
      document
        .getElementById('comicReadMode')
        ?.addEventListener('click', () => showComic());
    }

    // 如果帖子内有设置目录
    if (querySelector('#threadindex')) {
      // 在网页通过 ajax 更新对应内容后重新获取漫画图片
      hijackFn('ajaxinnerhtml', () => {
        imgList = querySelectorAll<HTMLImageElement>('.t_fsz img');
        if (imgList.length === 0 || getImgList().length === 0) return;
        if (options.autoShow) void showComic();
      });
    }

    const tagDom = querySelector<HTMLAnchorElement>('.ptg.mbm.mtn > a');
    // 通过标签确定上/下一话
    if (tagDom) {
      const [, tagId] = tagDom.href.split('id=');
      const reg = /(?<=<th>\s<a href="thread-)\d+(?=-)/gu;
      let threadList: number[] = [];

      // 先获取包含当前帖后一话在内的同一标签下的帖子id列表，再根据结果设定上/下一话
      const setPrevNext = async (pageNum = 1): Promise<void> => {
        const res = await request(
          `/misc.php?mod=tag&id=${tagId}&type=thread&page=${pageNum}`,
        );

        const newList = Array.from(res.responseText.matchAll(reg), ([tid]) =>
          Number(tid),
        );
        threadList = [...threadList, ...newList];

        const index = threadList.indexOf(unsafeWindow.tid);
        if (newList.length > 0 && (index === -1 || !threadList[index + 1]))
          return setPrevNext(pageNum + 1);

        return setState('manga', {
          onPrev: threadList[index - 1]
            ? () => location.assign(`thread-${threadList[index - 1]}-1-1.html`)
            : undefined,
          onNext: threadList[index + 1]
            ? () => location.assign(`thread-${threadList[index + 1]}-1-1.html`)
            : undefined,
        });
      };

      setTimeout(setPrevNext);
    }
  };

  // 限定板块启用
  if (isManga) readMode();
  else {
    querySelector('div.pti > div.authi')!.insertAdjacentHTML(
      'beforeend',
      '<span class="pipe show">|</span><a id="comicReadMode" class="show" href="javascript:;">漫画阅读</a>',
    );
    const button = document.getElementById('comicReadMode');
    button?.addEventListener('click', () => {
      button.previousElementSibling?.remove();
      button.remove();
      readMode();
      void showComic();
    });
  }
};
