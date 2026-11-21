/* QRPASS MANAGE LOGS SYSTEM SETTINGS V46 */
(() => {
  const MODAL_ATTR = 'data-qrpass-manage-logs-v46';
  const TITLE_ATTR = 'data-qrpass-manage-logs-title-v46';
  const TOOLBAR_ATTR = 'data-qrpass-manage-logs-toolbar-v46';
  const SEARCH_ATTR = 'data-qrpass-manage-logs-search-v46';
  const GRID_ATTR = 'data-qrpass-manage-logs-grid-v46';
  const FOOTER_ATTR = 'data-qrpass-manage-logs-footer-v46';
  const ACTION_ATTR = 'data-qrpass-manage-logs-action-v46';
  const CLOSE_ATTR = 'data-qrpass-manage-logs-close-v46';

  function text(node) {
    return (node?.textContent || '').replace(/s+/g, ' ').trim();
  }

  function isButtonLike(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.matches('button, a, [role="button"]');
  }

  function findButton(root, label) {
    return [...root.querySelectorAll('button, a, [role="button"]')]
      .find(el => text(el) === label) || null;
  }

  function markModal() {
    const titles = [...document.querySelectorAll('h1,h2,h3,h4,div,span')]
      .filter(el => text(el) === 'Manage Logs');

    for (const title of titles) {
      const container = title.closest('div');
      if (!container) continue;

      const candidates = [];
      let probe = container;
      for (let i = 0; i < 8 && probe; i++) {
        candidates.push(probe);
        probe = probe.parentElement;
      }

      for (const modal of candidates) {
        const hasClose = !!findButton(modal, 'Close');
        const hasArchiveView = !!findButton(modal, 'View Archives');
        const hasSearch = !!modal.querySelector('input[placeholder*="Search records" i]');
        const hasSelectAll = !!findButton(modal, 'Select All');
        const hasDownload = !!findButton(modal, 'Download');
        if (!(hasClose && hasArchiveView && hasSearch && hasSelectAll && hasDownload)) continue;

        modal.setAttribute(MODAL_ATTR, 'true');
        title.setAttribute(TITLE_ATTR, 'true');

        const search = modal.querySelector('input[placeholder*="Search records" i]');
        if (search) search.setAttribute(SEARCH_ATTR, 'true');

        const closeBtn = findButton(modal, 'Close');
        if (closeBtn) closeBtn.setAttribute(CLOSE_ATTR, 'true');

        const archiveBtn = findButton(modal, 'View Archives');
        if (archiveBtn) archiveBtn.setAttribute(ACTION_ATTR, 'true');
        const selectAllBtn = findButton(modal, 'Select All');
        if (selectAllBtn) selectAllBtn.setAttribute(ACTION_ATTR, 'true');
        const downloadBtn = findButton(modal, 'Download');
        if (downloadBtn) downloadBtn.setAttribute(ACTION_ATTR, 'true');
        const archiveActionBtn = findButton(modal, 'Archive');
        if (archiveActionBtn) archiveActionBtn.setAttribute(ACTION_ATTR, 'true');

        const toolbar = search?.parentElement;
        if (toolbar && toolbar.querySelector('input[placeholder*="Search records" i]')) {
          toolbar.setAttribute(TOOLBAR_ATTR, 'true');
        }

        const allScrollable = [...modal.querySelectorAll('div')].filter(el => {
          const st = getComputedStyle(el);
          return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.querySelector('input[type="checkbox"]');
        });
        const grid = allScrollable.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
        if (grid) grid.setAttribute(GRID_ATTR, 'true');

        const footer = [selectAllBtn, downloadBtn, archiveActionBtn]
          .map(btn => btn?.parentElement)
          .find(Boolean);
        if (footer) {
          const footerWrap = footer.closest('div');
          if (footerWrap) footerWrap.setAttribute(FOOTER_ATTR, 'true');
        }

        const headers = [...modal.querySelectorAll('th')];
        headers.forEach(th => th.setAttribute('data-qrpass-manage-logs-th-v46', 'true'));

        const titlesInside = [...modal.querySelectorAll('strong,b,h4,h5,span,div')]
          .filter(el => /system administrator/i.test(text(el)) && text(el).length < 60);
        titlesInside.forEach(el => el.setAttribute('data-qrpass-manage-logs-record-title-v46', 'true'));

        const statusLike = [...modal.querySelectorAll('td,span,div')]
          .filter(el => /^Success$/i.test(text(el)) || /^Error$/i.test(text(el)) || /^Warning$/i.test(text(el)));
        statusLike.forEach(el => el.setAttribute('data-qrpass-manage-logs-status-v46', 'true'));

        return;
      }
    }
  }

  function cleanRemoved() {
    document.querySelectorAll('[' + MODAL_ATTR + '="true"]').forEach(modal => {
      if (!document.body.contains(modal)) return;
      const stillValid = !!findButton(modal, 'Close') && !!modal.querySelector('input[placeholder*="Search records" i]');
      if (!stillValid) {
        const attrs = [
          MODAL_ATTR, TITLE_ATTR, TOOLBAR_ATTR, SEARCH_ATTR, GRID_ATTR, FOOTER_ATTR,
          ACTION_ATTR, CLOSE_ATTR,
          'data-qrpass-manage-logs-th-v46', 'data-qrpass-manage-logs-record-title-v46', 'data-qrpass-manage-logs-status-v46'
        ];
        attrs.forEach(attr => {
          if (modal.hasAttribute?.(attr)) modal.removeAttribute(attr);
          modal.querySelectorAll('[' + attr + ']').forEach(el => el.removeAttribute(attr));
        });
      }
    });
  }

  const run = () => { cleanRemoved(); markModal(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  const observer = new MutationObserver(() => run());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
