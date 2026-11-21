/* QRPASS USER ACCOUNTS DROPDOWN OPTIONS V62
 * Match Audit Logs option hover responsiveness.
 * The underlying QRPass v51 menu, option values and click handlers are untouched.
 */
(() => {
  if (window.__qrpassUserDropdownOptionsV62) return;
  window.__qrpassUserDropdownOptionsV62 = true;

  const targets = new Set(["Filter user roles", "Sort user accounts"]);
  const popupSelector = ".qrp-v51-popup, .qrp-v50-popup, .qrp-v52-popup";
  const optionSelector = '[role="option"]';
  const configured = new WeakSet();

  function isTarget(menu) {
    return menu instanceof HTMLElement &&
      targets.has(menu.getAttribute("aria-label") || "") &&
      menu.matches(popupSelector);
  }
  function fill(el, hovering) {
    if (!(el instanceof HTMLElement) || !el.isConnected) return;
    const selected = el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("data-selected") === "true";
    const disabled = el.getAttribute("aria-disabled") === "true";
    const color = selected
      ? (hovering && !disabled ? "#d6e3ff" : "#dfe8ff")
      : (hovering && !disabled ? "#d6e3ff" : "#f7f9ff");
    // The older v51 engine paints inline !important on mouse enter.
    // Repainting AFTER its listener is needed for the correct visual response.
    el.style.setProperty("background", color, "important");
    el.style.setProperty("background-image", "none", "important");
    el.style.setProperty("color", "#17336d", "important");
    el.style.setProperty("transition", "background-color 85ms ease-out", "important");
    el.style.setProperty("cursor", disabled ? "not-allowed" : "pointer", "important");
  }
  function decorate() {
    document.querySelectorAll(popupSelector).forEach(menu => {
      if (!isTarget(menu)) return;
      menu.setAttribute("data-qrpass-user-options-v62", "true");
      menu.querySelectorAll(optionSelector).forEach(row => {
        if (!(row instanceof HTMLElement) || configured.has(row)) return;
        configured.add(row);
        // The existing engine registered pointerenter/pointerleave first.
        row.addEventListener("pointerenter", () => fill(row, true));
        row.addEventListener("pointerleave", () => fill(row, false));
        row.addEventListener("mouseenter", () => fill(row, true));
        row.addEventListener("mouseleave", () => fill(row, false));
        fill(row, row.matches(":hover"));
      });
    });
  }
  let pending = false;
  function queue() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      decorate();
    });
  }

  // QRPass v51 creates the floating popup under document.body, not inside #root.
  // Observe insertion/removal only; avoid loops from style mutations.
  const observe = () => {
    const observer = new MutationObserver(records => {
      if (records.some(r => r.type === "childList")) queue();
    });
    observer.observe(document.documentElement, {childList:true, subtree:true});
    queue();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observe, {once:true});
  } else observe();
})();