import { setupSimple } from 'core';
import { querySelector, querySelectorAll, wait } from 'helper';

(() => {
  const isOld = location.hostname === 'old.klz9.com';
  // 旧站图片在 #list-imga，新站在 <main>
  const imgSelector = isOld ? '#list-imga img' : 'main img:not(a img)';

  const getNavBtn = (index: 0 | 1) =>
    querySelectorAll<HTMLButtonElement>('main button.flex-1')[index];

  // 只适用于新站
  const handlePrevNext = (index: 0 | 1) => {
    const btn = getNavBtn(index);
    return btn && !btn.disabled ? () => btn.click() : undefined;
  };

  void setupSimple({
    name: 'KLZ9',
    selector: imgSelector,
    // 统一用「路径以 -chapter-数字.html 结尾」判断漫画页
    isMangaPage: async () => {
      if (!/-chapter-[.0-9]+\.html$/iu.test(location.pathname)) return false;
      await wait(() => querySelector(imgSelector));
      return { id: location.pathname };
    },
    // 旧站返回 undefined → 回退到 getChapterSwitch 自动识别的 a.prev/a.next；
    // 新站用 button.flex-1
    onPrev: () => (isOld ? undefined : handlePrevNext(0)),
    onNext: () => (isOld ? undefined : handlePrevNext(1)),
  });
})();
