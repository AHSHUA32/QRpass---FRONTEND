/* QRPass v67 — one active filter chip at a time; no filtering logic changes. */
(() => {
  if (typeof document === 'undefined' || window.__qrpassFilterActiveOnlyV67) return;
  window.__qrpassFilterActiveOnlyV67 = true;
  const barClass = 'qrp-v67-filter-bar';
  const selectedAttr = 'data-qrpass-filter-selected';
  const filterNames = new Set([
    'all', 'found', 'lost', 'pending', 'recovered', 'approved', 'expired',
    'rejected', 'resolved', 'flagged', 'claimed', 'active', 'disabled',
    'entry', 'exit', 'open', 'closed'
  ]);
  const CSS = `
/* Higher specificity than the old v57 global blue action-button rule. */
#root .qrpass-dashboard-root .${barClass} > button,
#root .${barClass} > button {
  background-image: none !important;
  background-color: #fff !important;
  color: #17336d !important;
  border-color: #cfdaea !important;
  box-shadow: none !important;
  filter: none !important;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease !important;
}
#root .qrpass-dashboard-root .${barClass} > button:not([${selectedAttr}="true"]):hover,
#root .${barClass} > button:not([${selectedAttr}="true"]):hover {
  background-image: none !important;
  background-color: #eef3ff !important;
  border-color: #a9bfe5 !important;
  color: #17336d !important;
}
#root .qrpass-dashboard-root .${barClass} > button[${selectedAttr}="true"],
#root .${barClass} > button[${selectedAttr}="true"] {
  background: linear-gradient(180deg, #294c90 0%, #1c335b 100%) !important;
  color: #fff !important;
  border-color: #294c90 !important;
  box-shadow: 0 3px 8px rgba(18,45,95,.10) !important;
  filter: none !important;
}
#root .qrpass-dashboard-root .${barClass} > button[${selectedAttr}="true"]:hover,
#root .${barClass} > button[${selectedAttr}="true"]:hover {
  filter: brightness(1.07) !important;
}
#root .${barClass} > button:active { transform: translateY(1px) !important; }
#root .${barClass} > button:focus-visible { outline: 2px solid #6089f2 !important; outline-offset: 2px; }
html.dark #root .${barClass} > button:not([${selectedAttr}="true"]) {
  background: #142039 !important;
  color: #d4e3ff !important;
  border-color: #334667 !important;
}
html.dark #root .${barClass} > button:not([${selectedAttr}="true"]):hover {
  background: #21375b !important;
}
@media (prefers-reduced-motion: reduce) {
  #root .${barClass} > button { transition: none !important; transform: none !important; }
}
`;

  if (!document.getElementById('qrp-v67-filter-style')) {
    const style = document.createElement('style');
    style.id = 'qrp-v67-filter-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const groups = new WeakMap();
  const norm = s => String(s || '')
    .replace(/\(\s*\d+\s*\)/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  function pills(group) {
    if (!(group instanceof HTMLElement)) return null;
    const children = Array.from(group.children);
    if (children.length < 3 || children.length > 9 || !children.every(el => el.tagName === 'BUTTON')) return null;
    const names = children.map(el => norm(el.textContent));
    if (!names.includes('all')) return null;
    if (names.some(name => !filterNames.has(name))) return null;
    // Only short status-filter groups, never form submit buttons or sidebar navigation.
    return children;
  }

  function selectedByReact(button) {
    return button.classList.contains('bg-primary') ||
      button.classList.contains('bg-[#17336d]') ||
      button.getAttribute('aria-pressed') === 'true';
  }

  function paint(group, chosen) {
    const buttons = pills(group);
    if (!buttons) return;
    const winner = buttons.includes(chosen) ? chosen : buttons[0];
    group.classList.add(barClass);
    groups.set(group, winner);
    for (const button of buttons) {
      button.setAttribute(selectedAttr, String(button === winner));
      button.setAttribute('aria-pressed', String(button === winner));
      // Fix legacy v57 styling left on the previously active All button.
      button.classList.remove('qrp-v57-blue-action');
    }
  }

  function initializeGroup(group) {
    const buttons = pills(group);
    if (!buttons) return;
    if (groups.has(group)) return;
    const active = buttons.find(selectedByReact) || buttons[0];
    paint(group, active);
  }

  function scan() {
    const host = document.querySelector('#root .qrpass-dashboard-root') || document.getElementById('root');
    if (!host) return;
    // Only divs whose immediate children are the status-filter buttons.
    host.querySelectorAll('button').forEach(btn => { if (norm(btn.textContent) === 'all') initializeGroup(btn.parentElement); });
  }

  let scanQueued = false;
  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scan(); });
  }

  // Capture click before React handlers, then reapply after React updates the UI.
  document.addEventListener('click', e => {
    const target = e.target;
    const button = target instanceof Element ? target.closest('button') : null;
    if (!button) return;
    const group = button.parentElement;
    const buttons = pills(group);
    if (!buttons || !buttons.includes(button) || button.disabled) return;
    paint(group, button);
    requestAnimationFrame(() => paint(group, button));
  }, true);

  function init() {
    const host = document.getElementById('root');
    if (!host) { document.addEventListener('DOMContentLoaded', init, { once: true }); return; }
    const observer = new MutationObserver(scheduleScan);
    observer.observe(host, { subtree: true, childList: true });
    scheduleScan();
    console.info('[QRPass] v67 filter fix: only the selected filter tab stays blue.');
  }
  init();
})();
