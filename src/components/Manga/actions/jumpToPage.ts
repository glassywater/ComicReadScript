import { askInput } from 'components/InputDialog';
import { toast } from 'components/Toast';
import { inRange, sleep, t } from 'helper';

import { store } from '../store';
import { activeImgIndex } from './memo';
import { saveReadProgress } from './readProgress';
import { jumpToImg } from './scroll';

/** 弹窗跳转到指定页数（页数按图片序号计算，范围为 1 ~ imgList.length） */
export const jumpToPage = async (): Promise<void> => {
  const total = store.imgList.length;
  if (total === 0) return;

  const input = await askInput({
    message: t('other.jump_page_message'),
    tip: t('other.range_tip', { total }),
    defaultValue: `${activeImgIndex() + 1}`,
    type: 'number',
  });
  if (input === null) return;

  const index = Number(input.trim()) - 1;
  if (!inRange(0, index, total - 1)) {
    toast.error(t('other.jump_page_invalid'));
    await sleep(200);
    return jumpToPage();
  }

  if (index === activeImgIndex()) return;

  jumpToImg(index);

  // 卷轴模式需要等滚动事件同步到 activePageIndex 后才能读到新位置，
  // 所以延后到滚动事件处理完再保存阅读进度
  setTimeout(() => saveReadProgress());
};
