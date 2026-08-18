/* Apparence : Automatique, Clair, Sombre — 17/08/2026.

   CE QUI SE PASSE AVANT CE FICHIER. Un script minuscule, posé dans le <head>
   de chaque page AVANT toute feuille de style, lit la préférence et pose
   `data-theme` sur <html>. Il doit rester là, en ligne et synchrone : chargé
   d'ici, il s'exécuterait après le premier rendu et le lecteur verrait un
   éclair blanc avant que le thème sombre ne s'applique. C'est le seul script
   du site qui a une raison de bloquer.

   CE QUE CE FICHIER FAIT. Il construit le contrôle, applique un choix, et
   tient à jour les deux choses que le CSS ne peut pas atteindre seul :
   `color-scheme`, qui teinte les pièces natives du navigateur, et la balise
   `theme-color`, qui colore la barre du système sur mobile.

   CE QU'IL NE FAIT PAS. Il n'envoie rien et ne mesure rien. L'apparence
   qu'une personne choisit dit quelque chose d'elle — l'heure à laquelle elle
   travaille, sa vue, son matériel — et cela ne regarde pas Atmart. La valeur
   reste dans `localStorage`, sur l'appareil, et n'apparaît dans aucune URL.

   LA PRÉFÉRENCE EST COMMUNE AUX QUATRE LANGUES : la clé ne porte pas la
   langue, et `/ht/` comme `/es/` sont servis par la même origine. Choisir
   sombre en kreyòl et retrouver du clair en français serait un défaut. */
(function () {
  "use strict";
  var CLE = "atmart_apparence";
  var VALEURS = ["auto", "clair", "sombre"];
  /* La barre du système reprend le fond de page de chaque thème. */
  var BARRE = { clair: "#FFFFFF", sombre: "#080C12" };

  function lu() {
    try {
      var v = localStorage.getItem(CLE);
      return VALEURS.indexOf(v) > -1 ? v : "auto";
    } catch (e) { return "auto"; }
  }

  function systemeSombre() {
    return window.matchMedia &&
           window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function effectif(choix) {
    if (choix === "clair" || choix === "sombre") return choix;
    return systemeSombre() ? "sombre" : "clair";
  }

  function appliquer(choix) {
    var e = document.documentElement;
    /* En « auto » on RETIRE l'attribut au lieu d'écrire une valeur : la
       feuille de style contient déjà la règle média, et lui laisser la main
       évite qu'un changement de réglage système pendant la visite trouve un
       attribut figé en travers. */
    if (choix === "auto") e.removeAttribute("data-theme");
    else e.setAttribute("data-theme", choix === "sombre" ? "dark" : "light");

    var reel = effectif(choix);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute("content", BARRE[reel]);
    document.dispatchEvent(new CustomEvent("atmart:apparence",
      { detail: { choix: choix, reel: reel } }));
  }

  function enregistrer(choix) {
    try { localStorage.setItem(CLE, choix); } catch (e) {}
    appliquer(choix);
  }

  /* Le contrôle. Un <select> natif, et ce n'est pas un pis-aller : il est
     navigable au clavier, annoncé correctement par les lecteurs d'écran, et
     utilisable au doigt sans qu'on ait à réécrire une liste déroulante — ce
     qui est très exactement le genre de réécriture qui casse l'accessibilité
     qu'elle prétend améliorer. */
  function poser() {
    var hote = document.querySelector(".nav");
    if (!hote || document.getElementById("x-apparence")) return;
    var d = document.createElement("div");
    d.className = "x-apparence";
    d.innerHTML =
      '<label class="x-sr" for="x-apparence" data-i18n="ap.titre">Apparence</label>' +
      '<select id="x-apparence" title="Apparence" aria-label="Apparence">' +
      '<option value="auto" data-i18n="ap.auto">Automatique</option>' +
      '<option value="clair" data-i18n="ap.clair">Clair</option>' +
      '<option value="sombre" data-i18n="ap.sombre">Sombre</option>' +
      "</select>";
    var lg = hote.querySelector(".x-langues, #x-langues");
    if (lg && lg.parentNode) lg.parentNode.insertBefore(d, lg);
    else hote.appendChild(d);
    var s = d.querySelector("select");
    s.value = lu();
    s.addEventListener("change", function () { enregistrer(s.value); });
    /* Ce contrôle naît APRÈS le passage de traduction : i18n.js s'exécute
       pendant l'analyse de la page, ce script est différé. Sans cet appel,
       « Automatique / Clair / Sombre » restaient en français au milieu d'une
       page kreyòl — et une page à moitié traduite est pire qu'une page qui
       ne l'est pas, parce que le lecteur ne sait plus dans quelle langue il
       lit. On redemande la traduction du seul fragment concerné. */
    boite = d;
    traduire(d);
  }

  var boite = null;

  function traduire(racine) {
    racine = racine || boite;
    if (!racine) return;
    if (window.ATM_I18N && window.ATM_I18N.traduire) {
      try { window.ATM_I18N.traduire(racine); } catch (e) {}
    }
  }

  /* Posé tout de suite, avant même que le contrôle existe : si le
     dictionnaire arrive en premier, l'événement nous trouve ; s'il arrive en
     dernier, `boite` est déjà là. Dans les deux sens, le contrôle finit
     traduit — au lieu de dépendre de la présence du fichier en cache. */
  document.addEventListener("atmart:lang", function () { traduire(); });

  /* Le système change d'avis en cours de visite — bascule nocturne, réglage
     modifié dans un autre onglet. En « auto », la page suit sans rechargement ;
     un choix explicite, lui, ne bouge pas. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var suivre = function () { if (lu() === "auto") appliquer("auto"); };
    if (mq.addEventListener) mq.addEventListener("change", suivre);
    else if (mq.addListener) mq.addListener(suivre);
  }

  appliquer(lu());
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", poser);
  } else { poser(); }
})();
