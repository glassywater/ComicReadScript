import { type JSX } from 'solid-js';
import { render } from 'solid-js/web';

import {
  effectiveDark,
  registerSelfDom,
  startDetectSiteDark,
} from './darkMode';
import { createEffectOn } from './solidJs';

const getDom = (id: string) => {
  let dom = document.getElementById(id) as HTMLDivElement | undefined;
  if (dom) {
    dom.innerHTML = '';
    return dom;
  }

  dom = document.createElement('div');
  dom.id = id;
  document.body.append(dom);
  return dom;
};

/** 挂载 solid-js 组件 */
export const mountComponents = (id: string, fc: () => JSX.Element) => {
  const dom = getDom(id);
  dom.style.setProperty('display', 'unset', 'important');
  registerSelfDom(dom);
  // 有组件被挂载时才检测网站色调，避免在无关网页上消耗性能
  startDetectSiteDark();
  const shadowDom = dom.attachShadow({ mode: 'closed' });
  render(fc, shadowDom);
  // 将色调同步到挂载点上，让 Shadow DOM 内的 light-dark() 和原生控件随之切换
  createEffectOn(effectiveDark, (dark) => {
    dom.style.setProperty('color-scheme', dark ? 'dark' : 'light');
  });
  return dom;
};
