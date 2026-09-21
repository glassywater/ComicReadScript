import { type Promisable, type ReadonlyDeep } from 'type-fest';

import { type ToolbarButtonList } from '../defaultButtonList';
import { type SettingList } from '../defaultSettingList';
import { type ComicImg, type FillEffect, type PageList } from './image';
import { type Option } from './option';

type PropState = {
  /** 评论列表 */
  commentList: string[] | undefined;

  /** 快捷键配置 */
  hotkeys: Record<string, string[]>;
  prop: {
    /** 点击结束页按钮时触发的回调 */
    onExit?: (isEnd?: boolean) => void;
    /** 点击上一话按钮时触发的回调 */
    onPrev?: () => Promisable<void>;
    /** 点击下一话按钮时触发的回调 */
    onNext?: () => Promisable<void>;

    /** 图片加载状态发生变化时触发的回调 */
    onLoading?: (imgList: ComicImg[], img?: ComicImg) => Promisable<void>;
    /** 图片加载失败时触发的回调 */
    onImgError?: (url: string) => Promisable<void>;
    /** 配置发生变化时触发的回调 */
    onOptionChange?: (option: Partial<Option>) => Promisable<void>;
    /** 快捷键配置发生变化时触发的回调 */
    onHotkeysChange?: (hotkeys: Record<string, string[]>) => Promisable<void>;
    /** 显示图片发生变化时触发的回调 */
    onShowImgsChange?: (
      info: ReadonlyDeep<{
        /** 当前显示的图片索引 */
        showImgs: Set<number>;
        /** 图片数据列表 */
        imgList: ComicImg[];
        /** 当前显示的页面范围 */
        showRange: [number, number];
        /** 页面列表 */
        pageList: PageList;
        /** 当前显示的第一张图片的索引 */
        activeImgIndex: number;
        /** 当前生效的页面填充数据 */
        fillEffect: FillEffect;
      }>,
    ) => Promisable<unknown>;
    /** 每次加载范围改变后触发的回调，返回加载范围中等待 url 的图片的 index */
    onWaitUrlImgs?: (indexs: Set<number>, imgList: ComicImg[]) => void;

    editButtonList: (list: ToolbarButtonList) => ToolbarButtonList;
    editSettingList: (list: SettingList) => SettingList;
  };
};

export const propState: PropState = {
  commentList: undefined,

  hotkeys: {},

  prop: {
    onExit: undefined,
    onPrev: undefined,
    onNext: undefined,

    onLoading: undefined,
    onOptionChange: undefined,
    onHotkeysChange: undefined,

    editButtonList: (list) => list,
    editSettingList: (list) => list,
  },
};
