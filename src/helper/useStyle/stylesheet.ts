import { type Accessor } from 'solid-js';

import { createEffectOn, createRootMemo, onAutoMount } from '../solidJs';

export const useStyleSheet = (e?: Element | null) => {
  const styleSheet = new CSSStyleSheet();

  onAutoMount(() => {
    const root = (e?.getRootNode() as Document) ?? document;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, styleSheet];
    return () => {
      const index = root.adoptedStyleSheets.indexOf(styleSheet);
      if (index !== -1) root.adoptedStyleSheets.splice(index, 1);
    };
  });

  return styleSheet;
};

export const useStyle = (
  cssText: string | Accessor<string>,
  e?: Element | null,
) => {
  const styleSheet = useStyleSheet(e);
  if (typeof cssText === 'string') styleSheet.replaceSync(cssText);
  else
    createEffectOn(createRootMemo(cssText), (style) =>
      styleSheet.replaceSync(style),
    );
};
