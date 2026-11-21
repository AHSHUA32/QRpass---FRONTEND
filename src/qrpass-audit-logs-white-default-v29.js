/* QRPass Audit Logs v29 — White default, blue hover, white focus/open.
 * Targets only the two select controls on System Administrator > Audit Logs.
 */
(() => {
  if (typeof document === 'undefined' || window.__qrpassAuditWhiteV29) return;
  window.__qrpassAuditWhiteV29 = true;

  const ids = [
    'select[data-qrpass-filter="activities"][aria-label="Filter system log activity"]',
    'select[aria-label="Sort system logs"]'
  ];
  const selector = ids.map(s => '#root .qrpass-admin-page ' + s).join(', ');
  const WHITE = '#ffffff';
  const BLUE = '#eef4ff';
  const DARK = '#19345f';
  const DARK_HOVER = '#25456e';
  const STYLE_ID = 'qrpass-audit-white-v29-style';

  // First-paint fallback. An ID-scoped rule outranks older Sysadmin
  // .qrpass-admin-page.qrpass-admin-page... selectors even with !important.
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      ...selector.split(', ').map(s => s +
        ' { background-color:#ffffff !important; transition:background-color 160ms ease,border-color 160ms ease !important; }'),
      ...selector.split(', ').map(s => s +
        ':hover:not(:focus):not([aria-expanded="true"]) { background-color:#eef4ff !important; }'),
      ...selector.split(', ').map(s => 'html.dark ' + s +
        ' { background-color:#19345f !important; }')
    ].join('\n');
    document.head.appendChild(style);
  }

  function isTarget(el) {
    return el instanceof HTMLSelectElement && el.matches(selector);
  }
  function paint(el) {
    if (!isTarget(el)) return;
    const dark = document.documentElement.classList.contains('dark');
    const open = el.getAttribute('aria-expanded') === 'true' ||
      el.classList.contains('qrp-v51-open') ||
      el.classList.contains('qrp-v40-open');
    const focused = document.activeElement === el;
    const hovered = el.matches(':hover');
    const color = dark
      ? (open || focused || !hovered ? DARK : DARK_HOVER)
      : (open || focused || !hovered ? WHITE : BLUE);
    // This overrides repeated legacy rules with !important, including
    // their background shorthand, without erasing a native SVG chevron.
    if (el.style.getPropertyValue('background-color') !== color ||
        el.style.getPropertyPriority('background-color') !== 'important') {
      el.style.setProperty('background-color', color, 'important');
    }
  }

  function scan() {
    document.querySelectorAll(selector).forEach(paint);
  }
  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }

  // Capture actual hover/focus; do not synthesize or interfere with selects.
  for (const name of ['pointerover','pointerout','pointerdown','focusin','focusout','keydown','keyup']) {
    document.addEventListener(name, e => {
      if (isTarget(e.target)) {
        paint(e.target);
        queue();
      }
    }, true);
  }
  const root = document.getElementById('root');
  if (!root) return;
  new MutationObserver(queue).observe(root, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['aria-expanded','class']
  });
  scan();
  console.info('[QRPass v29] Audit Logs dropdown defaults corrected; other pages unchanged.');
})();