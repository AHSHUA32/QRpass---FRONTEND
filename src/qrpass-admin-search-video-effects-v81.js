/* QRPASS_AUDIT_USERS_SEARCH_VIDEO_V81
 * Recreates the Lost & Found reference video:
 *    rest -> white, hover -> pale blue, focus/typing -> white + blue ring.
 * Only two uniquely labeled SysAdmin search inputs. Existing handlers intact.
 * Direct inline !important values intentionally outrank legacy CSS !important.
 */
(() => {
  if (typeof document === 'undefined' || window.__qrpassSearchEffectsV81) return;
  window.__qrpassSearchEffectsV81 = true;
  const SELECTOR = 'input[type="search"][aria-label="Search system logs"], input[type="search"][aria-label="Search user accounts"]';
  const tracked = new WeakMap();
  const names = { 'Search system logs': 'Audit Logs', 'Search user accounts': 'User Accounts' };
  const isDark = () => document.documentElement.classList.contains('dark');
  const colors = (focused, hovered) => {
    if (isDark()) return focused
      ? ['#19345f', '#83a6ed', '0 0 0 3px rgba(131,166,237,.19)']
      : hovered
      ? ['#25456e', '#7291bd', 'none']
      : ['#19345f', '#526c92', 'none'];
    return focused
      ? ['#ffffff', '#638bcb', '0 0 0 3px rgba(82,120,231,.20)']
      : hovered
      ? ['#eef2ff', '#b7c7e6', 'none']
      : ['#ffffff', '#cbd5e1', 'none'];
  };
  function put(el, name, value) {
    if (el.style.getPropertyValue(name) !== value || el.style.getPropertyPriority(name) !== 'important') {
      el.style.setProperty(name, value, 'important');
    }
  }
  function paint(el) {
    const state = tracked.get(el);
    if (!state || !el.isConnected) return;
    const focused = document.activeElement === el;
    const hovered = state.hovered;
    const [background, border, shadow] = colors(focused, hovered);
    put(el, 'background', background);
    put(el, 'background-color', background);
    put(el, 'border-color', border);
    put(el, 'box-shadow', shadow);
    put(el, 'outline', 'none');
    put(el, 'transition', 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease');
    if (isDark()) put(el, 'color', '#eef4ff');
  }
  function afterEvent(el) {
    paint(el);
    requestAnimationFrame(() => paint(el));
  }
  function attach(el) {
    if (tracked.has(el)) return;
    if (!(el instanceof HTMLInputElement) || !el.matches(SELECTOR)) return;
    const state = { hovered: el.matches(':hover') };
    tracked.set(el, state);
    for (const ev of ['pointerenter','mouseenter']) el.addEventListener(ev, () => {
      state.hovered = true; afterEvent(el);
    });
    for (const ev of ['pointerleave','mouseleave']) el.addEventListener(ev, () => {
      state.hovered = false; afterEvent(el);
    });
    for (const ev of ['focus','blur','focusin','focusout','click','input','keydown','keyup']) {
      el.addEventListener(ev, () => afterEvent(el));
    }
    paint(el);
    console.info('[QRPass v81] Search video effects active:', names[el.getAttribute('aria-label')] || 'Search');
  }
  let queued = false;
  function scan() {
    document.querySelectorAll(SELECTOR).forEach(attach);
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }
  function boot() {
    scan();
    const root = document.getElementById('root');
    if (!root) {
      document.addEventListener('DOMContentLoaded', boot, { once:true });
      return;
    }
    new MutationObserver(schedule).observe(root, { subtree:true, childList:true });
    new MutationObserver(() => document.querySelectorAll(SELECTOR).forEach(paint))
      .observe(document.documentElement, { attributes:true, attributeFilter:['class'] });
    schedule();
  }
  boot();
})();
