/* Application installable — invite d'installation et état de la connexion.
   15/08/2026.

   Deux services, tous deux discrets :

   1. Une invite d'installation qui n'apparaît QUE si le navigateur la propose
      (événement `beforeinstallprompt`), et seulement après que le visiteur a
      montré de l'intérêt — pas au premier écran. Une bannière qui saute au
      visage dès l'arrivée fait fuir ; une proposition qui arrive après une
      recherche est comprise. Refusée, elle ne revient pas de la session.

   2. Un bandeau quand la connexion tombe, qui dit ce qui reste POSSIBLE :
      hors ligne, l'édition légère garde l'index des 140 communes et les
      fiches déjà ouvertes. Annoncer une panne sans dire ce qui marche encore
      n'aide personne.

   Ce fichier est facultatif : le supprimer n'enlève rien au fonctionnement
   du site, seulement l'invite et le bandeau. */
(function () {
  "use strict";
  var invite = null, propose = false;

  function texteInstaller() {
    var l = (document.documentElement.lang || "fr").slice(0, 2);
    return {
      fr: { b: "Installer l'application", d: "Consultable sans connexion, sans compte.",
            n: "Plus tard" },
      ht: { b: "Enstale aplikasyon an", d: "Ou ka li l san entènèt, san kont.",
            n: "Pita" },
      en: { b: "Install the app", d: "Readable offline, no account needed.",
            n: "Later" },
      es: { b: "Instalar la aplicación", d: "Se consulta sin conexión, sin cuenta.",
            n: "Más tarde" }
    }[l] || null;
  }

  function texteHorsLigne() {
    var l = (document.documentElement.lang || "fr").slice(0, 2);
    return {
      fr: "Vous êtes hors connexion. Les communes déjà consultées et la recherche restent disponibles.",
      ht: "Ou pa gen entènèt. Komin ou te deja louvri yo ak rechèch la disponib toujou.",
      en: "You are offline. Communes you already opened and the search still work.",
      es: "Está sin conexión. Las comunas ya consultadas y la búsqueda siguen disponibles."
    }[l] || null;
  }

  function style() {
    if (document.getElementById("pwa-style")) return;
    var s = document.createElement("style");
    s.id = "pwa-style";
    s.textContent =
      "#pwa-inst{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:60;max-width:26rem;" +
      "margin:0 auto;background:#0e2240;color:#fff;border-radius:12px;padding:.85rem 1rem;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;gap:.7rem;align-items:center;" +
      "font-size:.92rem;line-height:1.35}" +
      "#pwa-inst button{font:inherit;border:0;border-radius:9px;padding:.6rem .9rem;" +
      "min-height:44px;cursor:pointer}" +
      "#pwa-oui{background:#2ec4b6;color:#04201d;font-weight:600}" +
      "#pwa-non{background:transparent;color:#cfe0f5;text-decoration:underline;min-width:44px}" +
      "#pwa-hors{position:fixed;left:0;right:0;top:0;z-index:61;background:#8a5a00;color:#fff;" +
      "padding:.55rem .9rem;font-size:.88rem;text-align:center}" +
      "@media(prefers-reduced-motion:no-preference){#pwa-inst{animation:pwa-mont .25s ease-out}}" +
      "@keyframes pwa-mont{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}";
    document.head.appendChild(s);
  }

  function proposer() {
    var t = texteInstaller();
    if (!invite || propose || !t) return;
    propose = true;
    style();
    var d = document.createElement("div");
    d.id = "pwa-inst";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", t.b);
    d.innerHTML = '<span style="flex:1"><b>' + t.b + "</b><br><small>" + t.d +
      '</small></span><button type="button" id="pwa-oui">' + t.b.split(" ")[0] +
      '</button><button type="button" id="pwa-non">' + t.n + "</button>";
    document.body.appendChild(d);
    d.querySelector("#pwa-oui").addEventListener("click", function () {
      d.remove();
      invite.prompt();
      invite.userChoice.then(function () { invite = null; });
    });
    d.querySelector("#pwa-non").addEventListener("click", function () {
      d.remove();
      try { sessionStorage.setItem("pwa_refus", "1"); } catch (e) {}
    });
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    invite = e;
    var refus = false;
    try { refus = sessionStorage.getItem("pwa_refus") === "1"; } catch (err) {}
    if (refus) return;
    /* On attend un signe d'intérêt : une recherche, un clic sur un résultat,
       ou trente secondes de lecture. Jamais à l'arrivée. */
    var interet = function () { setTimeout(proposer, 600); nettoyer(); };
    var nettoyer = function () {
      document.removeEventListener("input", surRecherche, true);
      document.removeEventListener("click", surClic, true);
    };
    var surRecherche = function (ev) {
      if (ev.target && /^(x-recherche|q|x-comp-input)$/.test(ev.target.id)) interet();
    };
    var surClic = function (ev) {
      if (ev.target.closest && ev.target.closest(".x-res, #res a, .x-puce")) interet();
    };
    document.addEventListener("input", surRecherche, true);
    document.addEventListener("click", surClic, true);
    setTimeout(function () { if (!propose) { proposer(); nettoyer(); } }, 30000);
  });

  /* Le signal de fin de course : la page est affichée, plus personne
     n'attend, le service worker peut prendre les données pour les visites
     suivantes. Deux secondes de marge après `load` — sur un mobile bas de
     gamme, le rendu n'est pas fini quand l'événement part. */
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "precharger" });
      }
    }, 2000);
  });

  /* état de la connexion */
  function horsLigne() {
    var t = texteHorsLigne();
    if (!t || document.getElementById("pwa-hors")) return;
    style();
    var b = document.createElement("div");
    b.id = "pwa-hors";
    b.setAttribute("role", "status");
    b.textContent = t;
    document.body.appendChild(b);
  }
  function enLigne() {
    var b = document.getElementById("pwa-hors");
    if (b) b.remove();
  }
  window.addEventListener("offline", horsLigne);
  window.addEventListener("online", enLigne);
  if (navigator.onLine === false) horsLigne();
})();
