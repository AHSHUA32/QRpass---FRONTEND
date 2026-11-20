/* QRPass v52: runtime dropdown selection repair.
 * This targets actual popup options from v40-v51, regardless of which script rendered them.
 * Styling only: original <select> onchange, options, keyboard and form logic stay intact.
 */
(() => {
  if (typeof window === 'undefined' || window.__qrpassDropdownV52) return;
  window.__qrpassDropdownV52 = true;
  const matchPopup = '.qrp-v40-popup, .qrp-v50-popup, .qrp-v51-popup, .qrp-v52-popup';
  const matchOption = '[role="option"], .qrp-v40-option, .qrp-v50-option, .qrp-v51-option, .qrp-v52-option';
  const selectedBlue = 'rgb(223, 232, 255)';
  const activeBlue = 'rgb(214, 227, 255)';
  let scanScheduled = false;
  let scanCount = 0;

  function isSelected(el) {
    return el.getAttribute('aria-selected') === 'true' ||
      el.getAttribute('data-selected') === 'true' ||
      el.getAttribute('data-state') === 'checked';
  }

  function paintOption(el) {
    if (!(el instanceof HTMLElement)) return;
    const selected = isSelected(el);
    const hovered = el.matches(':hover');
    const expected = selected ? (hovered ? activeBlue : selectedBlue) : null;
    if (!expected) return;

    // A later theme can write "background: navy" even when an earlier stylesheet
    // requests lavender. Set the *shorthand* inline to win over both declarations.
    const css = window.getComputedStyle(el);
    if (css.backgroundColor !== expected || css.color !== 'rgb(23, 51, 109)') {
      const color = hovered ? '#d6e3ff' : '#dfe8ff';
      el.style.setProperty('background', color, 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('color', '#17336d', 'important');
      el.style.setProperty('font-weight', '600', 'important');
      el.style.setProperty('transition', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
      scanCount++;
    }
  }

  function scan() {
    scanScheduled = false;
    document.querySelectorAll(matchPopup).forEach(popup => {
      if (!(popup instanceof HTMLElement)) return;
      // Ensure a clean white floating panel, with comfortable option spacing.
      if (window.getComputedStyle(popup).backgroundColor !== 'rgb(255, 255, 255)') {
        popup.style.setProperty('background', '#ffffff', 'important');
      }
      popup.querySelectorAll(matchOption).forEach(paintOption);
    });
  }

  function schedule() {
    if (!scanScheduled) {
      scanScheduled = true;
      queueMicrotask(scan);
    }
  }

  function start() {
    const observer = new MutationObserver(changes => {
      // Only repaint on new popups or selected/inline-style mutations.
      for (const mutation of changes) {
        const n = mutation.target;
        if (mutation.type === 'childList' ||
          (n instanceof Element && (n.matches(matchOption) || n.closest(matchPopup)))) {
          schedule();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-selected', 'data-selected', 'data-state', 'style']
    });
    document.addEventListener('pointerover', event => {
      if (event.target instanceof Element && event.target.closest(matchPopup)) schedule();
    }, true);
    document.addEventListener('pointerout', event => {
      if (event.target instanceof Element && event.target.closest(matchPopup)) schedule();
    }, true);
    scan();
    console.info('[QRPass v52] Floating dropdown runtime styling active.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else start();

  // A lightweight, read-only browser check for troubleshooting if needed.
  window.qrpassDropdownStatus = () => ({
    version: 'v52',
    active: true,
    repaints: scanCount,
    popups: Array.from(document.querySelectorAll(matchPopup)).map(p => ({
      className: p.className,
      selected: Array.from(p.querySelectorAll(matchOption)).filter(isSelected).map(el => ({
        text: el.textContent.trim(),
        renderedBackground: getComputedStyle(el).backgroundColor
      }))
    }))
  });
})();
