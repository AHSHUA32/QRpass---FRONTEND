/* QRPASS USER DROPDOWN HOVER V63 */
(() => {
  if (typeof document === 'undefined' || window.__qrpassUserDropdownHoverV63) return;
  window.__qrpassUserDropdownHoverV63 = true;

  const targetNames = new Set(['Filter user roles', 'Sort user accounts']);
  const popupSelector = '.qrp-v51-popup, .qrp-v50-popup, .qrp-v52-popup';
  const optionSelector = '[role="option"]';
  const normalColor = '#f7f9ff';
  const selectedColor = '#dfe8ff';
  const hoverColor = '#d6e3ff';

  let pointerX = -9999;
  let pointerY = -9999;
  let lastMenu = null;
  let lastRow = null;
  let scheduled = false;

  function getMenu(el) {
    const menu = el instanceof Element ? el.closest(popupSelector) : null;
    return menu instanceof HTMLElement && targetNames.has(menu.getAttribute('aria-label') || '') ? menu : null;
  }
  function getRow(el) {
    return el instanceof Element ? el.closest(optionSelector) : null;
  }
  function selected(row) {
    return row.getAttribute('aria-selected') === 'true' ||
      row.getAttribute('data-selected') === 'true' ||
      row.getAttribute('data-state') === 'checked';
  }
  function disabled(row) {
    return row.getAttribute('aria-disabled') === 'true' || row.hasAttribute('disabled');
  }
  function write(row, bg) {
    if (!(row instanceof HTMLElement)) return;
    const style = row.style;
    // Override inline !important styles from v51 and any former v62 runtime.
    if (style.getPropertyValue('background') !== bg ||
        style.getPropertyPriority('background') !== 'important') {
      style.setProperty('background', bg, 'important');
    }
    if (style.getPropertyValue('background-color') !== bg ||
        style.getPropertyPriority('background-color') !== 'important') {
      style.setProperty('background-color', bg, 'important');
    }
    if (style.getPropertyValue('background-image') !== 'none') {
      style.setProperty('background-image', 'none', 'important');
    }
    if (style.getPropertyValue('transition') !== 'background-color 65ms ease-out') {
      style.setProperty('transition', 'background-color 65ms ease-out', 'important');
    }
  }
  function paint(menu, hoveredRow) {
    if (!menu || !menu.isConnected) return;
    const rows = menu.querySelectorAll(optionSelector);
    rows.forEach(row => {
      const onRow = row === hoveredRow && !disabled(row);
      const bg = onRow ? hoverColor : selected(row) ? selectedColor : normalColor;
      write(row, bg);
    });
    lastMenu = menu;
    lastRow = hoveredRow;
  }

  function currentElement() {
    return document.elementFromPoint(pointerX, pointerY);
  }
  function updateFromPointer() {
    const element = currentElement();
    const menu = getMenu(element);
    if (lastMenu && lastMenu !== menu) paint(lastMenu, null);
    if (menu) paint(menu, getRow(element));
  }
  function queueAfterOldListeners() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateFromPointer();
    });
  }

  // v51 updates its own .qrp-v51-active class on pointerenter. A delegated
  // pointermove handler resets the *previous* row, not only the new row.
  function onMove(e) {
    if (e.pointerType === 'touch') return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    const source = e.target instanceof Element ? e.target : null;
    const menu = getMenu(source);
    if (!menu && !lastMenu) return;
    if (lastMenu && lastMenu !== menu) paint(lastMenu, null);
    if (menu) paint(menu, getRow(source));
    queueAfterOldListeners();
  }
  document.addEventListener('pointermove', onMove, {capture:true, passive:true});
  document.addEventListener('mousemove', e => {
    // Handles mouse movement where pointer events may be synthesized differently.
    if (!window.PointerEvent) onMove(e);
  }, {capture:true, passive:true});

  document.addEventListener('pointerover', e => {
    const menu = getMenu(e.target);
    if (menu || lastMenu) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (lastMenu && lastMenu !== menu) paint(lastMenu, null);
      if (menu) paint(menu, getRow(e.target));
      queueAfterOldListeners();
    }
  }, true);
  document.addEventListener('pointerout', e => {
    const fromMenu = getMenu(e.target);
    if (!fromMenu) return;
    const toMenu = getMenu(e.relatedTarget);
    if (toMenu !== fromMenu) paint(fromMenu, null);
    else paint(fromMenu, getRow(e.relatedTarget));
    queueAfterOldListeners();
  }, true);
  document.addEventListener('pointerleave', e => {
    // Capture catches non-bubbling pointerleave before stale hover can remain.
    const menu = getMenu(e.target);
    if (menu && !getMenu(e.relatedTarget)) {
      paint(menu, null);
    }
  }, true);

  // On opening a menu, its selected option remains blue but other options start
  // neutral. No setInterval, busy polling, or mutation-on-style loop.
  function onMenusChanged() {
    document.querySelectorAll(popupSelector).forEach(menu => {
      if (!(menu instanceof HTMLElement) || !targetNames.has(menu.getAttribute('aria-label') || '')) return;
      menu.setAttribute('data-qrpass-user-hover-v63', 'true');
      const hit = currentElement();
      paint(menu, getMenu(hit) === menu ? getRow(hit) : null);
    });
    if (lastMenu && !lastMenu.isConnected) {
      lastMenu = null;
      lastRow = null;
    }
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => r.type === 'childList')) onMenusChanged();
  });
  function start() {
    observer.observe(document.documentElement, {subtree:true, childList:true});
    onMenusChanged();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else start();
})();