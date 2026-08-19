/* Module « comparaison » du moteur — découpé le 16/08/2026.
   Le code est celui d'explorateur.js, déplacé verbatim : seules les
   variables réassignées ont pris le préfixe S. de l'état partagé.
   A porte les fonctions des autres modules. */
import { S } from "./etat.js";
export default function (A) {
  /* Ce que ce module reçoit des autres — calculé, jamais listé à la main. */
  const { $, NIVEAU, T, TF, TN, aggEntite, agreger, carteResultat, chercher, communesDe, dico, entitesDuNiveau, esc, fmt, libelle, majURL, nb, nomT, parId, populationDe, totalNational, uniteL, valeurBrute } = A;
  /* --------------------------------------------------------- normalisation
     Rapporter une valeur a une base commune. Les quatre lectures sont ouvertes
     depuis que la population communale est integree : « par habitant » repose
     sur une projection 2024 (statut E), ce que la note dit a l'utilisateur au
     lieu de le laisser croire a un denombrement. */
  var NORMALISATIONS = {
    total: { nom: "Valeur brute", suffixe: "", possible: true },
    km2: { nom: "Pour 100 km\u00b2", suffixe: " / 100 km\u00b2", possible: true },
    part: { nom: "Part du total national", suffixe: " %", possible: true },
    habitant: { nom: "Pour 10 000 habitants", suffixe: " / 10 000 hab.", possible: true,
                note: "Population : projection 2024 (UNFPA, base IHSI/CNIGS) \u2014 une estimation, statut E, pas un d\u00e9nombrement." }
  };

  /* La normalisation n'a de sens que sur un comptage : normaliser un
     pourcentage ou une densite produirait un nombre sans signification. */
  function normalisable(indId) {
    var d = dico[indId] || {};
    return d.unite === "nombre";
  }

  function appliquerNorm(indId, valeur, entite, totalNational) {
    if (S.normalisation === "total" || !normalisable(indId)) return { v: valeur, u: (dico[indId] || {}).unite };
    if (S.normalisation === "km2") {
      var s = nb(entite.superficie_km2);
      if (!s) return { v: null, u: "" };
      return { v: valeur / s * 100, u: "/ 100 km\u00b2" };
    }
    if (S.normalisation === "part") {
      if (!totalNational) return { v: null, u: "" };
      return { v: valeur / totalNational * 100, u: "%" };
    }
    if (S.normalisation === "habitant") {
      if (indId === "IND-POP-001") return { v: valeur, u: (dico[indId] || {}).unite };
      var pop = populationDe(entite);
      if (!pop) return { v: null, u: "" };
      return { v: valeur / pop * 10000, u: "/ 10 000 hab." };
    }
    return { v: valeur, u: (dico[indId] || {}).unite };
  }

  /* ----------------------------------------------------------- comparaison
     Deux a quatre territoires cote a cote. Une ligne par indicateur, avec son
     millesime : comparer des valeurs de millesimes differents est signale. */
  var MAX_COMP = 4;

  function ajouterComparaison(id) {
    if (S.comparees.indexOf(id) > -1 || S.comparees.length >= MAX_COMP) return;
    S.comparees.push(id);
    rendreComparaison();
    majURL();
  }

  function valeursDe(r) {
    var m = {};
    if (r.niveau_admin === "3") {
      S.vals.forEach(function (v) { if (v.pcode_commune === r.pcode) m[v.indicateur_id] = v; });
      return m;
    }
    var agg = aggEntite[r.atmart_geo_id] || agreger(r, communesDe(r));
    Object.keys(agg).forEach(function (k) {
      m[k] = { valeur: agg[k].valeur, unite: agg[k].unite, annee_reference: agg[k].annee,
               statut_valeur: "A", methode: agg[k].note };
    });
    return m;
  }

  /* Le champ de recherche VIT dans le panneau de comparaison : l'utilisateur
     qui ouvre l'onglet Comparer doit voir ou agir, pas deviner que la barre
     d'en haut sert aussi a ca. Demande du proprietaire, 13/08 au soir. */
  function chercheCompHtml() {
    if (S.comparees.length >= MAX_COMP) return "";
    return '<div class="x-barre" style="margin:0 0 1.1rem;max-width:34rem">' +
      '<label for="x-comp-input" class="x-label">' +
      T("Ajouter un territoire — tapez un nom de commune, d'arrondissement ou de département") + "</label>" +
      '<input id="x-comp-input" type="search" autocomplete="off" spellcheck="false" placeholder="' +
      esc(T("Léogâne, Gonaïves, HT0121…")) + '" />' +
      '<div id="x-comp-res" role="listbox" hidden></div></div>';
  }
  function brancherChercheComp() {
    var ci = $("#x-comp-input"), cr = $("#x-comp-res");
    if (!ci || !cr) return;
    ci.addEventListener("input", function () {
      var q = ci.value.trim();
      if (!q) { cr.hidden = true; cr.innerHTML = ""; return; }
      var l = chercher(q).filter(function (r) {
        return S.comparees.indexOf(r.atmart_geo_id) < 0; }).slice(0, 8);
      cr.innerHTML = l.length ? l.map(carteResultat).join("")
        : '<p class="x-vide">' + T("Aucun résultat.") + "</p>";
      cr.hidden = false;
    });
  }

  function rendreComparaison() {
    var zone = $("#x-comparaison-corps");
    if (!zone) return;
    /* si l'utilisateur enchaine les ajouts, le focus doit lui revenir */
    var refocus = document.activeElement && document.activeElement.id === "x-comp-input";
    var choix = $("#x-comp-choix");
    if (choix) {
      choix.innerHTML = S.comparees.length
        ? S.comparees.map(function (id) {
            var e = parId[id];
            return '<span class="x-jeton">' + esc(e ? nomT(e) : id) +
              '<button class="x-jeton-x" data-retirer="' + esc(id) + '" aria-label="' +
              esc(TF("Retirer {nom} de la comparaison", { nom: e ? nomT(e) : id })) +
              '">\u00d7</button></span>';
          }).join("")
        : '<span class="x-note">' + T("Aucun territoire sélectionné.") + "</span>";
    }
    if (S.comparees.length < 2) {
      zone.innerHTML = chercheCompHtml() + '<p class="x-note">' + TF(
        "Ajoutez au moins deux territoires. Depuis une fiche, le bouton « Ajouter à la comparaison » ; ou cherchez un territoire dans la barre ci-dessus puis ajoutez-le. Jusqu'à {max} territoires, communes et départements mélangés.",
        { max: MAX_COMP }) + "</p>";
      brancherChercheComp();
      if (refocus && $("#x-comp-input")) $("#x-comp-input").focus();
      return;
    }
    var ents = S.comparees.map(function (id) { return parId[id]; }).filter(Boolean);
    var jeux = ents.map(valeursDe);
    var ids = {};
    jeux.forEach(function (m) { Object.keys(m).forEach(function (k) { ids[k] = 1; }); });
    var cles = Object.keys(ids).filter(function (k) { return dico[k]; }).sort(function (a, b) {
      return (dico[a].categorie + dico[a].nom).localeCompare(dico[b].categorie + dico[b].nom); });

    var niveaux = {};
    ents.forEach(function (e) { niveaux[e.niveau_admin] = 1; });
    var h = [];
    if (Object.keys(niveaux).length > 1) {
      h.push('<p class="x-avert"><b>' + T("Niveaux territoriaux mélangés.") + "</b> " + TF(
        "Vous comparez des entités de tailles différentes — les valeurs brutes ne sont pas comparables telles quelles. Passez en {km2} ou en {part} pour une lecture juste, ou comparez des territoires de même niveau.",
        { km2: "<b>" + T(NORMALISATIONS.km2.nom) + "</b>",
          part: "<b>" + T(NORMALISATIONS.part.nom) + "</b>" }) + "</p>");
    }
    h.push('<div class="x-tabwrap"><table class="x-tab x-comp"><thead><tr><th scope="col">' +
           T("Indicateur") + "</th>");
    ents.forEach(function (e) {
      h.push('<th scope="col">' + esc(nomT(e)) + "<small>" + (T(NIVEAU[e.niveau_admin]) || "") + "</small></th>");
    });
    h.push("</tr></thead><tbody>");
    var alertes = 0;
    cles.forEach(function (k) {
      var d = dico[k];
      var annees = ents.map(function (e, i) { return (jeux[i][k] || {}).annee_reference; }).filter(Boolean);
      var melange = annees.length > 1 && annees.some(function (a) { return a !== annees[0]; });
      if (melange) alertes++;
      h.push("<tr><td><b>" + esc(libelle(k, "nom")) + "</b><small>" + esc(uniteL(d.unite)) +
             (melange ? ' \u00b7 <span class="x-alerte">' + T("millésimes différents") +
               "</span>" : "") + "</small></td>");
      ents.forEach(function (e, i) {
        var v = jeux[i][k];
        if (!v || v.valeur === "" || v.valeur === undefined || v.statut_valeur === "N") {
          h.push('<td class="x-nd">' + T("non documenté") + "</td>");
        } else {
          h.push("<td>" + fmt(v.valeur, v.unite) +
                 (v.annee_reference ? "<small>" + esc(v.annee_reference) + "</small>" : "") + "</td>");
        }
      });
      h.push("</tr>");
    });
    h.push("</tbody></table></div>");
    if (alertes) {
      h.push('<p class="x-note">' + TN({
        one: "{strong} — l'écart peut venir du temps écoulé, pas du territoire. Les années sont sous chaque valeur.",
        other: "{strong} — l'écart peut venir du temps écoulé, pas du territoire. Les années sont sous chaque valeur."
      }, alertes, { strong: "<b>" + TN({
        one: "{n} indicateur compare des millésimes différents",
        other: "{n} indicateurs comparent des millésimes différents" },
        alertes, { n: alertes }) + "</b>" }) + "</p>");
    }
    h.push('<p class="x-note">' + TF(
      "« {nd} » ne veut pas dire zéro : le territoire n'est pas couvert par la source de cet indicateur.",
      { nd: T("non documenté") }) + "</p>");
    h.push('<div class="x-actions"><button class="btn btn-outline x-btn-export-comp">' +
           T("Exporter la comparaison (CSV)") + "</button>" +
           '<button class="btn btn-outline x-btn-lien">' +
           T("Copier le lien de cette comparaison") + "</button>" +
           '<button class="btn btn-outline x-btn-print">' + T("Imprimer / PDF") + "</button></div>");
    zone.innerHTML = chercheCompHtml() + h.join("");
    brancherChercheComp();
    if (refocus && $("#x-comp-input")) $("#x-comp-input").focus();
  }

  function exporterComparaison() {
    var ents = S.comparees.map(function (id) { return parId[id]; }).filter(Boolean);
    var jeux = ents.map(valeursDe), ids = {};
    jeux.forEach(function (m) { Object.keys(m).forEach(function (k) { ids[k] = 1; }); });
    var lignes = [];
    Object.keys(ids).sort().forEach(function (k) {
      ents.forEach(function (e, i) {
        var v = jeux[i][k] || {};
        lignes.push([e.atmart_geo_id, e.pcode || "", e.nom_fr, e.nom_ht || "",
                     T(NIVEAU[e.niveau_admin]) || "",
                     k, libelle(k, "nom"), v.valeur === undefined ? "" : v.valeur,
                     uniteL(v.unite || ""), v.annee_reference || "",
                     v.statut_valeur || "N", v.methode || ""]);
      });
    });
    telecharger("atmart_comparaison_" +
      ents.map(function (e) { return e.pcode || e.atmart_geo_id; }).join("_") + ".csv",
      ["atmart_geo_id", "pcode", "territoire_fr", "territoire_ht", "niveau",
       "indicateur_id", "indicateur", "valeur", "unite", "annee_reference",
       "statut_valeur", "methode"].concat(enTeteMeta()),
      lignes.map(function (l) { return l.concat(ligneMeta()); }));
  }

  /* ------------------------------------------------------------ classement */
  function classement(indId) {
    var d = dico[indId] || {};
    var ents = entitesDuNiveau(S.niveauComp);
    var sansValeur = S.niveauComp === "1"
      ? { one: "{n} département sans valeur", other: "{n} départements sans valeur" }
      : S.niveauComp === "2"
      ? { one: "{n} arrondissement sans valeur", other: "{n} arrondissements sans valeur" }
      : { one: "{n} commune sans valeur", other: "{n} communes sans valeur" };
    var tot = S.normalisation === "part" ? totalNational(indId) : 0;

    var lignes = [], sans = [];
    ents.forEach(function (e) {
      var v = valeurBrute(e, indId);
      if (!v || v.valeur === null) { sans.push(e); return; }
      var n = appliquerNorm(indId, v.valeur, e, tot);
      if (n.v === null) { sans.push(e); return; }
      lignes.push({ e: e, brut: v, aff: n.v, unite: n.u });
    });
    lignes.sort(function (a, b) { return b.aff - a.aff; });

    var an = (lignes[0] || {}).brut ? lignes[0].brut.annee : "";
    var normInfo = NORMALISATIONS[S.normalisation];
    var h = ['<p class="x-note">' + esc(libelle(indId, "definition")) +
             (an ? " <b>" + TF("Millésime {an}.", { an: esc(an) }) + "</b>" : "") +
             /* Annoncer « Lecture : pour 100 km² » au-dessus de valeurs brutes
                contredirait l'avertissement affiche juste en dessous. */
             (S.normalisation !== "total" && normalisable(indId)
               ? " <b>" + T("Lecture :") + "</b> " + esc(T(normInfo.nom)) + "." : "") +
             (S.normalisation === "habitant" && normInfo.note
               ? " " + esc(T(normInfo.note)) : "") +
             (d.limites_connues ? " <b>" + T("Limite :") + "</b> " +
               esc(libelle(indId, "limites_connues")) : "") +
             "</p>"];

    if (S.normalisation !== "total" && !normalisable(indId)) {
      h.push('<p class="x-avert">' +
        T("Cet indicateur est déjà un taux ou une densité : le normaliser n'aurait pas de sens. Les valeurs brutes sont affichées.") +
        "</p>");
    }

    var colTerr = T(NIVEAU[S.niveauComp]);
    h.push('<div class="x-tabwrap"><table class="x-tab x-classement"><thead><tr><th scope="col">#</th><th scope="col">' +
           esc(colTerr) + '</th><th scope="col">' + esc(libelle(indId, "nom") || indId) +
           (S.normalisation !== "total" && normalisable(indId)
             ? " <small>" + esc(T(normInfo.nom)) + "</small>" : "") +
           '</th><th scope="col">' + (S.niveauComp === "3" ? esc(T(NIVEAU["1"])) : T("Couverture")) +
           '</th><th scope="col"><span class="x-sr">' + T("Comparer") + "</span></th></tr></thead><tbody>");

    lignes.forEach(function (l, i) {
      var contexte;
      if (S.niveauComp === "3") {
        var cur = parId[l.e.parent_atmart_geo_id], dep = null, g = 0;
        while (cur && g++ < 5) { if (cur.niveau_admin === "1") { dep = cur; break; }
                                 cur = parId[cur.parent_atmart_geo_id]; }
        contexte = dep ? nomT(dep) : "\u2014";
      } else {
        contexte = TN({ one: "{n} commune documentée", other: "{n} communes documentées" },
                      l.brut.couvertes || 0, { n: l.brut.couvertes || 0 });
      }
      h.push("<tr><td>" + (i + 1) + '</td><td><button class="x-lien" data-id="' +
        esc(l.e.atmart_geo_id) + '">' + esc(nomT(l.e)) + "</button></td><td>" +
        fmt(l.aff, l.unite) + "</td><td>" + esc(contexte) +
        '</td><td><button class="x-mini" data-comparer="' + esc(l.e.atmart_geo_id) +
        '" title="' + esc(T("Ajouter à la comparaison")) + '">+</button></td></tr>');
    });
    h.push("</tbody></table></div>");

    if (sans.length) {
      h.push('<p class="x-note">' + TN({
        one: "{titre} — non couvert par la source de cet indicateur, donc absent du classement plutôt que placé en bas : {liste}.",
        other: "{titre} — non couverts par la source de cet indicateur, donc absents du classement plutôt que placés en bas : {liste}."
      }, sans.length, {
        titre: "<b>" + TN(sansValeur, sans.length, { n: sans.length }) + "</b>",
        liste: sans.map(function (e) { return esc(nomT(e)); }).sort().join(", ")
      }) + "</p>");
    }
    h.push('<div class="x-actions"><button class="btn btn-outline x-btn-export-cl">' +
           T("Exporter ce classement (CSV)") + "</button>" +
           '<button class="btn btn-outline x-btn-comp-top">' +
           TF("Comparer les {n} premiers", { n: MAX_COMP }) + "</button>" +
           '<button class="btn btn-outline x-btn-lien">' +
           T("Copier le lien de cette vue") + "</button></div>");
    $("#x-classement-corps").innerHTML = h.join("");
    window.__classement = lignes;
  }

  /* Metadonnees communes a tous les exports : sans elles, un CSV sorti de son
     contexte devient un tableau de chiffres sans provenance. */
  function enTeteMeta() {
    return ["source_donnees", "millesime_referentiel", "version_referentiel",
            "date_extraction_atmart", "normalisation", "langue_libelles", "url_methodologie"];
  }
  function ligneMeta() {
    /* La langue des libelles est tracee : un CSV sorti de son contexte doit
       dire dans quelle langue ses intitules ont ete ecrits. Les identifiants,
       eux, ne changent jamais — c'est par eux qu'on rejoint les fichiers. */
    return ["Atmart Data \u2014 atmart.ltd", "CNIGS 2018", (S.terr[0] || {}).version || "",
            (S.vals[0] || {}).date_extraction || "", T(NORMALISATIONS[S.normalisation].nom), S.LANG,
            "https://atmart.ltd/donnees-backbone.html#indicateurs"];
  }

  function telecharger(nom, entetes, lignes) {
    var csv = [entetes.join(",")].concat(lignes.map(function (l) {
      return l.map(function (c) { return /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c; }).join(",");
    })).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = nom; a.click();
  }

  Object.assign(A, {NORMALISATIONS, normalisable, appliquerNorm, MAX_COMP, ajouterComparaison, valeursDe, chercheCompHtml, brancherChercheComp, rendreComparaison, exporterComparaison, classement, enTeteMeta, ligneMeta, telecharger});
}
