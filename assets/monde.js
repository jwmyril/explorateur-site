/* Haïti dans le monde — la section « données vivantes » de l'accueil.
   ========================================================================
   ELLE NE TÉLÉCHARGE RIEN TANT QU'ON NE L'OUVRE PAS. Le fichier pèse 20 Ko :
   l'imposer à chaque visiteur pour un encart replié serait exactement le
   défaut relevé le 01/09 — 224 Ko téléchargés en silence, dont 153 Ko que la
   page annonçait « à la demande ». Ici, `<details>` déclenche le chargement
   à la première ouverture, une seule fois, et jamais autrement.

   LES CHIFFRES NE SONT PAS APPELÉS EN DIRECT DEPUIS LE NAVIGATEUR, et c'est
   un choix. Une API tierce demanderait d'ouvrir la CSP, casserait le hors
   connexion, et afficherait des valeurs sans date d'extraction ni empreinte
   de capture. Le fichier lu ici a été scellé par l'atelier, daté, et porte
   sa méthode : « vivant » veut dire qu'il se rafraîchit sans que personne le
   retape, pas qu'il clignote. */
(function () {
  "use strict";
  var boite = document.getElementById("mo-boite");
  if (!boite) return;
  var corps = document.getElementById("mo-corps");
  var charge = false;
  /* LA RACINE, VUE DEPUIS CETTE PAGE. `/ht/index.html` demanderait sinon
     `/ht/data/…`, qui n'existe pas — c'est le défaut PF-1, corrigé sur
     l'édition légère trois heures plus tôt. Le même piège attend chaque
     nouveau fichier lu depuis une page traduite. */
  var RACINE = /^\/(ht|en|es)\//.test(location.pathname) ? "../" : "";
  /* LE MARQUEUR DE DONNÉES DU SITE, un seul pour tout le monde — un contrôle
     l'exige depuis le 30/08, et il a raison : deux marqueurs, c'est deux
     caches, et celui qui reste en arrière sert du périmé indéfiniment. */
  var DV = "?d=2026-09-04a";
  var FICHIER = RACINE + "data/atmart_comparaison_monde.json" + DV;

  /* LA CLÉ EST LA PHRASE FRANÇAISE, comme partout ailleurs dans le moteur.
     Une chaîne sans traduction s'affiche alors en français lisible, jamais
     en identifiant technique — et le jour où l'on ajoute une phrase, elle
     est déjà utilisable avant d'être traduite. */
  function T(fr) {
    return (window.ATM_I18N && window.ATM_I18N.texte)
      ? window.ATM_I18N.texte(fr) : fr;
  }

  /* La langue décide du séparateur : « 9 605,28 » en français, kreyòl et
     espagnol, « 9,605.28 » en anglais. Le mélanger produirait un nombre que
     personne ne lit correctement. */
  function nb(v, lang) {
    if (v === null || v === undefined) return "—";
    var s = Number(v).toLocaleString(lang === "en" ? "en-US" : "fr-FR",
      { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
    return s;
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function dessiner(doc) {
    var lang = document.documentElement.lang || "fr";
    var m = doc.meta || {};
    var h = [];

    h.push('<div class="x-tableau" tabindex="0" role="region" aria-label="' +
           esc(T("Haïti comparée au monde et aux Caraïbes")) +
           '">');
    h.push("<table><caption>" +
           esc(T("Haïti comparée au monde et aux Caraïbes")) +
           "</caption><thead><tr>");
    ["Indicateur", "Haïti", "Rang mondial", "Médiane mondiale",
     "République dominicaine"].forEach(function (t, i) {
      h.push('<th scope="col"' + (i ? ' class="r"' : "") + ">" +
             esc(T(t)) + "</th>");
    });
    h.push("</tr></thead><tbody>");

    (doc.indicateurs || []).forEach(function (x) {
      var lib = (x.libelle && (x.libelle[lang] || x.libelle.fr)) || x.code;
      var uni = (x.unite && (x.unite[lang] || x.unite.fr)) || "";
      var dom = null;
      (x.voisins || []).forEach(function (v) { if (v.iso === "DOM") dom = v; });
      var rang = x.monde && x.monde.rang;
      h.push("<tr>");
      h.push('<th scope="row">' + esc(lib) +
             '<small class="mo-u"> · ' + esc(uni) + "</small></th>");
      h.push('<td class="num"><b>' + nb(x.haiti.v, lang) + "</b>" +
             '<small class="mo-u"> ' + x.haiti.an + "</small></td>");
      /* UN RANG SANS SON EFFECTIF NE VEUT RIEN DIRE : un pays qui ne déclare
         rien n'est pas dernier, il est absent. Le nombre de pays comparés
         change d'un indicateur à l'autre, il est donc écrit à chaque fois. */
      h.push('<td class="num">' + (rang
             ? esc(T("{r} sur {n}")
                     .replace("{r}", nb(rang, lang))
                     .replace("{n}", nb(x.monde.pays, lang)))
             : "—") + "</td>");
      h.push('<td class="num">' + nb(x.monde.mediane, lang) + "</td>");
      h.push('<td class="num">' + (dom ? nb(dom.v, lang) +
             '<small class="mo-u"> ' + dom.an + "</small>" : "—") + "</td>");
      h.push("</tr>");
    });
    h.push("</tbody></table></div>");

    h.push('<p class="x-note">' + esc(T("Source")) + " : " +
           esc(m.source || "") + " — " + esc(T("relevé le")) +
           " " + esc(m.date_extraction || "") + ", " +
           esc(T("valeur la plus récente de chaque pays sur")) +
           " " + esc(m.fenetre || "") + ".</p>");
    h.push('<p class="x-note">' + esc(T("Un rang mondial dépend de qui déclare : un pays qui ne publie "
           + "rien n'est pas dernier, il est absent du classement. Les "
           + "quinze voisins des Caraïbes sont dans le fichier.")) +
           ' <a href="' + RACINE + 'data/atmart_comparaison_monde.json" download>' +
           esc(T("Télécharger le fichier (JSON)")) + "</a></p>");
    corps.innerHTML = h.join("");
  }

  function ouvrir() {
    if (charge) return;
    charge = true;
    corps.innerHTML = '<p class="x-note">' +
      T("Chargement…") + "</p>";
    fetch(FICHIER)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(dessiner)
      .catch(function () {
        /* On dit que ça n'a pas marché, et on laisse rouvrir. Un encart vide
           laisserait croire qu'il n'y a rien à comparer. */
        charge = false;
        corps.innerHTML = '<p class="x-note">' +
          T("La comparaison n'a pas pu être chargée.") + "</p>";
      });
  }

  boite.addEventListener("toggle", function () { if (boite.open) ouvrir(); });
  if (boite.open) ouvrir();
  /* Changer de langue redessine, sans retélécharger. */
  document.addEventListener("atmart:lang", function () {
    if (charge && corps.innerHTML.indexOf("<table") !== -1) {
      fetch(FICHIER)
        .then(function (r) { return r.json(); }).then(dessiner)
        .catch(function () { /* on garde l'affichage précédent */ });
    }
  });
})();
