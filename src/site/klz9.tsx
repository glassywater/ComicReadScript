import { setupSimple } from 'core';
import { querySelector, querySelectorAll, wait } from 'helper';

(() => {
  if (!location.pathname.includes('-chapter-')) return;

  const getNavBtn = (index: 0 | 1) =>
    querySelectorAll<HTMLButtonElement>('main button.flex-1')[index];

  const handlePrevNext = (index: 0 | 1) => {
    const btn = getNavBtn(index);
    return btn && !btn.disabled ? () => btn.click() : undefined;
  };

  void setupSimple({
    name: 'KLZ9',
    selector: 'main img:not(a img)',
    isMangaPage: async () => {
      if (!location.pathname.includes('-chapter-')) return false;
      await wait(() => querySelector('main img:not(a img)'));
      return { id: location.pathname };
    },
    onPrev: () => handlePrevNext(0),
    onNext: () => handlePrevNext(1),
  });
})();
