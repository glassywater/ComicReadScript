import { querySelector, wait } from 'helper';
import { getLastChapter } from 'userscript/copyApi';

/** 在目录页显示上次阅读记录 */
export const handleLastChapter = (comicName: string) => {
  let a: HTMLAnchorElement;

  const stylesheet = new CSSStyleSheet();
  document.adoptedStyleSheets.push(stylesheet);

  const updateLastChapter = async () => {
    // 因为拷贝漫画的目录是动态加载的，所以要等目录加载出来再往上添加
    if (!a)
      (async () => {
        a = document.createElement('a');
        const tableRight = await wait(() =>
          querySelector('.table-default-right'),
        );
        a.target = '_blank';
        tableRight.firstElementChild?.before(a);
        const span = document.createElement('span');
        span.textContent = '最後閱讀：';
        tableRight.firstElementChild?.before(span);
      })();

    a.textContent = '獲取中';
    a.removeAttribute('href');
    try {
      const res = await getLastChapter(comicName);

      const data = res.response?.results?.browse;
      if (!data) {
        a.textContent = data === null ? '無' : '未返回數據';
        return;
      }

      const lastChapterId = data.chapter_id as string;
      if (!lastChapterId) {
        a.textContent = '接口異常';
        return;
      }

      await stylesheet.replace(`ul a[href*="${lastChapterId}"] {
        color: #fff !important;
        background: #1790E6;
      }`);

      a.href = `${location.pathname}/chapter/${lastChapterId}`;
      a.textContent = data.chapter_name;
    } catch {
      a.textContent = '獲取閱讀記錄失敗';
    }
  };

  setTimeout(updateLastChapter);
  document.addEventListener('visibilitychange', updateLastChapter);
};
