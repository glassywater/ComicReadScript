import { plimit, range } from 'helper';

import { pcApi } from './client';
import { decryptData } from './decrypt';

/** 章节目录获取失败的统一错误提示 */
const errorText = '加載漫畫目錄失敗';

export type ChaptersGroup = {
  name: string;
  path_word: string;
  chapters: { type: number; name: string; id: string }[];
  last_chapter: {
    comic_id: string;
    name: string;
    datetime_created: string;
    uuid: string;
  };
};

export type Chapters = {
  build: { type: { id: number; name: string }[] };
  groups: Record<string, ChaptersGroup>;
};

/**
 * 获取漫画目录
 *
 * 会受反爬机制影响返回空数据，因此仅作为备用
 */
export const getChaptersLegacy = async (comicId: string): Promise<Chapters> => {
  const {
    response: { results },
  } = await pcApi.get<{ results: string }>(`/comicdetail/${comicId}/chapters`, {
    errorText,
  });
  return decryptData<Chapters>(results);
};

type Group = { path_word: string; name: string };
type GroupChapter = {
  type: number;
  name: string;
  uuid: string;
  path_word: string;
  comic_id: string;
  size?: number;
  ordered?: number;
  datetime_created?: string;
  next?: string | null;
};

const typeNameMap: Record<number, string> = { 1: '話', 2: '卷', 3: '番外篇' };

/** 获取漫画目录 */
export const getChaptersByApi = async (comicId: string) => {
  const groupsRes = await pcApi.eachGet<{
    results: { groups?: Group[] | Record<string, Group> };
  }>(`/api/v3/comic2/${comicId}`, { errorText });
  const rawGroups = groupsRes.response.results.groups;
  const groups = (
    Array.isArray(rawGroups) ? rawGroups : Object.values(rawGroups ?? {})
  ).filter(({ path_word }) => path_word);
  // 无 groups 时兜底为一个组
  if (groups.length === 0) groups.push({ path_word: 'default', name: '默认' });

  const getChaptersPage = (pathWord: string, offset: number) =>
    pcApi.eachGet<{
      results: { total: number; list: GroupChapter[] };
    }>(
      `/api/v3/comic/${comicId}/group/${pathWord}/chapters?limit=100&offset=${offset}&_update=true`,
      { errorText },
    );

  // 先取第一页拿到 total，再并发获取剩余分页
  const firstPageList = await plimit(
    groups.map((group) => async () => {
      const res = await getChaptersPage(group.path_word, 0);
      return res.response.results;
    }),
  );

  const restTaskList = firstPageList.flatMap(({ total }, groupIndex) =>
    total <= 100
      ? []
      : range(1, Math.ceil(total / 100)).map((page) => async () => {
          const res = await getChaptersPage(
            groups[groupIndex].path_word,
            page * 100,
          );
          return { groupIndex, list: res.response.results.list };
        }),
  );
  const restList = await plimit(restTaskList);

  // 按分组归并剩余页（restList 已按分组、页码顺序排列）
  const restByGroup = new Map<number, GroupChapter[]>();
  for (const { groupIndex, list } of restList) {
    const groupList = restByGroup.get(groupIndex);
    if (groupList) groupList.push(...list);
    else restByGroup.set(groupIndex, [...list]);
  }

  return {
    groups,
    chaptersByGroup: groups.map((group, i) => ({
      group,
      list: [...firstPageList[i].list, ...(restByGroup.get(i) ?? [])],
    })),
  };
};

/** 将接口返回数据转换为统一的目录结构 */
const transformFromGetChaptersByApi = (raw: {
  groups: Group[];
  chaptersByGroup: { group: Group; list: GroupChapter[] }[];
}): Chapters => {
  const build: Chapters['build'] = {
    type: Object.entries(typeNameMap).map(([id, name]) => ({
      id: Number(id),
      name,
    })),
  };

  const groups: Record<string, ChaptersGroup> = {};
  for (const { group, list } of raw.chaptersByGroup) {
    const chapters = list.map(({ type, name, uuid }) => ({
      type,
      name,
      id: uuid,
    }));
    // 最新一章：以 next === null 定位，没有则取最后一个
    const lastRaw = list.find((ch) => ch.next === null) ?? list.at(-1);
    groups[group.path_word] = {
      path_word: group.path_word,
      name: group.name,
      chapters,
      last_chapter: lastRaw
        ? {
            comic_id: lastRaw.comic_id,
            name: lastRaw.name,
            datetime_created: lastRaw.datetime_created ?? '',
            uuid: lastRaw.uuid,
          }
        : { comic_id: '', name: '', datetime_created: '', uuid: '' },
    };
  }

  return { build, groups };
};

/** 获取漫画目录（优先新接口，失败时用旧接口兜底） */
export const getChapters = async (comicId: string): Promise<Chapters> => {
  try {
    return transformFromGetChaptersByApi(await getChaptersByApi(comicId));
  } catch {
    return getChaptersLegacy(comicId);
  }
};
