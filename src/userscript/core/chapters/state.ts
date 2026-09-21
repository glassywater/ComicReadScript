import { type MangaProps } from 'components/Manga';
import { createSignal } from 'solid-js';
import { type Promisable } from 'type-fest';

import {
  type Chapter,
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
