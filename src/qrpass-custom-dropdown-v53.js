/* QRPass v56: consistent Item Name dropdown visuals, gap, and click/hover effects.
 * This specifically targets the custom dropdowns visible in Chrome Elements
 * (button[role="combobox"] + div[role="listbox"]), NOT only native <select>.
 * Appearance only: no option values, click handlers, form events, or layout changes.
 */
(() => {
  if (typeof document === 'undefined' || window.__qrpassCustomDropdownV53) return;
  window.__qrpassCustomDropdownV53 = true;

  const colors = {
    menu: '#ffffff',
    normal: '#f5f7fe',
    selected: '#dfe8ff',
    hover: '#e9efff',
    hoverSelected: '#d6e3ff',
    text: '#17336d',
    border: '#d3dff8'
  };
  const menuQuery = '[role="listbox"]';
  let scheduled = false;
  let lastSelected = [];

  // Separate scoped stylesheet for pointer states; runtime painting below
  // also wins against Tailwind classes such as bg-[#234886].
  const css = document.createElement('style');
  css.id = 'qrpass-custom-dropdown-v53';
  css.textContent = `
    [role="listbox"][data-qrp-v53="true"] {
      background: ${colors.menu} !important;
      border: 1px solid ${colors.border} !important;
      border-radius: 16px !important;
      padding: 8px !important;
      box-shadow: 0 10px 24px rgba(20,42,83,.11) !important;
      scrollbar-color: #a8b6d2 transparent;
      outline: none !important;
      filter: none !important;
      max-height: min(320px, 55vh) !important;
      animation: qrp-v56-open 145ms ease-out both;
      overflow-y: auto !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
      outline: 0 !important;
      background-clip: padding-box !important;
      isolation: isolate !important;
      box-sizing: border-box !important;
    }
    [role="listbox"][data-qrp-v53="true"] [role="option"] {
      border-radius: 12px !important;
      background: ${colors.normal} !important;
      color: ${colors.text} !important;
      min-height: 44px !important;
      margin: 0 !important;
      outline: none !important;
      flex-shrink: 0 !important;
      padding: 10px 14px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      text-align: left !important;
      box-shadow: none !important;
      transition: background-color 145ms ease, transform 120ms ease !important;
    }
    [role="listbox"][data-qrp-v53="true"] [role="option"][aria-selected="true"],
    [role="listbox"][data-qrp-v53="true"] [role="option"][data-state="checked"] {
      background: ${colors.selected} !important;
      color: ${colors.text} !important;
      font-weight: 600 !important;
    }
    [role="listbox"][data-qrp-v53="true"] [role="option"]:hover {
      background: ${colors.hover} !important;
    }
    [role="listbox"][data-qrp-v53="true"] [role="option"]:active { transform: translateY(1px); }
    [role="listbox"][data-qrp-v53="true"]::before,
    [role="listbox"][data-qrp-v53="true"]::after { content: none !important; }
    [role="listbox"][data-qrp-v53="true"] [data-slot="select-item-indicator"],
    [role="listbox"][data-qrp-v53="true"] [data-radix-select-item-indicator] {
      display: none !important;
    }
    button[role="combobox"][aria-expanded="true"] {
      background: #ffffff !important;
      border-color: #5278e7 !important;
      box-shadow: 0 0 0 2px rgba(82,120,231,.12) !important;
      transition: background-color 150ms ease, box-shadow 150ms ease !important;
    }
    @keyframes qrp-v56-open {
      from { opacity: 0; transform: translateY(-3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      [role="listbox"][data-qrp-v53="true"] { animation: none !important; }
      [role="listbox"][data-qrp-v53="true"] [role="option"] { transition: none !important; }
    }
  `;
  document.head.appendChild(css);

  function setImportant(el, property, value) {
    if (el.style.getPropertyValue(property).trim() !== value ||
      el.style.getPropertyPriority(property) !== 'important') {
      el.style.setProperty(property, value, 'important');
    }
  }

  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function optionsFor(panel) {
    let opts = Array.from(panel.querySelectorAll('[role="option"]'));
    if (opts.length === 0) {
      // Some hand-written custom listboxes use buttons rather than role=option.
      opts = Array.from(panel.querySelectorAll('button:not([role="combobox"])'));
    }
    if (opts.length === 0) {
      opts = Array.from(panel.children).filter(el =>
        el instanceof HTMLElement && el !== panel &&
        cleanText(el.textContent) && !el.matches('style, script'));
    }
    return opts.filter(el => el instanceof HTMLElement);
  }

  function isConnectedToCombobox(panel) {
    if (!panel.id) return null;
    for (const trigger of document.querySelectorAll('[role="combobox"][aria-controls]')) {
      if (trigger.getAttribute('aria-controls') === panel.id) return trigger;
    }
    return null;
  }

  function repaint() {
    scheduled = false;
    const report = [];
    for (const panel of document.querySelectorAll(menuQuery)) {
      // Native <select> floating overlays are already handled by v51;
      // only repaint React custom listboxes.
      if (panel.classList.contains('qrp-v40-popup') ||
          panel.classList.contains('qrp-v50-popup') ||
          panel.classList.contains('qrp-v51-popup') ||
          panel.classList.contains('qrp-v52-popup')) continue;
      if (!(panel instanceof HTMLElement)) continue;
      const trigger = isConnectedToCombobox(panel);
      if (!trigger && !panel.closest('#root')) continue;
      const opts = optionsFor(panel);
      if (!opts.length) continue;

      if (panel.getAttribute('data-qrp-v53') !== 'true')
        panel.setAttribute('data-qrp-v53', 'true');

      setImportant(panel, 'background', colors.menu);
      setImportant(panel, 'border-radius', '16px');
      setImportant(panel, 'padding', '8px');
      setImportant(panel, 'box-shadow', '0 10px 24px rgba(20, 42, 83, 0.11)');
      setImportant(panel, 'outline', 'none');
      setImportant(panel, 'filter', 'none');
      setImportant(panel, 'background-clip', 'padding-box');
      setImportant(panel, 'isolation', 'isolate');
      setImportant(panel, 'max-height', 'min(320px, 55vh)');
      setImportant(panel, 'overflow-y', 'auto');
      // No parent gap: some forms wrap all option rows in an extra div.
      // Apply margin to each actual option row below so gap is always visible.
      setImportant(panel, 'gap', '0px');
      const currentLabel = cleanText(trigger?.textContent);
      const selectedByAttr = opts.some(el =>
        el.getAttribute('aria-selected') === 'true' ||
        el.getAttribute('data-selected') === 'true' ||
        el.getAttribute('data-state') === 'checked'
      );
      let selectedText = '';

      for (const [optionIndex, el] of opts.entries()) {
        const optionText = cleanText(el.textContent);
        // Prefer semantic state. Compare trigger text as a safe fallback for
        // custom dropdowns that don't expose aria-selected on each option.
        const selected = selectedByAttr
          ? (el.getAttribute('aria-selected') === 'true' ||
             el.getAttribute('data-selected') === 'true' ||
             el.getAttribute('data-state') === 'checked')
          : (!!currentLabel && currentLabel === optionText);
        if (selected) selectedText = optionText;
        const hovered = el.matches(':hover');
        const bg = selected
          ? (hovered ? colors.hoverSelected : colors.selected)
          : (hovered ? colors.hover : colors.normal);

        // In contrast to earlier v40-v52 fixes, this writes inline *background
        // shorthand* to the actual custom option node, overriding dark-blue
        // Tailwind bg utilities (not merely native-select popup styles).
        setImportant(el, 'background', bg);
        setImportant(el, 'background-image', 'none');
        setImportant(el, 'color', colors.text);
        setImportant(el, 'font-weight', selected ? '600' : '500');
        setImportant(el, 'box-shadow', 'none');
        setImportant(el, 'border-radius', '12px');
        setImportant(el, 'min-height', '44px');
        setImportant(el, 'padding', '10px 14px');
        setImportant(el, 'width', '100%');
        setImportant(el, 'box-sizing', 'border-box');
        // Spacing on the option itself also works through nested wrappers.
        // Avoid doubling gaps by not using listbox flex-gap.
        setImportant(el, 'margin', optionIndex < opts.length - 1 ? '0px 0px 10px' : '0px');
        setImportant(el, 'flex-shrink', '0');
        setImportant(el, 'transition', 'background-color 145ms ease, transform 120ms ease');
        setImportant(el, 'outline', 'none');
        // Leave click handlers, aria state, widths, and keyboard focus intact.
      }
      report.push({ menu: panel.getAttribute('aria-label') || panel.id || 'dropdown',
        selected: selectedText,
        color: selectedText ? getComputedStyle(opts.find(x => cleanText(x.textContent) === selectedText)).backgroundColor : null });
    }
    lastSelected = report;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(repaint);
  }

  function start() {
    const observer = new MutationObserver(changes => {
      // A guarded repaint watches newly mounted React popups, selected/hover
      // class changes, and any later React inline-style rewrites.
      if (changes.some(m => m.type === 'childList' ||
        (m.target instanceof Element && (m.target.matches('[role="option"], [role="listbox"]') ||
          m.target.closest('[role="listbox"]'))))) schedule();
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'aria-selected', 'data-selected', 'data-state', 'style']
    });
    document.addEventListener('pointerover', e => {
      if (e.target instanceof Element && e.target.closest(menuQuery)) schedule();
    }, true);
    document.addEventListener('pointerout', e => {
      if (e.target instanceof Element && e.target.closest(menuQuery)) schedule();
    }, true);
    document.addEventListener('click', () => schedule(), true);
    schedule();
    console.info('[QRPass] v56 consistent option-row gap and hover styling active.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else start();

  // Read-only confirmation, available when a dropdown is open in Chrome.
  window.qrpassCustomDropdownStatus = () => ({ version: 'v56',
    panels: lastSelected.slice() });
})();
