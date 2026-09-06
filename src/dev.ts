GM_xmlhttpRequest({
  method: 'GET',
  url: `http://localhost:2405/index.js?${Date.now()}`,
  timeout: 1000 * 5,
  onload(r) {
    if (r.status !== 200)
      throw new Error(`${r.finalUrl}: ${r.status} ${r.statusText}`);

    const tempName = `__crsDev_${Math.random().toString(36).slice(2)}`;
    unsafeWindow[tempName] = {
      GM: typeof GM === 'undefined' ? undefined : GM,
      GM_addElement:
        typeof GM_addElement === 'undefined' ? undefined : GM_addElement,
      GM_getResourceText:
        typeof GM_getResourceText === 'undefined'
          ? undefined
          : GM_getResourceText,
      GM_xmlhttpRequest:
        typeof GM_xmlhttpRequest === 'undefined'
          ? undefined
          : GM_xmlhttpRequest,
      unsafeWindow,
    };
    GM_addElement('script', {
      textContent: `(async (GM, GM_addElement, GM_getResourceText, GM_xmlhttpRequest, unsafeWindow) => {
${r.responseText}
})(
  window['${tempName}'].GM,
  window['${tempName}'].GM_addElement,
  window['${tempName}'].GM_getResourceText,
  window['${tempName}'].GM_xmlhttpRequest,
  window['${tempName}'].unsafeWindow
);`,
    })?.remove();
    Reflect.deleteProperty(unsafeWindow, tempName);
  },
  onerror(e) {
    if (e?.status === 0) throw new Error('dev server not running');
  },
});
