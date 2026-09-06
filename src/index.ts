// oxlint-disable typescript/no-floating-promises
import { type MangaProps } from 'components/Manga';
import { request, setup, toast } from 'core';
import {
  domParse,
  log,
  querySelector,
  querySelectorAll,
  querySelectorClick,
  requestIdleCallback,
  t,
  wait,
} from 'helper';
import { getInitLang } from 'helper/languages';
import { downloadImgHeaders } from 'request';
import { getImglistByHtml } from 'userscript/copyApi';
import { otherSite } from 'userscript/otherSite';

import { getNhentaiData, toImgList } from './userscript/nhentaiApi';

try {
  switch (location.hostname) {
    // #百合会（记录阅读历史、自动签到等）
    // test: https://bbs.yamibo.com/thread-559899-1-1.html
    case 'bbs.yamibo.com': {
      import('site/yamibo');
      break;
    }

    // #百合会新站
    // test: https://www.yamibo.com/manga/view-chapter?id=251
    case 'www.yamibo.com': {
      import('site/newYamibo');
      break;
    }

    // #E-Hentai（关联外站、快捷收藏、标签染色、识别广告页等）
    // test: https://e-hentai.org/g/2945358/699f8eb501
    case 'exhentai.org':
    case 'e-hentai.org': {
      import('site/ehentai');
      break;
    }

    // #nhentai（彻底屏蔽漫画、无限滚动）
    // test: https://nhentai.net/g/582446/
    case 'nhentai.net': {
      import('site/nhentai');
      break;
    }

    // #Yurifans（自动签到）
    // test: https://yuri.website/95131/
    case 'yuri.website': {
      import('site/yurifans');
      break;
    }

    // #拷贝漫画(copymanga)（显示最后阅读记录、解锁隐藏漫画）
    // test: https://www.mangacopy.com/comic/lianggrendeetaobixianshi/chapter/33cde95c-c8ea-11ea-a67e-00163e0ca5bd
    case 'siteUrl#copymanga':
    case 'mangacopy.com':
    case 'www.mangacopy.com': {
      import('site/copymanga');
      break;
    }

    // #漫画站（中文）[再漫画](https://manhua.zaimanhua.com/)
    // test: https://manhua.zaimanhua.com/view/heimaohemonvdeketang/64175/133789
    case 'www.zaimanhua.com':
    case 'manhua.zaimanhua.com': {
      import('site/zaimanhua');
      break;
    }
    // TODO: 移动端网页的测试
    case 'm.zaimanhua.com': {
      import('site/zaimanhua');
      break;
    }

    // #漫画站（中文）[漫画柜(manhuagui)](https://www.manhuagui.com)
    // test: https://www.manhuagui.com/comic/36584/508218.html
    case 'tw.manhuagui.com':
    case 'm.manhuagui.com':
    case 'www.mhgui.com':
    case 'www.manhuagui.com': {
      import('site/manhuagui');
      break;
    }

    // #漫画站（中文）[动漫屋(dm5)](https://www.dm5.com)
    // test: https://www.dm5.cn/m1033552/
    case 'www.manhuaren.com':
    case 'm.1kkk.com':
    case 'www.1kkk.com':
    case 'tel.dm5.com':
    case 'en.dm5.com':
    case 'cnc.dm5.com':
    case 'www.dm5.cn':
    case 'www.dm5.com': {
      import('site/dm5');
      break;
    }

    // #漫画站（中文）[mangabz](https://mangabz.com)
    // test: https://mangabz.com/m131128/
    case 'www.mangabz.com':
    case 'mangabz.com': {
      import('site/mangabz');
      break;
    }

    // #漫画站（中文）[komiic](https://komiic.com)
    // test: https://komiic.com/comic/2299/chapter/66668/images/all
    case 'komiic.com':
    case 'komiic.cc': {
      import('site/komiic');
      break;
    }

    // #漫画站（中文）[無限動漫](https://www.8comic.com)
    // test: 直接访问漫画页会因为 referer 检测不过而被拦截，跳过
    case '8.twobili.com':
    case 'a.twobili.com':
    case 'articles.onemoreplace.tw':
    case 'www.8comic.com': {
      if (!/^\/(?:online|ReadComic|comic)\//u.test(location.pathname)) break;
      downloadImgHeaders.Referer = 'https://www.8comic.com/';

      // by: https://sleazyfork.org/zh-CN/scripts/374903-comicread/discussions/241035
      const getImgList = () =>
        Array.from(
          (unsafeWindow.xx as string).matchAll(/(?<= s=").+?(?=")/gu),
          ([text]) => decodeURIComponent(text),
        );

      setup({
        name: '8comic',
        getImgList,
        onNext: () => querySelectorClick('#nextvol'),
        onPrev: () => querySelectorClick('#prevvol'),
      });
      break;
    }

    // #R18（中文）[绅士漫画(wnacg)](https://www.wnacg.com)
    // test: https://www.wnacg.com/photos-slide-aid-284931.html
    case 'siteUrl#wnacg':
    case 'www.wnacg.com':
    case 'wnacg.com': {
      import('site/wnacg');
      break;
    }

    // #R18（中文）[禁漫天堂](https://18comic.vip)
    // test: https://18comic.vip/photo/1198559
    case 'siteUrl#jm':
    case '18comic.org':
    case '18comic.vip': {
      import('site/jm');
      break;
    }

    // #R18（中文）[NoyAcg](https://noy1.top)
    // test: https://noymanga.com/reader/13349
    // https://noymanga.com/reader/60142/582549
    case 'noymanga.com': {
      import('site/noyacg');
      break;
    }
    case 'noy1.top': {
      import('site/noyacg');
      break;
    }

    // #R18（中文）[熱辣漫畫](https://www.relamanhua.org/)
    // test: https://www.relamanhua.org/comic/lianggrendeetaobixianshi/chapter/33cde95c-c8ea-11ea-a67e-00163e0ca5bd
    case 'www.relamanhua.org':
    case 'www.manga2024.com':
    case 'www.2024manga.com': {
      if (!location.pathname.includes('/chapter/')) break;

      if (!document.querySelector('.disData[contentkey]')) {
        toast.error(t('site.changed_load_failed'));
        break;
      }

      setup({
        name: 'relamanhua',
        getImgList: () => getImglistByHtml(),
        onNext: () =>
          querySelectorClick('.comicContent-next a:not(.prev-null)'),
        onPrev: () =>
          querySelectorClick(
            '.comicContent-prev:not(.index,.list) a:not(.prev-null)',
          ),
      });
      break;
    }

    // #R18（中文）[hanime1](https://hanime1.me)
    // test: https://hanime1.me/comic/134422
    case 'hanime1.me': {
      if (!location.pathname.startsWith('/comic/')) break;

      setup({
        name: 'hanime1',
        getImgList: async () => {
          const downloadDom = await wait(() =>
            querySelector<HTMLAnchorElement>(
              '.comics-metadata-margin-top a:has(span.material-icons)',
            ),
          );
          const id = /\/g\/(?<id>\d+)\//u.exec(downloadDom.href)?.groups?.id;
          if (!id) throw new Error(t('site.changed_load_failed'));
          const data = await getNhentaiData(id);
          return toImgList(data);
        },
      });
      break;
    }

    // #R18[hitomi](https://hitomi.la)
    // test: https://hitomi.la/reader/3427121.html
    case 'hitomi.la': {
      import('site/hitomi');
      break;
    }

    // #R18[hdoujin](https://hdoujin.org)
    // test: https://hdoujin.org/g/95756/2d1aa56c3325
    case 'hdoujin.org': {
      import('site/hdoujin');
      break;
    }

    // #R18[SchaleNetwork](https://schale.network/)
    // test: 有cf验证，跳过
    case 'shupogaki.moe':
    case 'hoshino.one':
    case 'niyaniya.moe': {
      import('site/schale');
      break;
    }

    // #R18[nude-moon](https://nude-moon.org)
    // test: https://nude-moon.org/29885--kultkvazar-gubbai-iregyura-goodbye-irregular--pro_ay-ucedcaa.html
    case 'nude-moon.org': {
      import('site/nude-moon');
      break;
    }

    // #R18[HentaiZap](https://hentaizap.com)
    // test: https://hentaizap.com/gallery/1290854/
    // #R18[IMHentai](https://imhentai.xxx)
    // test: https://imhentai.xxx/gallery/1526168/
    // #R18[HentaiEra](https://hentaiera.com)
    // test: https://hentaiera.com/gallery/1506236/
    // #R18[HentaiEnvy](https://hentaienvy.com)
    // test: https://hentaienvy.com/gallery/1411647/
    case 'hentaizap.com':
    case 'imhentai.xxx':
    case 'hentaiera.com':
    case 'hentaienvy.com': {
      import('site/hentaienvy');
      break;
    }

    // #R18[EAHentai](https://eahentai.com)
    // test: https://eahentai.com/a/73673
    case 'eahentai.com': {
      const isMangaPage = () =>
        /^\/a\/(?<albumId>\d+)(?:\/(?<page>\d+))?/u.exec(location.pathname)
          ?.groups as { albumId: string; page?: string };
      if (!isMangaPage()) break;

      setup({
        name: 'EAHentai',
        isMangaPage,
        initOptions: { autoShow: false },
        async getImgList(_coreCtx, { albumId, page }) {
          const root = page
            ? document
            : domParse((await request(`/a/${albumId}/0`)).responseText);
          return Array.from(
            root.querySelectorAll<HTMLImageElement>(
              'main img[src*="i.eahentai.com/file/ea-gallery"]',
            ),
            (e) => e.src,
          );
        },
      });
      break;
    }

    // #R18[HentaiNexus](https://hentainexus.com)
    // test: https://hentainexus.com/read/20349#001
    case 'hentainexus.com': {
      import('site/hentainexus');
      break;
    }

    // #R18[AsmHentai](https://asmhentai.com)
    // test: https://asmhentai.com/g/558140/
    case 'asmhentai.com': {
      import('site/asmhentai');
      break;
    }

    // #R18[3Hentai](https://3hentai.net)
    // test: https://3hentai.net/d/693817
    case '3hentai.net': {
      import('site/3hentai');
      break;
    }

    // #漫画站[MangaDex](https://mangadex.org)
    // test: https://mangadex.org/chapter/4c419c16-ef49-4305-9c46-d3adbe1f60b7
    case 'mangadex.org': {
      import('site/mangadex');
      break;
    }

    // #漫画站[welovemanga](https://nicomanga.com)
    // test: https://nicomanga.com/read-yuri-no-hajimari-wa-dorei-kara-chapter-6.2.html
    case 'nicomanga.com': {
      const getImgList = () => unsafeWindow.chapterImages as string[];
      setup({
        name: 'welovemanga',
        isMangaPage: () => wait(() => getImgList()?.length > 0),
        getImgList,
        onNext: () => querySelectorClick('.next-chapter'),
        onPrev: () => querySelectorClick('.prev-chapter'),
      });
      break;
    }
    case 'weloma.art':
    case 'love4u.net': {
      if (!querySelector('#chapter-images img')) break;

      const getImgUrl = (e: HTMLImageElement) => {
        const src =
          e.dataset.srcset || e.dataset.original || e.dataset.src || e.src;
        if (src && !src.endsWith('.gif')) return src.trim();
        if (e.dataset.img) return atob(e.dataset.img);
      };

      const getImgList = () =>
        querySelectorAll<HTMLImageElement>('#chapter-images img')
          .map(getImgUrl)
          .filter(Boolean) as string[];

      setup({
        name: 'welovemanga',
        getImgList,
        onNext: () => querySelectorClick('.rd_top-right.next:not(.disabled)'),
        onPrev: () => querySelectorClick('.rd_top-left.prev:not(.disabled)'),
      });
      break;
    }

    // #漫画站[kisslove(klz9)](https://klz9.com)
    // test: https://klz9.com/mayonaka-heart-tune-chapter-109.html
    case 'old.klz9.com':
    case 'klz9.com': {
      import('site/klz9');
      break;
    }

    // #Fanbox[Pawchive](https://pawchive.pw) <sup>合订</sup>
    // test: https://pawchive.pw/fanbox/user/82480735/post/12315432
    case 'pawchive.pw': {
      // falls through
    }

    // #Fanbox[kemono](https://kemono.su) <sup>合订</sup>
    // test: https://kemono.cr/fanbox/user/41106591/post/6813818
    case 'kemono.cr':
    case 'kemono.su':
    case 'kemono.party': {
      import('site/kemono');
      break;
    }

    // #Fanbox[nekohouse](https://nekohouse.su)
    // test: https://nekohouse.su/fanbox/user/159912/post/1350453
    case 'nekohouse.su': {
      if (!location.pathname.includes('/post/')) break;
      setup({
        name: 'nekohouse',
        getImgList: () =>
          querySelectorAll<HTMLAnchorElement>('.fileThumb').map((e) =>
            e.getAttribute('href')!,
          ),
        initOptions: { autoShow: false, defaultOption: { pageNum: 1 } },
      });
      break;
    }

    // #其他[Pixiv](https://www.pixiv.net) <sup>合订</sup>
    // test: https://www.pixiv.net/artworks/128841242
    case 'www.pixiv.net': {
      import('site/pixiv');
      break;
    }

    // #其他[微博](https://weibo.com/)
    // test: https://weibo.com/6047238248/KpoVRCSvB
    // https://weibo.com/ttarticle/p/show?id=2309404781436946481164
    case 'weibo.com': {
      import('site/weibo');
      break;
    }

    // #其他[明日方舟泰拉记事社](https://comic.hypergryph.com)
    // test: https://comic.hypergryph.com/comic/6253/episode/3156
    case 'comic.hypergryph.com': {
      import('site/terrahistoricus');
      break;
    }

    // #其他[Postimages](https://postimages.org/)
    // test: https://postimg.cc/gallery/SKn3sFG
    case 'postimg.cc': {
      const domList = querySelectorAll('#thumb-list [data-hotlink]');
      if (domList.length <= 1) break;

      setup({
        name: 'postimg',
        getImgList: () =>
          domList.map(
            (e) =>
              `https://i.postimg.cc/${e.dataset.hotlink}/${e.dataset.name}.${e.dataset.ext}`,
          ),
      });
      break;
    }

    // #其他[ニコニコ漫画](https://manga.nicovideo.jp/)
    // test: https://manga.nicovideo.jp/watch/mg472312
    case 'manga.nicovideo.jp': {
      import('site/nico');
      break;
    }

    // #其他[最前線](https://sai-zen-sen.jp)
    // test: https://sai-zen-sen.jp/works/comics/karanokyoukai/01/01.html
    case 'sai-zen-sen.jp': {
      import('site/sai-zen-sen');
      break;
    }

    // #其他[芸能ヌード](https://geinou-nude.com)
    // test: https://geinou-nude.com/ロン・モンロウ/
    case 'geinou-nude.com': {
      const imgList: MangaProps['imgList'] = querySelectorAll<HTMLImageElement>(
        'main img.size-medium',
      ).map((e) => {
        const src = e.dataset.src ?? '';
        const res = /-(?<w>\d+)x(?<h>\d+)\.[a-z]+$/iu.exec(src)?.groups;
        if (!res) return src;
        return { src, width: Number(res.w), height: Number(res.h) };
      });
      if (imgList.length === 0) break;

      setup({
        name: 'geinou-nude',
        getImgList: () => imgList,
      });
      break;
    }

    // 为 pwa 版页面提供 api，以便翻译功能能正常运作
    // case 'localhost':
    case 'comic-read.pages.dev': {
      unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
      unsafeWindow.toast = toast;
      break;
    }

    default: {
      // #自部署[Suwayomi](https://github.com/Suwayomi/Suwayomi-Server)
      if (
        document.querySelector(
          `head > meta[content="A manga reader that runs tachiyomi's extensions"]`,
        )
      )
        import('site/suwayomi');
      // #自部署[LANraragi](https://github.com/Difegue/LANraragi)
      else if (
        location.pathname === '/reader' &&
        document
          .querySelector('.ip > a[href="https://github.com/Difegue/LANraragi"]')
          ?.textContent.trim() === 'LANraragi.'
      )
        import('site/lanraragi');

      (async () => {
        if ((await GM.getValue(location.hostname)) !== undefined)
          return requestIdleCallback(otherSite);

        await GM.registerMenuCommand(
          extractI18n('site.simple.simple_read_mode')(await getInitLang()),
          () => otherSite(),
        );
      })();
    }
  }
} catch (error) {
  log.error(error);
}
