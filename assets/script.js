// ===== Lojik360 — interactions =====

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => links.classList.toggle("open"));
}

// Category filters (tutorials + datasets pages)
document.querySelectorAll(".filters").forEach((bar) => {
  const buttons = bar.querySelectorAll(".filter-btn");
  // plusieurs grilles possibles (boutique : rayon gratuit + rayon en vente)
  const grids = document.querySelectorAll(bar.dataset.target);
  if (!grids.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.filter;
      grids.forEach((grid) => {
        let visibles = 0;
        grid.querySelectorAll(".card").forEach((card) => {
          const show = cat === "all" || (card.dataset.cat || "").split(" ").includes(cat);
          card.style.display = show ? "" : "none";
          if (show) visibles++;
        });
        // un rayon vide ne doit pas laisser son titre orphelin
        const shelf = grid.closest(".shelf");
        if (shelf) shelf.style.display = visibles ? "" : "none";
      });
    });
  });
});

// Search arriving from the homepage (?q=...) — filters tutorial cards by text
const params = new URLSearchParams(window.location.search);
const q = (params.get("q") || "").trim().toLowerCase();
if (q) {
  const grid = document.querySelector("#tuto-grid");
  if (grid) {
    grid.querySelectorAll(".card").forEach((card) => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? "" : "none";
    });
    const head = document.querySelector(".hero p.lead");
    if (head) head.textContent = 'Résultats pour « ' + q + ' » — effacez la recherche pour tout revoir.';
  }
}

// Live search on a page grid (e.g. tools page): input.page-search filters its data-target grid
document.querySelectorAll("input.page-search").forEach((input) => {
  const grid = document.querySelector(input.dataset.target);
  if (!grid) return;
  input.closest("form") && input.closest("form").addEventListener("submit", (e) => e.preventDefault());
  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    grid.querySelectorAll(".card").forEach((card) => {
      card.style.display = !term || card.textContent.toLowerCase().includes(term) ? "" : "none";
    });
  });
});

// Tutorial reader: show ONE module at a time (click a sidebar entry to reveal it)
const toc = document.querySelector(".tuto-toc");
const tmain = document.querySelector(".tuto-main");
if (toc && tmain) {
  const tocLinks = [...toc.querySelectorAll("a[href^='#']")];
  const sections = [...tmain.querySelectorAll(":scope > section")];
  const byId = (id) => sections.find((s) => s.id === id);
  const reveal = (id, push) => {
    const target = byId(id) || sections[0];
    if (!target) return;
    sections.forEach((s) => { s.hidden = s !== target; });
    tocLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + target.id));
    if (window.innerWidth <= 860) toc.classList.remove("open");
    if (tmain.scrollIntoView) tmain.scrollIntoView({ block: "start" });
    if (push && target.id) history.replaceState(null, "", "#" + target.id);
  };
  tocLinks.forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1);
    if (byId(id)) { e.preventDefault(); reveal(id, true); }
  }));
  const initial = (location.hash || "").slice(1);
  reveal(byId(initial) ? initial : (sections[0] && sections[0].id), false);
  const toggle = document.querySelector(".tuto-toc-toggle");
  if (toggle) toggle.addEventListener("click", () => toc.classList.toggle("open"));
}

// Newsletter — inscription reelle (Cloudflare Worker, entrees KV "sub:")
const NL_ENDPOINT = "https://atmart-chat.atmartllc.workers.dev/subscribe";
document.querySelectorAll(".newsletter-form").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input[type=email]");
    const btn = form.querySelector("button");
    const status = form.parentElement.querySelector(".nl-status");
    const show = (cls) => {
      if (!status) return;
      status.hidden = false;
      status.querySelectorAll("span").forEach((s) => { s.hidden = !s.classList.contains(cls); });
    };
    const email = (input.value || "").trim();
    if (!email) return;
    btn.disabled = true;
    fetch(NL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        lang: (document.documentElement.lang || "fr").slice(0, 2),
        source: location.pathname,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok && d.ok })))
      .then((res) => {
        if (res.ok) { show("nl-ok"); form.reset(); }
        else { show("nl-err"); }
      })
      .catch(() => show("nl-err"))
      .finally(() => { btn.disabled = false; });
  });
});
