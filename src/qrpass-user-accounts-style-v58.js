/* QRPASS USER ACCOUNTS SYSTEM-SETTINGS STYLE V58 */
(() => {
  const ATTR = {
    root: "data-qrpass-user-accounts-v58",
    search: "data-qrpass-user-accounts-search-v58",
    select: "data-qrpass-user-accounts-select-v58",
    listCard: "data-qrpass-user-list-card-v58",
    listTitle: "data-qrpass-user-list-title-v58",
    footer: "data-qrpass-user-list-footer-v58",
    table: "data-qrpass-user-list-table-v58",
  };

  const norm = (value) => String(value || "").replace(/\s+/g, " ").trim();

  function clear() {
    Object.values(ATTR).forEach((attr) => {
      document.querySelectorAll("[" + attr + "]").forEach((el) => el.removeAttribute(attr));
    });
  }

  function findUserListTitle() {
    return [...document.querySelectorAll("h1,h2,h3,div,span")].find((el) => norm(el.textContent) === "User List");
  }

  function apply() {
    clear();

    const search = [...document.querySelectorAll("input")].find((el) =>
      /search\s+name,\s*user\s*id,\s*email,\s*role/i.test(norm(el.getAttribute("placeholder")))
    );
    if (!search) return;

    const title = findUserListTitle();
    const footer = [...document.querySelectorAll("div,p,span")].find((el) =>
      /showing\s+\d+\s+of\s+\d+\s+user\s+accounts/i.test(norm(el.textContent))
    );

    let card = null;
    if (title) card = title.closest("div");
    if (footer && !card) card = footer.closest("div");

    const row = search.closest("div")?.parentElement || search.closest("div");
    if (row) row.setAttribute(ATTR.root, "true");

    search.setAttribute(ATTR.search, "true");

    const scope = row || document;
    [...scope.querySelectorAll("select")].forEach((el) => el.setAttribute(ATTR.select, "true"));

    if (title) title.setAttribute(ATTR.listTitle, "true");
    if (card) {
      card.setAttribute(ATTR.listCard, "true");
      const table = card.querySelector("table");
      if (table) table.setAttribute(ATTR.table, "true");
    }
    if (footer) footer.setAttribute(ATTR.footer, "true");
  }

  const run = () => requestAnimationFrame(apply);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
})();
