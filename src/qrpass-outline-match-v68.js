(() => {
  const RUNTIME_MARK = 'data-qrpass-outline-match-v68';

  function norm(text) {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function getButtonText(el) {
    return norm(el?.textContent || '');
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function matchesAny(text, list) {
    return list.includes(norm(text));
  }

  function findReferenceControl() {
    const preferredTexts = [
      'all roles',
      'newest first',
      'all activity',
      'today',
      'registered items report',
      '1st semester',
      '2026-2027'
    ];

    const candidates = Array.from(document.querySelectorAll('button, [role="button"], .qrp-v51-trigger, .qrp-v51-control, .qrp-v51-value'));
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = getButtonText(el);
      if (matchesAny(text, preferredTexts)) return el;
      const aria = norm(el.getAttribute('aria-label'));
      if (matchesAny(aria, preferredTexts)) return el;
    }

    const selectLike = Array.from(document.querySelectorAll('select'));
    for (const el of selectLike) {
      if (isVisible(el)) return el;
    }

    return null;
  }

  function extractOutlineStyle(ref) {
    if (!ref) return null;
    const cs = window.getComputedStyle(ref);
    const borderColor = cs.borderTopColor || cs.borderColor;
    const borderWidth = cs.borderTopWidth || cs.borderWidth || '1px';
    const borderStyle = cs.borderTopStyle || cs.borderStyle || 'solid';
    const radius = cs.borderTopLeftRadius || cs.borderRadius || '16px';
    return {
      borderColor,
      borderWidth,
      borderStyle,
      radius,
    };
  }

  function applyOutline(el, outline) {
    if (!(el instanceof HTMLElement) || !outline) return;
    el.style.setProperty('border-color', outline.borderColor, 'important');
    el.style.setProperty('border-width', outline.borderWidth, 'important');
    el.style.setProperty('border-style', outline.borderStyle, 'important');
    el.style.setProperty('border-radius', outline.radius, 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.setAttribute(RUNTIME_MARK, 'true');
  }

  function targetButtons() {
    const names = ['download pdf', 'download excel', 'save settings', 'save policy'];
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      if (!isVisible(el)) return false;
      return names.includes(getButtonText(el));
    });
  }

  function run() {
    const reference = findReferenceControl();
    const outline = extractOutlineStyle(reference);
    if (!outline) return;

    // QRPASS_V89: buttons only. v87 owns search hover/focus styling.
    // Do not reset the focused search field box-shadow to none.
    for (const el of targetButtons()) applyOutline(el, outline);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  }
  schedule();
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'placeholder', 'aria-label']
  });
})();

