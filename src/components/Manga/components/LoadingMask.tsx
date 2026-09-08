import { t } from 'helper';
import { type Component } from 'solid-js';

import { stopPropagation } from '../helper';
import classes from '../index.module.css';

/** imgList 为空时显示的加载提示 */
export const LoadingMask: Component = () => (
  <div
    class={classes.loadingMask}
    on:click={stopPropagation}
    on:mousedown={stopPropagation}
    on:wheel={stopPropagation}
  >
    <p>{t('alert.repeat_load')}</p>
  </div>
);
