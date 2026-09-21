import MdChecklist from '@material-design-icons/svg/round/checklist.svg';
import { type MangaProps, listenHotkey } from 'components/Manga';
import {
  PQueue,
  createEffectOn,
  createRootMemo,
  inRange,
  isEqual,
  log,
  singleThreaded,
  t,
  useCache,
  wait,
} from 'helper';
import { createRoot, createSignal } from 'solid-js';
import { type Promisable } from 'type-fest';

import { registerEsc } from '../escManager';
import { type CoreContext } from '../types';
import { type UseMultiSelectOptions, useMultiSelect } from './useMultiSelect';

/**
 * 多选加载缓存结构
 * - pending: 未确认的选择项
 * - confirmed: 已确认的选择项
 */
type MultiSelectCache = {
  pending: { id: string; selecteds: string[] };
  confirmed: { id: string; selecteds: string[] };
};

export type MultiSelectLoadOptions = {
  /** 当前列表的唯一标识，用于区分不同列表的选择项 */
  id: string;
  /** 在 start 时调用，用于页面 DOM 预处理，返回清理函数 */
  onStart?: UseMultiSelectOptions['onStart'];
  /** 所有可选项的 ID，用于加载全部内容 */
  allItemIds?: () => string[];
  /** 注册当前列表页的可选项 DOM（key 为 DOM 元素，value 为项 ID） */
  registerItems: (map: Map<HTMLElement, string>) => Promisable<void>;
  /** 根据选中项 ID 获取对应的图片列表 */
  getImgList: (id: string) => Promisable<MangaProps['imgList']>;
  /** 页面切换时判断下一个页面是否仍是当前列表，否则将完全销毁控制器 */
  isSameList?: (nextPageCtx?: { type: string; id: string }) => boolean;
};

