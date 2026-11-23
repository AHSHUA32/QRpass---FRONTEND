/* QRPASS_ALL_SEARCH_DROPDOWN_EFFECTS_V86
 * Visual reference: Audit Logs > All Activity / Newest first (v44).
 * Default: white #fff / border #cbd5e1
 * Hover (unfocused): pale blue #eef2ff / border #a8bde4
 * Focus/typing: white #fff / blue #5278e7 + 3px ring
 * Dark mode follows the existing QRPass Lights Out colors.
 * Never changes search values, filter handlers, icons, controls, or layout.
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__qrpassAllSearchDropdownEffectsV86) return;
  window.__qrpassAllSearchDropdownEffectsV86 = true;

  const SELECTOR = 'input[type="search"], input[aria-label*="search" i], input[placeholder*="search" i]';
  const painted = new WeakSet();
  const matchesSearch = (el) => el instanceof HTMLInputElement &&
    el.matches(SELECTOR) && !['hidden','checkbox','radio','number','file','password'].includes(el.type);
  const darkMode = () => document.documentElement.classList.contains('dark') ||
    Boolean(document.body && document.body.classList.contains('dark'));

  function visualState(el) {
    const focus = document.activeElement === el;
    const hover = !focus && el.matches(':hover');
    if (darkMode()) {
      return focus
        ? {bg:'#19345f', border:'#83a6ed', ring:'0 0 0 3px rgba(131,166,237,.18)', ink:'#eef4ff'}
        : hover
          ? {bg:'#25456e', border:'#7291bd', ring:'none', ink:'#eef4ff'}
          : {bg:'#19345f', border:'#526c92', ring:'none', ink:'#eef4ff'};
    }
    return focus
      ? {bg:'#ffffff', border:'#5278e7', ring:'0 0 0 3px rgba(82,120,231,.17)', ink:'#17336d'}
      : hover
        ? {bg:'#eef2ff', border:'#a8bde4', ring:'none', ink:'#17336d'}
        : {bg:'#ffffff', border:'#cbd5e1', ring:'none', ink:'#17336d'};
  }
  function setImportant(el, prop, val) {
    if (el.style.getPropertyValue(prop) !== val || el.style.getPropertyPriority(prop) !== 'important') {
      el.style.setProperty(prop, val, 'important');
    }
  }
  function paint(el) {
    if (!matchesSearch(el) || !el.isConnected) return;
    const state = visualState(el);
    // Both shorthand and longhand are needed: older QRPass styles use
    // inline !important backgrounds as well as CSS !important rules.
    setImportant(el, 'background', state.bg);
    setImportant(el, 'background-color', state.bg);
    setImportant(el, 'border-color', state.border);
    setImportant(el, 'box-shadow', state.ring);
    setImportant(el, 'outline', 'none');
    setImportant(el, 'color', state.ink);
    setImportant(el, 'transition', 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease');
    painted.add(el);
  }
  function allSearches() {
    return document.querySelectorAll(SELECTOR);
  }
  function scan() {
    for (const el of allSearches()) paint(el);
  }
  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }
  function paintEvent(event) {
    const el = event.target;
    if (!matchesSearch(el)) return;
    // Capture sees pointer and focus first. Repaint AFTER React handlers and
    // older QRPass listeners, preventing their inline styles from winning.
    paint(el);
    requestAnimationFrame(() => paint(el));
  }
  function boot() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', boot, {once:true});
      return;
    }
    scan();
    // Delegated handlers work for dynamic route changes and portal modals.
    for (const ev of ['pointerover','pointerout','mouseover','mouseout',
                      'focusin','focusout','click','input','keyup']) {
      document.addEventListener(ev, paintEvent, true);
    }
    new MutationObserver(scheduleScan).observe(document.body, {
      childList: true, subtree: true
    });
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      attributes:true, attributeFilter:['class']
    });
    console.info('[QRPass v86] All search bars now match All Activity / Newest first effects.');
    scheduleScan();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
