import { setup } from 'core';
import { querySelectorClick } from 'helper';

(() => {
  switch (/\/[^/]+\/[^/]+\//u.exec(location.pathname)?.[0]) {
    case '/special/4pages-comics/':
    case '/works/comics/':
      setup({
        name: 'sai-zen-sen',
        getImgList: () =>
          Object.values(
            unsafeWindow.B.Package.Manifest.items as { href: string }[],
          )
            .map(({ href }) => href)
            .filter(Boolean)
            .map((path) => `${unsafeWindow.B.Path}/${path}`),
        onPrev: () =>
          querySelectorClick('ul.volumes > li:nth-child(2) > a[href]'),
        onNext: () =>
          querySelectorClick('ul.volumes > li:nth-child(3) > a[href]'),
      });
      break;

    case '/comics/twi4/':
      setup({
        name: 'sai-zen-sen',
        getImgList: () =>
          unsafeWindow.t4.Meta.Items.map(
            ({ ImageFileName }) =>
              `${unsafeWindow.t4.GA.Gate.x_directory}works/${ImageFileName}`,
          ),
      });
      break;
  }
})();
