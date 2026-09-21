import { type FabProps } from 'components/Fab';
import { type ComicImgData, type MangaProps } from 'components/Manga';
import { type SetStateFunction } from 'helper';
import { type Accessor, type Component } from 'solid-js';
import { type Promisable } from 'type-fest';

export type SpeedDialButton = {
  /** 按钮名称/提示文本 */
  name: string;
  /** 点击回调 */
  onClick: () => void;
  /** 图标 */
  icon: Component;
};

export type ChapterId = string | number;

export type ImgListKey = string | number;

/** 阅读器可显示的一个内容单元（图片列表 + 加载器 + 附属数据） */
export type ImgListEntry<T extends Record<string, any> = any> = {
  /** undefined 表示还未开始加载，空数组表示刚开始加载 */
  imgList?: MangaProps['imgList'];
  getImgList: ((
    coreCtx: CoreContext<T>,
  ) => Promisable<MangaProps['imgList']>) & {
    type?: 'init' | 'multiSelect';
  };
  adList?: Set<number>;
  commentList?: MangaProps['commentList'];
};

/** 章节信息 */
export type Chapter<Id extends ChapterId = ChapterId> = {
  id: Id;
  title: string;
  /** 章节页面的 url */
  url: string;
};

export type ChapterImgListLoader<Id extends ChapterId = ChapterId> = (
  chapterId: Id,
  coreCtx: CoreContext,
) => Promisable<MangaProps['imgList']>;

export type InitChaptersOptions<Id extends ChapterId = ChapterId> = {
  /** 当前所在章节的 id */
  currentId: Id;
  /** 获取完整的章节列表 */
  getChapterList: () => Promisable<Chapter<Id>[]>;
  /** 获取指定章节下的所有图片 */
  getChapterImgList: ChapterImgListLoader<Id>;
  /** 获取指定章节下的评论 */
  getComments?: (chapterId: Id) => Promisable<MangaProps['commentList']>;
};

export type SiteOptions = {
  option: MangaProps['option'];
  defaultOption: MangaProps['defaultOption'];

  /** 自动进入阅读模式 */
  autoShow: boolean;
  /** 锁定站点配置 */
  lockOption: boolean;
  /** 隐藏 FAB */
  hiddenFab: boolean;
  /** FAB 位置偏移 */
  fabPosition: { top: number; left: number };
};

export type CoreStore<T extends Record<string, any>> = {
  fab: FabProps & {
    optionsSpeedDial?: string[];
    extraSpeedDial?: SpeedDialButton[];
    /** 覆盖默认的 speedDial，有值时将直接使用它 */
    overrideSpeedDial?: SpeedDialButton[];
  };
  manga: MangaProps;
  hotkeys: Record<string, string[]>;

  imgListMap: Record<ImgListKey, ImgListEntry<T>>;
  currentImgListId: string | number;

  /** 由漫画页 pageCtx 的 id 字段决定 */
  comicId?: string;

  /** 站点名 */
  name: string;
  /** 站点配置 */
  options: T & SiteOptions;

  flag: {
    /** 是否存过配置 */
    isStored: boolean;
    /** 当前是否还需要判断 autoShow */
    needAutoShow: boolean;
    /** 当前是否有对应的页面处理逻辑 */
    hasPageHandler: boolean;
    /** 当前是否处于章节模式 */
    isChapterMode: boolean;
  };
};

export type CoreContext<T extends Record<string, any> = Record<string, any>> = {
  store: CoreStore<T>;
  setState: SetStateFunction<CoreStore<T>>;

  options: CoreStore<T>['options'];
  // TODO: 不知道为啥，这里必须使用 K = T 来中转一下，不然就会报错，应该是 bug 吧
  setOptions: <K = T>(newOptions: Partial<K & SiteOptions>) => Promisable<void>;
  showComic: (id?: string | number) => Promise<void>;
  loadComic: (id?: string | number) => Promise<void>;
  init: (autoShow?: boolean) => void;

  canLoadComic: Accessor<boolean>;
  canMultiSelect: Accessor<boolean>;

  /** 动态加载图片列表 */
  dynamicLoad: (
    loadImg: (
      setImg: (i: number, url: string | ComicImgData) => void,
    ) => Promisable<void>,
    length: number | Accessor<number>,
    id?: string | number,
  ) => Promise<MangaProps['imgList']>;

  /** 动态加载图片列表，但只在加载到对应页面时才加载 */
  dynamicLazyLoad: (config: {
    loadImg: (i: number) => Promise<string | ComicImgData>;
    length: number | Accessor<number>;
    id?: string | number;
    /** 并发数 */
    concurrency?: number;
  }) => Promise<MangaProps['imgList']>;
};
