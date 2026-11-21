/* QRPASS USER LIST GAP V56 */
(() => {
  const CARD_ATTR = "data-qrpass-user-list-card-v56";
  const FOOTER_ATTR = "data-qrpass-user-list-footer-v56";
  const GAP_ATTR = "data-qrpass-user-list-gap-v56";
  const TABLE_WRAP_ATTR = "data-qrpass-user-list-table-wrap-v56";

  const norm = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function looksLikeFooterText(el) {
    return /showing\s+\d+\s+of\s+\d+\s+user\s+accounts/i.test(norm(el.textContent));
  }

  function containsTable(el) {
    return !!el && !!el.querySelector("table, thead, tbody, tr, td, th");
  }

  function isEmptySpacer(el) {
    if (!el || el.nodeType !== 1) return false;
    if (containsTable(el)) return false;
    if (el.querySelector("input, button, select, textarea, a, img, svg, form")) return false;
    const text = norm(el.textContent);
    const rect = el.getBoundingClientRect();
    return text === "" && rect.height > 8;
  }

  function cleanup() {
    const selector = "[" + CARD_ATTR + "], [" + FOOTER_ATTR + "], [" + GAP_ATTR + "], [" + TABLE_WRAP_ATTR + "]";
    document.querySelectorAll(selector).forEach((el) => {
      el.removeAttribute(CARD_ATTR);
      el.removeAttribute(FOOTER_ATTR);
      el.removeAttribute(GAP_ATTR);
      el.removeAttribute(TABLE_WRAP_ATTR);
    });
  }

  function apply() {
    cleanup();

    const footerLabel = [...document.querySelectorAll("div, p, span")].find(looksLikeFooterText);
    if (!footerLabel) return;

    const footer = footerLabel.closest("div");
    if (!footer) return;

    const card = footer.closest("div");
    if (!card) return;

    const cardText = norm(card.textContent);
    if (!/user\s*list/i.test(cardText) || !/user\s*accounts/i.test(document.body.textContent || "")) return;

    card.setAttribute(CARD_ATTR, "true");
    footer.setAttribute(FOOTER_ATTR, "true");

    let prev = footer.previousElementSibling;
    while (prev) {
      if (isEmptySpacer(prev)) {
        prev.setAttribute(GAP_ATTR, "true");
        break;
      }
      if (containsTable(prev)) {
        prev.setAttribute(TABLE_WRAP_ATTR, "true");
        break;
      }
      prev = prev.previousElementSibling;
    }
  }

  const run = () => requestAnimationFrame(apply);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: false });
})();
