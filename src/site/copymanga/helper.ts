import { querySelector, querySelectorAll, wait } from 'helper';

// 拷贝有些漫画虽然可以通过 api 获取到数据，但网页上的目录被隐藏了
//  web - https://www.mangacopy.com/comic/lianyuqingchang
//  mobile - https://www.mangacopy.com/h5/details/comic/lianyuqingchang
// 还有些漫画连网页端介绍都被删了
//  404 - https://www.mangacopy.com/comic/Hyakkasou

export type HiddenType = 'web' | 'mobile' | '404';

export const getPageContext = async () => {
  let comicName = '';
  let id = '';
  if (location.href.includes('/chapter/'))
    [, , comicName, , id] = location.pathname.split('/');
  else if (location.href.includes('/comicContent/'))
    [, , , comicName, id] = location.pathname.split('/');

  if (comicName && id) return { type: 'manga', comicName, id } as const;

  // 目录页
  if (!id && location.href.includes('/comic/')) {
    [, comicName] = location.href.split('/comic/');
    if (!comicName) return;

    const isMobile = location.href.includes('/h5/');
    let hiddenType: HiddenType | undefined;

    if (document.title === '404 - 拷貝漫畫') {
      // 移动端可以直接复用代码来实现相同的样式
      hiddenType = isMobile ? 'mobile' : '404';
    } else if (isMobile) {
      // 等到加载提示框消失
      await wait(
        () =>
          querySelector('.van-toast__text')?.parentElement?.style.display ===
          'none',
      );
      // 再等一会看有没有屏蔽提示
      hiddenType = await wait<HiddenType | undefined>(() => {
        // 正常隐藏
        if (querySelector('.isBan')?.textContent?.includes('不提供閱覽'))
          return 'mobile';
        // 连介绍都没有的隐藏
        const dialog = querySelector('.van-dialog__message');
        if (dialog?.textContent?.includes('漫畫未找到')) {
          dialog.textContent = '漫畫未找到!\n請坐和放寬，等待目錄生成';
          // 删掉空白占位的原目录元素
          for (const element of querySelectorAll('.detailsTextContentTabs'))
            element.remove();
          // 虽然实际是应该算是 404 类型，但因为网页的 css 还在
          // 所以可以直接使用 mobile 的元素复用样式
          return 'mobile';
        }
      }, 1000);
    } else if (
      // 先检查有没有屏蔽提示
      Boolean(querySelector('.wargin')?.textContent?.includes('不提供閱覽')) ||
      // 再等目录标题容器加载出来
      !(await wait(
        () => querySelector('.upLoop .table-default-title'),
        1000,
      )) ||
      // 有标题容器，但没有章节列表项（<a><li>），说明是触发了反爬机制
      !(await wait(() => querySelector('main .upLoop ul a li'), 1000))
    ) {
      // 检查漫画介绍是否正常显示
      hiddenType = querySelector('.comicParticulars-title') ? 'web' : '404';
    }

    return { type: 'catalog', comicName, hiddenType, isMobile } as const;
  }
};

export type CopymangaPageContext = NonNullable<
  Awaited<ReturnType<typeof getPageContext>>
>;
