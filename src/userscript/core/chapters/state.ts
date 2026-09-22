import { type MangaProps } from 'components/Manga';
import { createSignal } from 'solid-js';
import { type Promisable } from 'type-fest';

import {
  type Chapter,
  type ChapterGroup,
  type ChapterId,
  type ChapterImgListLoader,
  type CoreContext,
  type InitChaptersOptions,
} from '../types';

export type ChapterManager = {
  coreCtx: CoreContext;
  comicId: string;
  /** 计算章节条目在 imgListMap 中的 key */
  key: (id: ChapterId) => string;
  groupList: ChapterGroup[];
  /** 全部章节按分组顺序压平的列表（创建时派生的只读缓存） */
  chapterList: Chapter[];
  getChapterImgList: ChapterImgListLoader;
  getComments?: InitChaptersOptions['getComments'];
  cache: Map<ChapterId, Promise<MangaProps['imgList']>>;
  registrations: Map<
    ChapterId,
    (coreCtx: CoreContext) => Promisable<MangaProps['imgList']>
  >;
};

export const [getChapterManager, setChapterManager] = createSignal<
  ChapterManager | undefined
>();
