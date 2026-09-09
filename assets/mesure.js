/* Mesure d'audience anonyme — voie C de la spécification P2-2 (14/08/2026).
   Ce que ce fichier fait, et tout ce qu'il fait : compter des ÉVÉNEMENTS
   AGRÉGÉS (une recherche a été lancée, un export a eu lieu) — jamais qui,
   jamais quoi précisément. Pas de cookie, pas de localStorage d'identifiant,
   pas d'empreinte, pas de contenu de recherche : le texte tapé ne quitte
   JAMAIS le navigateur. La liste exacte des événements est publiée sur la
   page Confiance. Ce script est DÉCOUPLÉ du moteur : il observe le DOM par
   délégation — le supprimer ne change rien au fonctionnement du site. */
(function () {
  "use strict";
  var POINT = "https://atmart-chat.atmartllc.workers.dev/ev";
  var dernier = {};

  /* La langue etait ecrite en dur a « fr ». Le site a QUATRE langues (en/, es/,
     ht/) et le compteur de langue est GLOBAL : chaque page kreyol de
     l'Explorateur etait comptee comme francaise, y compris dans les
     statistiques de Suite 360. On la lit maintenant sur la page. */
  function langue() {
    var l = (document.documentElement.getAttribute("lang") || "").toLowerCase().slice(0, 2);
    return (l === "ht" || l === "fr" || l === "en" || l === "es") ? l : "fr";
  }

  /* La provenance valait « ref » ou rien : impossible d'en tirer si un lecteur
     vient de LinkedIn ou d'une recherche. On garde le nom du domaine — jamais
     l'adresse complete, qui pourrait porter une requete. */
  function provenance() {
    try {
      var u = new URLSearchParams(location.search).get("utm_source");
      if (u) return u.toLowerCase().slice(0, 32);
      if (!document.referrer) return "direct";
      var h = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (h === location.hostname) return "";
      var b = h.split(".");
      return (b.length > 2 ? b[b.length - 2] : b[0]).slice(0, 32);
    } catch (e) { return "direct"; }
  }

  function envoyer(nom) {
    var t = Date.now();
    if (dernier[nom] && t - dernier[nom] < 5000) return;   /* anti-rafale */
    dernier[nom] = t;
    /* « app » : la dimension qui manquait. Le prefixe xpl_ tenait lieu de
       separation entre applications ; a six sites il ne tient plus. */
    var corps = JSON.stringify({ app: "xpl", name: nom, lang: langue(),
                                 src: provenance(), page: location.pathname });
    try {
      /* « text/plain » et non « application/json » : sendBeacon envoie
         toujours avec les identifiants, et un type JSON declenche alors un
         controle prealable que le navigateur refuse faute d'en-tete
         Access-Control-Allow-Credentials. En text/plain, la requete est
         simple : pas de controle prealable, donc rien a echouer. Le Worker
         lit le corps de la meme facon — verifie, il repond 204. */
      if (navigator.sendBeacon) {
        navigator.sendBeacon(POINT,
          new Blob([corps], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(POINT, { method: "POST", body: corps, keepalive: true,
                       credentials: "omit",
                       headers: { "Content-Type": "text/plain;charset=UTF-8" }
                     }).catch(function () {});
      }
    } catch (e) { /* la mesure ne casse jamais l'expérience */ }
  }

  /* page vue */
  envoyer(/couches\.html/.test(location.pathname) ? "xpl_couches_view" : "xpl_view");

  /* recherche lancée : le premier caractère tapé compte, le texte reste local */
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t && (t.id === "x-recherche" || t.id === "x-comp-input") && t.value.length === 1)
      envoyer("xpl_recherche");
  }, true);

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === "x-objectif") envoyer("xpl_usage");
    if (t.id === "k-choix") envoyer("xpl_couche_choisie");
  }, true);

  document.addEventListener("click", function (e) {
    var el = e.target;
    while (el && el !== document.body) {
      var cl = el.classList || { contains: function () { return false; } };
      if (cl.contains("x-res")) { envoyer("xpl_territoire"); return; }
      if (cl.contains("x-btn-comp") || (el.dataset && el.dataset.onglet === "comparaison")) {
        envoyer("xpl_comparaison"); return;
      }
      if (cl.contains("x-btn-export") || cl.contains("x-btn-export-agg") ||
          el.id === "x-export") { envoyer("xpl_export"); return; }
      if (cl.contains("x-btn-print")) { envoyer("xpl_impression"); return; }
      if (el.tagName === "SUMMARY" && el.parentElement &&
          el.parentElement.classList.contains("x-mesure")) {
        envoyer("xpl_indicateur"); return;
      }
      if (el.tagName === "A" && el.href) {
        if (el.href.indexOf("pack-geo") > -1) { envoyer("xpl_packgeo"); return; }
        if (el.href.indexOf("parrainage") > -1) { envoyer("xpl_financement"); return; }
        if (el.href.indexOf("solutions") > -1) { envoyer("xpl_licence"); return; }
      }
      el = el.parentElement;
    }
  }, true);
})();
