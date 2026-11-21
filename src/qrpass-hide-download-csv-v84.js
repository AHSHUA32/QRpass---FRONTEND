/* QRPass v84: visually remove only buttons labeled exactly "Download CSV". */
(() => {
  const styleId = 'qrpass-v84-hide-download-csv';
  const hiddenClass = 'qrpass-v84-csv-hidden';
  const selector = 'button, a[role="button"], [role="button"]';
  if (!document.getElementById(styleId)) {
    const css = document.createElement('style');
    css.id = styleId;
    css.textContent = '.' + hiddenClass + '{display:none!important;}';
    (document.head || document.documentElement).appendChild(css);
  }
  const normalize = text => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  let scheduled = false;
  function refresh() {
    scheduled = false;
    document.querySelectorAll(selector).forEach(button => {
      const label = normalize(button.textContent);
      const shouldHide = label === 'download csv';
      button.classList.toggle(hiddenClass, shouldHide);
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(refresh);
    else Promise.resolve().then(refresh);
  }
  // React frequently re-renders toolbars. Track child/text changes, not classes,
  // so marking an element never causes an observation loop.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {childList: true, characterData: true, subtree: true});
  schedule();
  document.addEventListener('DOMContentLoaded', schedule, {once: true});
})();