export const createMultiSelectLoadController = <T extends Record<string, any>>(
  coreCtx: CoreContext<T>,
  options: MultiSelectLoadOptions,
) => {
  const {
    id: initListId,
    onStart,
    allItemIds,
    getImgList,
    isSameList,
  } = options;

  return createRoot(async (rootDispose) => {
    const { store, setState, showComic } = coreCtx;
    const cache = await useCache<MultiSelectCache>(
      { pending: 'id', confirmed: 'id' },
      'MultiSelect',
    );

    const [registeredItems, setRegisteredItems] = createSignal(
      new Map<HTMLElement, string>(),
    );
    const controller = useMultiSelect({ onStart, registeredItems });

    const urlMap: Record<string, MangaProps['imgList']> = {};

    const targetIds = createRootMemo(() => {
      const ids = controller.selectedIds();
      if (controller.isEnabled() && ids.length > 0) return ids;
      return allItemIds?.() ?? [];
    });

    const computeImgList = () =>
      targetIds().flatMap((id) => urlMap[id] ?? ['']);

    /** 将 Manga 组件的扁平图片索引转为对应的选中项 ID */
    const getItemIdsFromIndices = (indices: Set<number>): string[] => {
      const ids: string[] = [];
      let offset = 0;
      for (const id of targetIds()) {
        const len = urlMap[id]?.length ?? 1;
        for (const idx of indices) {
          if (inRange(offset, idx, offset + len - 1)) {
            ids.push(id);
            break;
          }
        }
        offset += len;
      }
      return ids;
    };

    const reSetStore = () => {
      setState('imgListMap', '', {
        getImgList: Object.assign(
          async () => {
            if (store.imgListMap[''].imgList?.length)
              return store.imgListMap[''].imgList;

            await new Promise<void>((resolve) => {
              const queue = new PQueue<string>(async (id) => {
                try {
                  urlMap[id] = await getImgList(id);
                } catch (error) {
                  log.error(error);
                }
                setState('imgListMap', '', 'imgList', computeImgList());
                resolve();
              }, 2);

              setState((state) => {
                state.imgListMap[''].imgList = computeImgList();
                state.manga.onWaitUrlImgs = (imgs) => {
                  queue.set(...getItemIdsFromIndices(imgs));
                };
              });

              // 如果已经有图片url加载好了，就直接 resolve
              // 避免全部加载完毕后再次 getImgList 时无法触发 onWaitUrlImgs
              if (targetIds().some((id) => urlMap[id])) resolve();
            });

            return store.imgListMap[''].imgList!;
          },
          allItemIds ? {} : { type: 'multiSelect' as const },
        ),
      });
    };
    reSetStore();

    const multiSelectLoad = singleThreaded(async () => {
      if (!controller.isEnabled()) {
        controller.start();
        const confirmed = await cache.get('confirmed', initListId);
        if (confirmed) controller.setSelectedIds(confirmed.selecteds);
        return;
      }

      await cache.del('pending', initListId);
      await cache.set('confirmed', {
        id: initListId,
        selecteds: controller.selectedIds(),
      });

      if (controller.selectedIds().length === 0) return;

      setState('imgListMap', '', 'imgList', undefined);
      await showComic('');
    });

    let unregisterEscHandler: (() => void) | undefined;
    createEffectOn([controller.isEnabled], ([enabled]) => {
      // ESC 退出多选模式
      if (enabled) {
        unregisterEscHandler?.();
        unregisterEscHandler = registerEsc(-1, () =>
          controller.isEnabled() && !store.manga.show ? unmount() : 'SKIP',
        );
      }
    });

    setState('fab', 'extraSpeedDial', [
      {
        name: t('hotkeys.multi_select_load'),
        onClick: multiSelectLoad,
        icon: MdChecklist,
      },
    ]);

    // 将当前选中项同步保存到缓存里
    createEffectOn(
      [controller.isEnabled, () => controller.selectedIds().length],
      ([enabled]) => {
        const selecteds = controller.selectedIds();
        (async () => {
          await cache.del('pending', initListId);
          await (selecteds.length === 0
            ? cache.del('confirmed', initListId)
            : cache.set(enabled ? 'pending' : 'confirmed', {
                id: initListId,
                selecteds,
              }));
        })();
      },
      // 跳过初始化，避免误删上次会话保存的 confirmed 缓存
      { defer: true },
    );

    listenHotkey(
      {
        multi_select_load: multiSelectLoad,
        enter_read_mode: () =>
          controller.isEnabled() || !coreCtx.canLoadComic()
            ? multiSelectLoad()
            : coreCtx.showComic(),
      },
      true,
    );

    let oldIdSet: string[] = [];
    /** 清理副作用，但保留选中状态（用于翻页） */
    const unmount = () => {
      setState('imgListMap', '', 'imgList', undefined);
      unregisterEscHandler?.();
      // 保存当前 ID 集合供下次比对
      oldIdSet = [...registeredItems().values()];

      controller.unmount();
    };

    /** 注册当前列表的可选项，等待至和上次的注册项不同 */
    const registerItems = async (
      fillItems: MultiSelectLoadOptions['registerItems'],
    ) => {
      const map = await wait(async () => {
        const newMap = new Map<HTMLElement, string>();
        await fillItems(newMap);
        if (newMap.size === 0) return;
        // IdSet相同，说明 DOM 未更新
        if (isEqual(oldIdSet, [...newMap.values()])) return;
        return newMap;
      }, 5000);

      if (!map) throw new Error('等待新 DOM 超时');

      // 设置注册项，并自动恢复 pending 状态
      setRegisteredItems(map);
      const pending = await cache.get('pending', initListId);
      // 有 pending 时自动恢复选中状态
      if (pending?.selecteds.length) {
        controller.start();
        controller.setSelectedIds(pending.selecteds);
      }
    };

    const completeDispose = () => {
      oldIdSet = [];
      unmount();
      controller.dispose();
      // 清空 registeredItems，避免旧 DOM 引用残留
      setRegisteredItems(new Map());
      setMultiSelectController(undefined);
      rootDispose();
    };

    await registerItems(options.registerItems);

    return {
      reSetStore,
      /** 注册当前列表的可选项，通常由 useMultiSelectLoad 自动调用，无需手动调用 */
      registerItems,
      unmount,
      /** 完全清理所有状态和副作用 */
      dispose: completeDispose,
      /** 页面切换时的清理策略 */
      createCleanup: () => (nextPageCtx?: { type: string; id: string }) => {
        // 同一 list 翻页，只清理副作用，保留实例和选中状态
        unmount();
        // 切换到其他页面时，完全清理
        if (!isSameList?.(nextPageCtx)) completeDispose();
      },
      load: multiSelectLoad,
      start: controller.start,
      isEnabled: controller.isEnabled,
      selectedIds: controller.selectedIds,
      clear: controller.clear,
      setSelectedIds: controller.setSelectedIds,
    };
  });
};

export type MultiSelectLoadController = Awaited<
  ReturnType<typeof createMultiSelectLoadController>
>;

/** 当前的多选加载控制器（core 内部读取，如 useFab） */
export const [multiSelectController, setMultiSelectController] =
  createSignal<MultiSelectLoadController>();

export const useMultiSelectLoad = async <T extends Record<string, any>>(
  coreCtx: CoreContext<T>,
  options: MultiSelectLoadOptions,
) => {
  const controller = multiSelectController();
  if (controller) {
    controller.reSetStore();
    await controller.registerItems(options.registerItems);
    return controller;
  }
  const newController = await createMultiSelectLoadController(coreCtx, options);
  setMultiSelectController(newController);
  return newController;
};
