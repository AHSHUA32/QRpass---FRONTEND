/* Floating listbox for native QRPass selects. The select still owns the form value. */
/* Based on the user-provided v51 source; keeps select events and option lists. */
(() => {
  if (typeof document === 'undefined' || window.__qrpassDropdownV51) return;
  window.__qrpassDropdownV51 = true;
  window.__qrpassDropdownActiveVersion = 'v51';

  let select = null;
  let menu = null;
  let active = -1;
  let entries = [];
  let resizeWatcher = null;
  let optionsWatcher = null;
  let search = "";
  let lastKeyAt = 0;

  function usable(el) {
    return el instanceof HTMLSelectElement && !!el.closest('#root, [role=dialog], [data-qrpass-manage-logs-overlay]') && !el.multiple && el.getAttribute('aria-hidden') !== 'true' && el.size <= 1 &&
      !el.matches(':disabled') && !el.closest('[data-qrpass-native-select]');
  }
  function close() {
    if (resizeWatcher) { resizeWatcher.disconnect(); resizeWatcher = null; }
    if (optionsWatcher) { optionsWatcher.disconnect(); optionsWatcher = null; }
    if (menu) menu.remove();
    search = "";
    lastKeyAt = 0;
    if (select) {
      select.classList.remove('qrp-v51-open');
      select.removeAttribute('aria-expanded');
      select.removeAttribute('aria-controls');
      select.removeAttribute('aria-activedescendant');
    }
    menu = null; select = null; entries = []; active = -1;
  }
  function position() {
    if (!menu || !usable(select) || !select.isConnected) { close(); return; }
    const r = select.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth);
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);
    const gap = 4;
    const padding = 8;
    if (!r.width || !r.height || r.bottom <= topEdge || r.top >= bottomEdge) {
      close();
      return;
    }
    const width = Math.min(r.width, rightEdge - leftEdge - padding * 2);
    const left = Math.max(leftEdge + padding, Math.min(r.left, rightEdge - width - padding));
    const below = bottomEdge - r.bottom - gap - padding;
    const above = r.top - topEdge - gap - padding;
    menu.style.width = `${width}px`;
    menu.style.left = `${left}px`;
    const desiredHeight = Math.min(280, menu.scrollHeight + 2);
    const showAbove = below < desiredHeight && above > below;
    menu.style.maxHeight = `${Math.max(0, Math.min(desiredHeight, showAbove ? above : below))}px`;
    menu.style.top = showAbove ? 'auto' : `${r.bottom + gap}px`;
    menu.style.bottom = showAbove ? `${window.innerHeight - r.top + gap}px` : 'auto';
  }
  function setActive(index, scroll = true) {
    if (!menu || !entries.length) return;
    if (!entries[index] || entries[index].button.getAttribute('aria-disabled') === 'true') return;
    active = index;
    for (const [i, entry] of entries.entries()) {
      entry.button.dataset.active = String(scroll && i === index);
    }
    select.setAttribute('aria-activedescendant', entries[index].button.id);
    if (scroll) {
      const row = entries[index].button.getBoundingClientRect();
      const panel = menu.getBoundingClientRect();
      if (row.top < panel.top) menu.scrollTop += row.top - panel.top;
      else if (row.bottom > panel.bottom) menu.scrollTop += row.bottom - panel.bottom;
    }
  }
  function choose(index) {
    if (!usable(select) || !entries[index] || entries[index].button.getAttribute('aria-disabled') === 'true') return;
    const el = select;
    const option = entries[index].option;
    if (!el.contains(option)) { close(); return; }
    const changed = el.value !== option.value || el.selectedIndex !== option.index;
    // Preserve the native element and dispatch its real events so React forms keep working.
    el.selectedIndex = option.index;
    if (changed) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
    el.focus({ preventScroll: true });
  }
  function open(el) {
    if (!usable(el)) return;
    if (select === el && menu) { close(); return; }
    close();
    select = el;
    const popup = document.createElement('div');
    popup.className = 'qrp-v51-popup qrpass-select-menu qrpass-select-viewport';
    popup.id = 'qrpass-native-select-menu';
    popup.setAttribute('role', 'listbox');
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) popup.setAttribute('aria-labelledby', labelledBy);
    else popup.setAttribute('aria-label', el.getAttribute('aria-label') ||
      Array.from(el.labels ?? [], label => label.textContent.trim()).join(' ') || 'Select an option');
    popup.addEventListener('mousedown', event => {
      if (event.target.closest('.qrp-v51-option')) event.preventDefault();
    });
    menu = popup;
    const opts = Array.from(el.options);
    opts.forEach(opt => {
      if (opt.hidden) return;
      const row = document.createElement('div');
      row.setAttribute('tabindex', '-1');
      row.className = 'qrp-v51-option qrpass-select-option';
      row.id = `${popup.id}-${opt.index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(opt.selected));
      row.textContent = opt.textContent.trim();
      const disabled = opt.disabled || !!opt.closest('optgroup:disabled');
      row.setAttribute('aria-disabled', String(disabled));
      const index = entries.length;
      row.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse') setActive(index, false);
      });
      row.addEventListener('click', () => choose(index));
      popup.appendChild(row);
      entries.push({ option: opt, button: row });
    });
    if (!entries.length) { close(); return; }
    // Match the layer of the owning modal while keeping page menus below modals.
    let layer = 100;
    for (let ancestor = el.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.position === 'fixed') layer = Math.max(layer, Number(style.zIndex) || 0);
    }
    popup.style.zIndex = String(layer + 1);
    document.body.appendChild(popup);
    el.classList.add('qrp-v51-open');
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-controls', popup.id);
    position();
    if (!menu) return;
    optionsWatcher = new MutationObserver(close);
    optionsWatcher.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'label', 'value'] });
    const selected = entries.findIndex(x => x.option.selected && x.button.getAttribute('aria-disabled') !== 'true');
    const first = entries.findIndex(x => x.button.getAttribute('aria-disabled') !== 'true');
    setActive(selected >= 0 ? selected : first);
    if (window.ResizeObserver) {
      resizeWatcher = new ResizeObserver(position);
      resizeWatcher.observe(el);
    }
  }
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.('select');
    if (usable(el)) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      el.focus({ preventScroll: true });
      open(el);
    } else if (menu && !menu.contains(e.target)) close();
  }, true);
  // Prevent native picker from opening after the custom menu is shown.
  document.addEventListener('click', e => {
    if (usable(e.target.closest?.('select'))) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (menu && select && (e.target === select || menu.contains(e.target))) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab') { close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const valid = entries.map((x, i) => x.button.getAttribute('aria-disabled') !== 'true' ? i : -1).filter(i => i >= 0);
        if (!valid.length) return;
        let i = valid.indexOf(active);
        if (e.key === 'Home') i = 0;
        else if (e.key === 'End') i = valid.length - 1;
        else i = (i + (e.key === 'ArrowDown' ? 1 : -1) + valid.length) % valid.length;
        setActive(valid[i]); return;
      }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        const now = Date.now();
        const key = e.key.toLocaleLowerCase();
        search = now - lastKeyAt > 700 ? key : search + key;
        lastKeyAt = now;
        const repeated = [...search].every(char => char === key);
        const query = repeated ? key : search;
        const start = repeated ? active + 1 : Math.max(active, 0);
        for (let offset = 0; offset < entries.length; offset++) {
          const index = (start + offset) % entries.length;
          const row = entries[index].button;
          if (row.getAttribute('aria-disabled') !== 'true' && row.textContent.toLocaleLowerCase().startsWith(query)) {
            setActive(index);
            break;
          }
        }
        return;
      }
    }
    if (!menu && usable(e.target) && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); open(e.target);
    }
  }, true);
  document.addEventListener('focusin', e => { if (menu && e.target !== select && !menu.contains(e.target)) close(); });
  const reposition = () => { if (menu) position(); };
  window.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
  window.addEventListener('popstate', close);
  window.addEventListener('pagehide', close);
  window.addEventListener('scroll', () => { if (menu) position(); }, true);
})();
