import { setupChapters, setupSiteAdapter, toast } from 'core';
import { log, querySelector } from 'helper';
import {
  getChapterData,
  getChapters,
  getComments,
  getImglistByHtml,
  token,
} from 'userscript/copyApi';

import { buildCatalog } from './buildCatalog';
import { type CopymangaPageContext, getPageContext } from './helper';
import { handleLastChapter } from './lastChapter';

setupSiteAdapter<CopymangaPageContext>({
  name: 'copymanga',
  getPageContext,
  handlers: {
    manga: (coreCtx, { id: comicId, chapterId }) => {
      /** 漫画不存在时才会出现的提示 */
      const titleDom = querySelector('main .img+.title');

      /** 通过页面上的标题元素展示加载状态 */
      const setTip = (text: string) => {
        if (titleDom) titleDom.textContent = text;
      };

      /** 加载章节图片列表 */
      const getChapterImgList = async (id: string) => {
        // 当前章节优先通过解析网页变量加载，减少等待时间
        if (id === chapterId) {
          try {
            const imgList = await getImglistByHtml(
              `${location.origin}/comic/${comicId}/chapter/${chapterId}`,
            );
            if (imgList.length > 0) {
              setTip('漫畫加載成功🥳');
              return imgList;
            }
          } catch (error) {
            log.error(error);
          }
        }

        // 隐藏漫画只能通过 api 加载，还失败的话就没办法了
        const data = await getChapterData(comicId, id);
        if (data.status !== 200) {
          const message = `漫畫加載失敗：${data.message || data.status}`;
          setTip(message);
          throw new Error(message);
        }
        setTip('漫畫加載成功🥳');
        if (titleDom)
          document.title = `${data.comicName} - ${data.chapter.name} - 拷貝漫畫 拷贝漫画`;

        return data.urls;
      };

      setTip(
        'ComicRead 提示您：你訪問的內容暫不存在，請點選右下角按鈕嘗試加載漫畫',
      );

      // 先注册并加载当前章节的图片
      coreCtx.setState('imgListMap', '', {
        getImgList: () => getChapterImgList(chapterId),
      });

      // 然后再获取章节模式的数据
      return setupChapters<string>(coreCtx, {
        currentId: chapterId,
        getChapterList: async () => {
          const { groups } = await getChapters(comicId);
          const groupList = Object.values(groups);
          return groupList.flatMap((group) =>
            group.chapters.map(({ id, name }) => ({
              id,
              // 多分组时通过标题前缀区分「話/卷/番外篇」等分组
              title: groupList.length > 1 ? `[${group.name}] ${name}` : name,
              url: `/comic/${comicId}/chapter/${id}`,
            })),
          );
        },
        getChapterImgList,
        getComments,
      });
    },

    // 目录页
    catalog: async (_, { id, hiddenType, isMobile }) => {
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
          await buildCatalog(id, hiddenType);
        } catch (error) {
          log.error(error);
          if (titleDom)
            titleDom.textContent = 'ComicRead 提示您：目錄生成失敗😢';
          toast.error('目錄生成失敗😢', { duration: Infinity });
        }
      }

      if (!isMobile && token) handleLastChapter(id);
    },
  },
});
