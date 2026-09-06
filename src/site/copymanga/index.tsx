import { setupSiteAdapter, toast } from 'core';
import { log, querySelector, querySelectorClick } from 'helper';
import {
  getChapterData,
  getComments,
  getImglistByHtml,
  token,
} from 'userscript/copyApi';

import { buildChapters } from './chapters';
import { type CopymangaPageContext, getPageContext } from './helper';
import { handleLastChapter } from './lastChapter';

setupSiteAdapter<CopymangaPageContext>({
  name: 'copymanga',
  getPageContext,
  handlers: {
    manga: ({ setState }, { comicName, id }) => {
      /** 漫画不存在时才会出现的提示 */
      const titleDom = querySelector('main .img+.title');
      if (titleDom)
        titleDom.textContent =
          'ComicRead 提示您：你訪問的內容暫不存在，請點選右下角按鈕嘗試加載漫畫';
      /** 通过网页 API 加载漫画（可以获取隐藏漫画） */
      const getImgListByApi = async () => {
        const data = await getChapterData(comicName, id);

        if (data.status !== 200) {
          const message = `漫畫加載失敗：${data.message || data.status}`;
          if (titleDom) titleDom.textContent = message;
          throw new Error(message);
        }

        if (titleDom) {
          titleDom.textContent = '漫畫加載成功🥳';
          document.title = `${data.comicName} - ${data.chapter.name} - 拷貝漫畫 拷贝漫画`;
        }

        if (titleDom ?? !querySelector('.comicContent-next')) {
          const { next, prev } = data.chapter;

          setState('manga', {
            onNext: next
              ? () => location.assign(`/comic/${comicName}/chapter/${next}`)
              : undefined,
            onPrev: prev
              ? () => location.assign(`/comic/${comicName}/chapter/${prev}`)
              : undefined,
          });
        }

        return data.urls;
      };

      setState('comicMap', '', {
        async getImgList() {
          if (querySelector('.comicContent-next'))
            setState('manga', {
              onNext: querySelectorClick(
                '.comicContent-next a:not(.prev-null)',
              ),
              onPrev: querySelectorClick(
                '.comicContent-prev:not(.index,.list) a:not(.prev-null)',
              ),
            });

          // 隐藏漫画只能通过 api 加载，不能的话就没办法了
          if (titleDom) return getImgListByApi();
          // 其他普通漫画优先通过解析网页变量加载，避免触发 api 的限制
          try {
            const imgList = await getImglistByHtml(
              `${location.origin}/comic/${comicName}/chapter/${id}`,
            );
            if (imgList.length === 0) throw new Error('解析網頁變量失敗');
            return imgList;
          } catch (error) {
            log.error(error);
            return getImgListByApi();
          }
        },
      });

      // 评论异步获取，不影响其他功能
      void (async () => {
        const chapter_id = location.pathname.split('/').at(-1)!;
        const comments = await getComments(chapter_id);
        if (comments.length > 0) setState('manga', 'commentList', comments);
      })();
    },

    // 目录页
    catalog: async (_, { comicName, hiddenType, isMobile }) => {
      // 如果漫画被隐藏了，就自己生成目录
      if (hiddenType) {
        // 给屏蔽提示加个删除线
        const tip = querySelector('.isBan, .wargin');
        if (tip) tip.style.textDecoration = 'line-through';
        // 修改 404 提示
        const titleDom = querySelector('main .img+.title');
        if (titleDom) {
          titleDom.textContent =
            'ComicRead 提示您：你訪問的內容暫不存在，請坐和放寬，等待目錄生成';
        }

        try {
          await buildChapters(comicName, hiddenType);
        } catch (error) {
          log.error(error);
          if (titleDom)
            titleDom.textContent = 'ComicRead 提示您：目錄生成失敗😢';
          toast.error('目錄生成失敗😢', { duration: Infinity });
        }
      }

      if (!isMobile && token) handleLastChapter(comicName);
    },
  },
});
