import { createEffectOn, lang } from 'helper';
import {
  type Component,
  For,
  type JSX,
  type ParentComponent,
  Show,
  createSignal,
} from 'solid-js';

import { bindRef } from '../actions';
import { defaultSettingList } from '../defaultSettingList';
import { stopPropagation } from '../helper';
import classes from '../index.module.css';
import { store } from '../store';

export const SettingBlockSubtitle: ParentComponent<{
  onClick?: () => void;
}> = (props) => (
  <div
    class={classes.SettingBlockSubtitle}
    on:click={props.onClick}
    children={props.children}
  />
);

type SettingPanelContainerProps = {
  ref?: (el: HTMLDivElement) => void;
  children?: JSX.Element | JSX.Element[];
  class?: string;
  style?: JSX.CSSProperties;
};

/** 侧边面板通用容器 */
export const SettingPanelContainer: ParentComponent<
  SettingPanelContainerProps
> = (props) => {
  let panelRef!: HTMLDivElement; // oxlint-disable-line no-unassigned-vars

  return (
    <div
      ref={(e) => {
        panelRef = e;
        if (typeof props.ref === 'function') props.ref(e);
      }}
      class={[
        classes.SettingPanel,
        classes.beautifyScrollbar,
        props.class,
      ].join(' ')}
      style={props.style}
      onWheel={(e) =>
        panelRef.scrollHeight > panelRef.clientHeight && e.stopPropagation()
      }
      onScroll={stopPropagation}
      on:click={stopPropagation}
    >
      {props.children}
    </div>
  );
};

/** 设置菜单面板 */
export const SettingPanel: Component = () => (
  <SettingPanelContainer
    ref={bindRef('settingPanel')}
    style={{ width: lang() === 'zh' ? '15em' : '20em' }}
  >
    <For each={store.prop.editSettingList(defaultSettingList())}>
      {([name, SettingItem, options], i) => {
        const initShow = options?.initShow;
        const [show, setShwo] = createSignal(Boolean(initShow));

        if (typeof initShow === 'function')
          createEffectOn(initShow, (val) => setShwo(val));

        return (
          <Show when={options?.hidden ? !options.hidden() : true}>
            {i() ? <hr /> : null}
            <div class={classes.SettingBlock} data-show={show()}>
              <SettingBlockSubtitle onClick={() => setShwo((prev) => !prev)}>
                {name}
                {show() ? null : '…'}
              </SettingBlockSubtitle>
              <div class={classes.SettingBlockBody}>
                <SettingItem />
              </div>
            </div>
          </Show>
        );
      }}
    </For>
  </SettingPanelContainer>
);
