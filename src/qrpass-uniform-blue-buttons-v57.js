/* QRPass v57 — blue-filled action buttons only. */
(() => {
  if (typeof document === 'undefined' || window.__qrpassUniformBlueV57) return;
  window.__qrpassUniformBlueV57 = true;
  const tag = 'qrp-v57-blue-action';
  const styleId = 'qrp-v57-blue-action-style';
  const styles =
    '#root button.' + tag + ', #root input.' + tag + ', #root a.' + tag +
    ' { background-color: #294c90 !important; background-image: linear-gradient(180deg, #294c90 0%, #1c335b 100%) !important; color: #ffffff !important; border-color: transparent !important; transition: filter 160ms ease, box-shadow 160ms ease, transform 160ms ease !important; }\n' +
    '#root button.' + tag + ':not(:disabled):hover, #root input.' + tag + ':not(:disabled):hover, #root a.' + tag + ':hover { filter: brightness(1.08) !important; box-shadow: 0 5px 13px rgba(25,52,103,.18) !important; }\n' +
    '#root button.' + tag + ':not(:disabled):active, #root input.' + tag + ':not(:disabled):active, #root a.' + tag + ':active { filter: brightness(.96) !important; transform: translateY(1px); }\n' +
    '#root button.' + tag + ':focus-visible, #root input.' + tag + ':focus-visible, #root a.' + tag + ':focus-visible { outline: 2px solid #7c9cf6 !important; outline-offset: 2px; }\n' +
    '@media (prefers-reduced-motion: reduce) { #root button.' + tag + ', #root input.' + tag + ', #root a.' + tag + ' { transition: none !important; } }';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    style.textContent = styles;
    document.head.appendChild(style);
  }

  const selector = 'button, input[type="button"], input[type="submit"], a[role="button"]';
  const forbidden = '[role="combobox"], [role="option"], [role="tab"], [role="listbox"], [data-slot="select-trigger"], [data-qrpass-keep-style], .qrp-v40-option, .qrp-v51-option, .qrp-v52-option';
  const seen = new WeakMap();

  function isBlue(r, g, b) {
    // Filled navy/royal-blue surfaces, not pale blue / lavender input backgrounds.
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return b >= 78 && b > r * 1.27 && b > g * 1.17 && r < 135 && g < 175 && max - min > 45;
  }
  function rgb(s) {
    const m = String(s).match(/rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }
  function isBlueFromClass(s) {
    return s.split(/\s+/).some(t => {
      if (t.startsWith('!') || t.includes(':')) return false; // ignore hover/utility overrides
      if (/^bg-primary(?:\/\d+)?$/.test(t)) return true;
      if (/^bg-blue-(?:400|500|600|700|800|900)(?:\/\d+)?$/.test(t)) return true;
      const m = t.match(/^bg-\[#([0-9a-fA-F]{6})\]$/);
      if (!m) return false;
      const h = m[1];
      return isBlue(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
    });
  }
  function blueFilled(el, cls) {
    const cs = getComputedStyle(el);
    const bg = rgb(cs.backgroundColor);
    const fg = rgb(cs.color);
    const foregroundIsWhite = !!fg && fg.every(x => x > 180);
    const gradient = /(?:linear|radial)-gradient/i.test(cs.backgroundImage);
    const gradColor = gradient ? rgb(cs.backgroundImage) : null;
    const gradientIsBlue = !!gradColor && isBlue(...gradColor);
    const looksBlue = bg && isBlue(...bg);
    // Ignore elements explicitly forced transparent, pale, or ghost/outline buttons.
    if (/(?:^|\s)!bg-transparent(?:\s|$)/.test(cls)) return false;
    if (!foregroundIsWhite) return false;
    return !!(looksBlue || gradientIsBlue || (isBlueFromClass(cls) && gradient));
  }
  function inspect(el) {
    if (!(el instanceof HTMLElement) || el.matches(forbidden) || el.closest('[role="listbox"]')) return;
    const cls = Array.from(el.classList).filter(t => t !== tag).join(' ');
    const sig = cls + '|' + (el.getAttribute('style') || '');
    const prev = seen.get(el);
    if (prev === sig) return;
    seen.set(el, sig);
    // Remove our old styling before measuring the actual current button state.
    if (el.classList.contains(tag)) el.classList.remove(tag);
    if (blueFilled(el, cls)) el.classList.add(tag);
  }
  let queued = false;
  function rescan() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const host = document.getElementById('root');
      if (!host) return;
      host.querySelectorAll(selector).forEach(inspect);
    });
  }
  function init() {
    const host = document.getElementById('root');
    if (!host) { document.addEventListener('DOMContentLoaded', init, { once: true }); return; }
    const observer = new MutationObserver(rescan);
    observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    rescan();
  }
  init();
  console.info('[QRPass] v57: matching blue-filled action buttons to Submit Registration gradient.');
})();
