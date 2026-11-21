/* QRPASS USER LIST FOOTER GAP V57 */
(() => {
  if (typeof document === 'undefined' || window.__qrpassUserFooterGapV57) return;
  window.__qrpassUserFooterGapV57 = true;
  const tableSelector = '[data-qrpass-users-table-v57="true"]';
  const footerSelector = '[data-qrpass-users-footer-v57="true"]';
  let queued = false;
  let tableObserved = null;
  let footerObserved = null;
  const resizer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;

  function apply() {
    queued = false;
    const wrap = document.querySelector(tableSelector);
    const footer = document.querySelector(footerSelector);
    const table = wrap && wrap.querySelector('table');
    if (!table || !footer || !table.isConnected || !footer.isConnected) return;
    // Observe the actual React nodes even when records are reloaded.
    if (resizer && (tableObserved !== table || footerObserved !== footer)) {
      resizer.disconnect();
      resizer.observe(table);
      resizer.observe(footer);
      tableObserved = table;
      footerObserved = footer;
    }
    const bottom = table.getBoundingClientRect().bottom;
    const top = footer.getBoundingClientRect().top;
    const gap = Math.round((top - bottom) * 10) / 10;
    if (gap > 2 && gap < 65) {
      // Remove exactly the rendered empty gap; never overlap the last row.
      const previousMargin = parseFloat(footer.style.getPropertyValue('margin-top')) || 0;
      footer.style.setProperty('margin-top', (previousMargin - gap) + 'px', 'important');
      footer.style.setProperty('position', 'relative', 'important');
      footer.style.setProperty('z-index', '1', 'important');
      footer.style.setProperty('background-color', '#ffffff', 'important');
    }
  }
  function schedule() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(apply);
    }
  }
  const observer = new MutationObserver(schedule);
  function start() {
    observer.observe(document.getElementById('root') || document.documentElement, {
      childList: true, subtree: true
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
