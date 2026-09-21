import { type MangaProps } from 'components/Manga';

type ShowImgsInfo = Parameters<NonNullable<MangaProps['onShowImgsChange']>>[0];

/** 显示图片变化的监听器 */
export type ShowImgsListener = (info: ShowImgsInfo) => unknown;

const listeners = new Set<ShowImgsListener>();
/** 对 manga.onShowImgsChange 的包装，以便能让多个模块同时监听显示图片变化 */
export const addShowImgsListener = (listener: ShowImgsListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** 将显示图片变化分发给所有已注册的监听器 */
export const dispatchShowImgsChange: NonNullable<
  MangaProps['onShowImgsChange']
> = (info) => {
  for (const listener of listeners) listener(info);
};
