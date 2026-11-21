/* QRPass v26 — single animated dropdown arrow outside System Settings.
 * v25 already draws a rotating ::after chevron. Some global styles add a
 * second static SVG background to native <select> controls. This removes ONLY
 * that redundant background icon when a rotating chevron is present.
 * System Settings is explicitly excluded: its current working UI is untouched.
 */
(() => {
  if (typeof document === "undefined" || window.__qrpassSingleArrowV26) return;
  window.__qrpassSingleArrowV26 = true;

  const reportSelects = [
    '#qrpass-sysadmin-reports-v4 select[aria-label="Report type"]',
    '#qrpass-sysadmin-reports-v4 select[aria-label="Filter reports by date"]'
  ].join(", ");

  function isSettings(select) {
    return !!select.closest('.qrpass-sysadmin-settings-v31, [data-qrpass-settings-report-skin="v7"]');
  }

  function alreadyHasRotatingChevron(select) {
    const parent = select.parentElement;
    if (!parent || !parent.matches("label, div")) return false;
    const pseudo = getComputedStyle(parent, "::after");
    const right = parseFloat(pseudo.borderRightWidth) || 0;
    const bottom = parseFloat(pseudo.borderBottomWidth) || 0;
    // Restrict generic checks to the v25 2px corner-chevron, not arbitrary
    // ::after decoration used elsewhere in QRPass.
    return pseudo.content !== "none" &&
      pseudo.content !== "normal" &&
      right >= 1.5 && right <= 3 &&
      bottom >= 1.5 && bottom <= 3 &&
      pseudo.borderRightStyle === "solid" &&
      pseudo.borderBottomStyle === "solid";
  }

  function fixSelect(select) {
    if (!(select instanceof HTMLSelectElement) ||
        select.multiple || isSettings(select)) return;
    // Reports are a known v25 duplicate-arrow case. On other pages,
    // fix only native selects that actually have a v25-like rotating chevron.
    if (!select.matches(reportSelects) && !alreadyHasRotatingChevron(select)) return;
    if (select.style.getPropertyValue("background-image") === "none" &&
        select.style.getPropertyPriority("background-image") === "important") return;
    select.style.setProperty("background-image", "none", "important");
  }

  function scan(root) {
    if (!root) return;
    if (root.matches?.("select")) fixSelect(root);
    root.querySelectorAll?.("select:not([multiple])").forEach(fixSelect);
  }

  const host = document.getElementById("root");
  if (!host) return;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) scan(node);
      }
    }
  });
  observer.observe(host, { childList: true, subtree: true });
  scan(host);

  // Keep the icon single before the native select's existing popup opens,
  // even if React has replaced the element during navigation.
  document.addEventListener("pointerdown", (event) => {
    const el = event.target?.closest?.("select");
    if (el && host.contains(el)) fixSelect(el);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const el = event.target;
    if (el instanceof HTMLSelectElement && host.contains(el)) fixSelect(el);
  }, true);

  // Read-only debugging helper: reports the appearance of affected selectors.
  window.__qrpassSingleArrowV26Info = () =>
    [...host.querySelectorAll(reportSelects)].map(el => ({
      label: el.getAttribute("aria-label"),
      open: el.getAttribute("aria-expanded") === "true",
      backgroundImage: getComputedStyle(el).backgroundImage
    }));
})();
