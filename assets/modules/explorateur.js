/* ===== Explorateur Haïti — Atmart Data =====
   Un seul moteur, deux éditions (window.ATM_EXPLORATEUR) :
     publique      : référentiel de base + indicateurs, depuis data/
     administrateur: référentiels complets, depuis un dossier local non publié
   Aucun compteur n'est écrit en dur : tout est compté depuis les fichiers. */
import { S } from "./etat.js";

(async function () {
  "use strict";

  /* A porte ce que les modules se prêtent : constantes et fonctions de
     l'entrée, puis les fonctions de chaque module au fur et à mesure. */
  const A = { S };

  var CFG = window.ATM_EXPLORATEUR || {};
  var ADMIN = !!CFG.admin;
  var DIR = CFG.dir || "data/";
  /* Racine du site Atmart pour les liens editoriaux (catalogue, backbone,
     Pack Geo, parrainage). Vide sur atmart.ltd ; le site autonome
     explorateur.atmart.ltd passe CFG.site="https://atmart.ltd/" pour que
     ces liens traversent les domaines au lieu de casser en 404. */
  var SITE = CFG.site || "";
  /* Version des donnees. A incrementer des qu'un fichier de data/ est
     regenere : sinon le cache du navigateur sert l'ancien fichier et
     l'interface affiche du perime sans le savoir. */
  var DV = "?d=2026-08-15a";
  var F = {
    terr: DIR + (ADMIN ? "atmart_referentiel_territoire_HT.csv"
                       : "atmart_referentiel_territoire_base_HT.csv"),
    vals: DIR + "atmart_indicateurs_communes_HT.csv",
    dico: DIR + "atmart_referentiel_indicateurs.csv",
    orgs: ADMIN ? DIR + "atmart_referentiel_organisations_HT.csv" : null,
    /* Chargés à la demande, pas au démarrage : voir « pyramide des âges ». */
    pyr: DIR + "atmart_pyramide_ages_HT.csv",
    prix: DIR + "atmart_prix_marches_HT.csv"
  };

  var dico = {};
  var parId = {}, parPcode = {}, enfantsDe = {}, orgsCom = {}, orgsSec = {};
  var parIndicateur = {};
  /* Contours d'affichage des départements et des communes, chargés avec le
     contour national. Le niveau dessiné suit la fiche ; carteNiveau ne
     retient que le choix explicite du lecteur. */
  
  /* Couverture reelle : combien de communes du socle portent une valeur pour
     chaque indicateur. Comptee au demarrage, jamais ecrite en dur — c'est ce
     qui distingue « 140 communes au socle » de « 14 communes couvertes ». */
  var couverture = {};
  
  /* La fiche s'ouvre réduite aux indicateurs de l'usage choisi ; l'utilisateur
     déplie une fois et l'état suit dans l'URL, sinon un lien partagé rouvrirait
     replié la fiche que l'on voulait montrer entière. */
  
  /* Vrai tant que l'utilisateur n'a pas choisi de territoire : la fiche
     affichée est alors une démonstration, et doit le dire. */
  
  var aggEntite = {};   /* agregats precalcules des departements et arrondissements */
     /* le meme calcul, sur les 140 communes */
  var $ = function (s) { return document.querySelector(s); };

  /* ---------------------------------------------------------------- outils */
  function parseCSV(txt) {
    txt = txt.replace(/^﻿/, "");
    var out = [], champ = "", ligne = [], q = false, i, c;
    for (i = 0; i < txt.length; i++) {
      c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { champ += '"'; i++; } else q = false; } else champ += c; }
      else if (c === '"') q = true;
      else if (c === ",") { ligne.push(champ); champ = ""; }
      else if (c === "\n") { ligne.push(champ); out.push(ligne); ligne = []; champ = ""; }
      else if (c !== "\r") champ += c;
    }
    if (champ !== "" || ligne.length) { ligne.push(champ); out.push(ligne); }
    var head = out.shift();
    return out.filter(function (l) { return l.length > 1; }).map(function (l) {
      var o = {}; head.forEach(function (h, j) { o[h] = (l[j] || "").trim(); }); return o;
    });
  }
  function sansAccent(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function nb(v) { var n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? null : n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function fmt(v, u) {
    var n = nb(v);
    if (n === null) return esc(v) || "—";
    var s = (Math.round(n * 100) / 100).toLocaleString(A.LOCALE[S.LANG]);
    if (u === "%") return s + " %";
    if (!u || u === "nombre") return s;
    return s + " " + esc(A.uniteL(u));
  }
  /* La date suit la langue : 31/07/2026 en francais et en creole,
     7/31/2026 en anglais, 31/7/2026 en espagnol. */
  function jour(d) {
    if (!d) return "—";
    var p = d.split("-");
    if (p.length !== 3) return d;
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(A.LOCALE[S.LANG], { timeZone: "UTC" });
  }

  var NIVEAU = { "0": "Pays", "1": "Département", "2": "Arrondissement", "3": "Commune",
                 "4": "Section communale", "5": "Localité" };
  var THEME = { Territoire: "🗺 Territoire", Santé: "🏥 Santé", Éducation: "🎓 Éducation",
                Marchés: "🛒 Marchés", Qualité: "📋 Qualité de la donnée",
                Démographie: "👥 Démographie" };
  /* Les codes du modèle de qualité, en clair pour l'utilisateur.
     Les codes eux-mêmes restent dans les exports et le bloc technique. */
  var STATUT = { O: "Valeur observée", A: "Valeur agrégée par Atmart", H: "Valeur harmonisée",
                 I: "Valeur interpolée", M: "Valeur modélisée", E: "Valeur estimée",
                 N: "Donnée non disponible" };
  var QUALITE = { A: "qualité élevée", B: "qualité acceptable", C: "qualité limitée" };
  /* Vocabulaires fermes du dictionnaire : ils vivent dans le code, pas dans le
     referentiel, parce que ce sont des codes de pilotage et non du texte
     redige. Les traduire en donnee les rendrait illisibles au moteur. */
  var REGLE = { somme: "somme", ratio_recalcule: "ratio recalculé",
                moyenne_simple: "moyenne simple", officielle: "valeur officielle",
                non_agregeable: "non agrégeable" };
  var STATUT_IND = { "Disponible": "Disponible",
                     "Définition prête, donnée absente": "Définition prête, donnée absente",
                     "À construire": "À construire" };


  function annoncer(t) { var a = $("#x-annonce"); if (a) a.textContent = t; }
  /* ------------------------------------------------------- rang et contexte */
  function rang(indId, pcode) {
    var l = parIndicateur[indId];
    if (!l) return null;
    var idx = l.findIndex(function (v) { return v.pcode_commune === pcode; });
    if (idx < 0) return null;
    return { rang: idx + 1, total: l.length,
             pct: Math.round((1 - idx / (l.length - 1 || 1)) * 100) };
  }

  /* Couverture d'un indicateur : combien de communes du socle portent une
     valeur. Le nombre est compté au démarrage ; la phrase le dit avec son
     dénominateur — un pourcentage dont le dénominateur n'est pas nommé est une
     affirmation qu'on ne peut pas vérifier. */
  function libCouverture(indId) {
    var c = couverture[indId];
    if (!c || !S.nCommunes) return null;
    return {
      court: A.TF("{n}/{t} communes", { n: c.avec, t: S.nCommunes }),
      phrase: c.avec >= S.nCommunes
        ? A.TF("les {t} communes du socle CNIGS 2018 portent une valeur.",
             { t: S.nCommunes })
        : A.TF("{n} communes sur {t} portent une valeur, soit {pct} % du socle CNIGS 2018. Les {r} autres sont documentées comme absentes, jamais comme des zéros.",
             { n: c.avec, t: S.nCommunes, r: S.nCommunes - c.avec,
               pct: Math.round(c.avec / S.nCommunes * 100) })
    };
  }

  /* Ce que l'année de référence désigne. Le dictionnaire le porte depuis le
     12/08 : sans lui, « millésime 2026 » ne disait pas si le phénomène s'est
     produit cette année-là ou s'il y a seulement été relevé. */
  var NATURE_PERIODE = {
    "observation": "l'année décrit le phénomène lui-même",
    "relevé": "l'année est celle du relevé, le phénomène étant continu",
    "millésime": "l'année est celle du découpage de référence"
  };

  /* Fraîcheur : la date de prochaine révision vit dans le dictionnaire, le
     retard se calcule à l'affichage. Une date écrite dans un fichier vieillit
     en silence ; une comparaison faite au moment où on lit, non. */
  function libFraicheur(d) {
    var p = d.date_prochaine_revision;
    if (!p) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) {
      return { texte: A.TF("Révision {quand}", { quand: p }), retard: false };
    }
    var auj = new Date().toISOString().slice(0, 10);
    return p < auj
      ? { texte: A.TF("Révision attendue depuis le {date}", { date: jour(p) }), retard: true }
      : { texte: A.TF("Prochaine révision prévue le {date}", { date: jour(p) }), retard: false };
  }

  /* Un lien « financer une donnée manquante » qui n'emporte ni l'indicateur ni
     le territoire oblige le visiteur à réécrire ce qu'il vient de lire. Le lien
     porte donc le contexte, et la page de parrainage préremplit son formulaire.
     Rien de personnel n'y transite : un nom d'indicateur et un nom de commune. */
  function lienParrainage(indId, r) {
    var q = [];
    if (indId) {
      q.push("jeu=" + encodeURIComponent(A.libelle(indId, "nom") || indId));
      var d = dico[indId] || {};
      if (d.dependance) q.push("src=" + encodeURIComponent(d.dependance));
      else if (d.source_primaire) q.push("src=" + encodeURIComponent(d.source_primaire));
    }
    if (r) q.push("terr=" + encodeURIComponent(A.nomT(r)));
    return SITE + "donnees-parrainage.html?" + q.join("&") + "#spo-form";
  }

  function facteurRatio(d) {
    var f = nb(d.facteur_ratio);
    if (f) return f;
    if (d.unite === "%") return 100;
    var chiffres = String(d.unite || "").split("/")[1] || "";
    return +chiffres.replace(/[^\d]/g, "") || 1;
  }

  function communesDe(r) {
    var out = [];
    S.terr.forEach(function (x) {
      if (x.niveau_admin !== "3") return;
      var cur = x, g = 0;
      while (cur && g++ < 5) {
        if (cur.atmart_geo_id === r.atmart_geo_id) { out.push(x); return; }
        cur = parId[cur.parent_atmart_geo_id];
      }
    });
    return out;
  }

  function agreger(r, communes) {
    var pcodes = {}, sommes = {}, compte = {}, unites = {}, annees = {};
    communes.forEach(function (c) { pcodes[c.pcode] = 1; });
    S.vals.forEach(function (v) {
      if (!pcodes[v.pcode_commune] || v.statut_valeur === "N") return;
      var x = nb(v.valeur);
      if (x === null) return;
      sommes[v.indicateur_id] = (sommes[v.indicateur_id] || 0) + x;
      compte[v.indicateur_id] = (compte[v.indicateur_id] || 0) + 1;
      unites[v.indicateur_id] = v.unite;
      annees[v.indicateur_id] = v.annee_reference;
    });
    var res = {};
    Object.keys(dico).forEach(function (k) {
      var d = dico[k], regle = d.regle_agregation;
      if (!regle && d.unite === "nombre") regle = "somme";   // dictionnaire ancien
      if (!regle || regle === "non_agregeable") return;
      var val = null, note = "";
      if (regle === "officielle") {
        val = nb(r.superficie_km2);
        note = A.T("valeur officielle de l'entité");
        if (val === null && sommes[k] !== undefined) { val = sommes[k]; note = A.T("somme des communes couvertes"); }
      } else if (regle === "somme") {
        if (sommes[k] === undefined) return;
        val = sommes[k];
        note = A.TN({ one: "somme sur {n} commune couverte",
                    other: "somme sur {n} communes couvertes" }, compte[k], { n: compte[k] });
      } else if (regle === "ratio_recalcule") {
        var num = d.numerateur === "IND-GEO-001" ? nb(r.superficie_km2) : sommes[d.numerateur];
        var den = d.denominateur === "IND-GEO-001" ? nb(r.superficie_km2) : sommes[d.denominateur];
        if (num == null || den == null || !den) return;
        val = num / den * facteurRatio(d);
        note = A.T("recalculé sur les totaux, pas moyenné entre communes");
      } else if (regle === "moyenne_simple") {
        if (compte[k] === undefined) return;
        val = sommes[k] / compte[k];
        note = A.TF("moyenne non pondérée des {n} communes couvertes", { n: compte[k] });
      }
      if (val === null || val === undefined) return;
      res[k] = { valeur: val, unite: unites[k] || d.unite, annee: annees[k], note: note,
                 couvertes: compte[k] || 0 };
    });
    return res;
  }
  /* --------------------------------------------- valeurs par niveau territorial
     Un departement n'a pas de valeurs propres dans le fichier : elles sont
     agregees depuis ses communes, selon la regle du dictionnaire. On les
     calcule une fois au demarrage plutot qu'a chaque affichage. */
  function precalculerAgregats() {
    S.terr.forEach(function (e) {
      if (e.niveau_admin === "1" || e.niveau_admin === "2") {
        aggEntite[e.atmart_geo_id] = agreger(e, communesDe(e));
      }
    });
    /* Le national suit exactement les mêmes règles que les départements : une
       somme se somme, un ratio se recalcule sur les totaux. Le calculer
       autrement ferait mentir la comparaison qu'on va afficher juste à côté. */
    S.aggNational = agreger({}, A.entitesDuNiveau("3"));
  }

  /* Où se situe une valeur communale par rapport à son département et au pays.
     Pour un ratio, on compare des ratios recalculés sur les totaux. Pour un
     effectif, comparer un nombre à une somme n'aurait aucun sens : on affiche
     la part que la commune y prend. */
  function situation(r, indId, valeur) {
    var d = dico[indId] || {};
    if (r.niveau_admin !== "3" || valeur === null) return null;
    var dep = null, cur = parId[r.parent_atmart_geo_id], g = 0;
    while (cur && g++ < 6) {
      if (cur.niveau_admin === "1") { dep = cur; break; }
      cur = parId[cur.parent_atmart_geo_id];
    }
    var aD = dep ? (aggEntite[dep.atmart_geo_id] || {})[indId] : null;
    var aN = (S.aggNational || {})[indId];
    if (!aN) return null;
    if (d.regle_agregation === "somme") {
      var pD = aD && aD.valeur ? valeur / aD.valeur * 100 : null;
      var pN = aN.valeur ? valeur / aN.valeur * 100 : null;
      if (pN === null) return null;
      var txt = dep && pD !== null
        ? A.TF("{pctD} % du total {dep_de}, {pctN} % du total national.",
             { pctD: fmt(Math.round(pD * 10) / 10), dep: A.nomT(dep),
               dep_de: A.deNom(dep.nom_fr), pctN: fmt(Math.round(pN * 10) / 10) })
        : A.TF("{pctN} % du total national.", { pctN: fmt(Math.round(pN * 10) / 10) });
      /* Une part de 100 % d'un total partiel ne dit pas ce qu'elle a l'air de
         dire : sur un indicateur couvert par une seule commune du département,
         « 100 % du total » signifie « seule commune documentée », pas « toutes
         les écoles du département ». Le total est donc qualifié dès qu'il ne
         repose pas sur l'ensemble des communes. */
      var nDep = dep ? communesDe(dep).length : 0;
      if (dep && aD && aD.couvertes < nDep) {
        txt += " " + A.TN({ one: "Ce total départemental ne repose que sur {n} commune documentée sur {t}.",
                          other: "Ce total départemental ne repose que sur {n} communes documentées sur {t}." },
                        aD.couvertes, { n: aD.couvertes, t: nDep });
      }
      if (aN.couvertes < S.nCommunes) {
        txt += " " + A.TF("Le total national en couvre {n} sur {t}.",
                        { n: aN.couvertes, t: S.nCommunes });
      }
      return txt;
    }
    if (d.regle_agregation !== "ratio_recalcule") return null;
    return dep && aD
      ? A.TF("{dep} : {vD} · Haïti : {vN} — recalculés sur les totaux, jamais moyennés.",
           { dep: esc(A.nomT(dep)), vD: fmt(aD.valeur, aD.unite),
             vN: fmt(aN.valeur, aN.unite) })
      : A.TF("Haïti : {vN} — recalculé sur les totaux, jamais moyenné.",
           { vN: fmt(aN.valeur, aN.unite) });
  }

  /* ------------------------------------------------------------- démarrage */
  function pret() {
    /* Le pays lui-même est cherchable : « Haïti » (ou « pays », « peyi »,
       « national ») ouvre une fiche nationale. Entité synthétique — le socle
       CNIGS s'arrête au département — raccrochée AU-DESSUS des départements
       pour que fil d'Ariane, carte, pyramide et agrégats suivent exactement le
       même chemin que pour n'importe quel territoire. Aucune valeur écrite en
       dur : superficie et population restent des sommes de communes. */
    S.terr.forEach(function (r) { if (r.niveau_admin === "1") r.parent_atmart_geo_id = "HT"; });
    S.terr.push({ atmart_geo_id: "HT", pcode: "HT", nom_fr: "Haïti", nom_ht: "Ayiti",
                niveau_admin: "0", type_entite: "Pays", parent_atmart_geo_id: "",
                superficie_km2: "", alias: "pays peyi nation nasyonal national" });
    S.terr.forEach(function (r) {
      parId[r.atmart_geo_id] = r;
      if (r.pcode) parPcode[r.pcode] = r;
      (enfantsDe[r.parent_atmart_geo_id] = enfantsDe[r.parent_atmart_geo_id] || []).push(r);
    });
    S.orgs.forEach(function (o) {
      if (o.pcode_commune) (orgsCom[o.pcode_commune] = orgsCom[o.pcode_commune] || []).push(o);
      if (o.pcode_section) (orgsSec[o.pcode_section] = orgsSec[o.pcode_section] || []).push(o);
    });
    S.vals.forEach(function (v) {
      if (v.statut_valeur === "N" || nb(v.valeur) === null) return;
      (parIndicateur[v.indicateur_id] = parIndicateur[v.indicateur_id] || []).push(v);
    });
    Object.keys(parIndicateur).forEach(function (k) {
      parIndicateur[k].sort(function (a, b) { return nb(b.valeur) - nb(a.valeur); });
    });

    /* Couverture par indicateur, et liste des indicateurs encore a construire.
       Les deux repondent a la meme question posee autrement : « sur quoi ce
       territoire est-il documente, et sur quoi ne l'est-il pas ». */
    S.nCommunes = S.terr.filter(function (r) { return r.niveau_admin === "3"; }).length;
    S.vals.forEach(function (v) {
      var c = couverture[v.indicateur_id] ||
              (couverture[v.indicateur_id] = { avec: 0, sans: 0 });
      if (v.statut_valeur === "N" || nb(v.valeur) === null) c.sans++; else c.avec++;
    });
    S.indBloques = Object.keys(dico).filter(function (k) {
      return dico[k].statut !== "Disponible";
    });

    /* compteurs : comptés, jamais écrits en dur */
    var nDep = S.terr.filter(function (r) { return r.niveau_admin === "1"; }).length;
    var nArr = S.terr.filter(function (r) { return r.niveau_admin === "2"; }).length;
    var nCom = S.terr.filter(function (r) { return r.niveau_admin === "3"; }).length;
    var nObs = S.vals.filter(function (v) { return v.statut_valeur !== "N"; }).length;
    var nAbs = S.vals.length - nObs;
    function compteurs() {
      var el = $("#x-compte");
      if (!el) return;
      /* « communes documentées » laissait entendre que les 140 le sont sur tout.
         Le socle territorial et la couverture d'un indicateur sont deux choses :
         la seconde se lit indicateur par indicateur, et va ici de 10 % à 100 %. */
      /* terr contient l'entité synthétique « Haïti » : elle n'est pas une
         entité du socle CNIGS, on ne la compte pas — le chiffre affiché doit
         rester exactement celui du référentiel. */
      var nTer = S.terr.filter(function (r) { return r.niveau_admin !== "0"; }).length;
      el.innerHTML = A.TF("{t} territoires au socle CNIGS 2018 · {c} communes · {o} valeurs sourcées · {a} absences documentées",
        { t: nTer.toLocaleString(A.LOCALE[S.LANG]), c: nCom,
          o: nObs.toLocaleString(A.LOCALE[S.LANG]),
          a: nAbs.toLocaleString(A.LOCALE[S.LANG]) }) +
        (ADMIN ? " · " + A.TF("{n} organisations",
          { n: S.orgs.length.toLocaleString(A.LOCALE[S.LANG]) }) : "");
    }
    /* Le bandeau de couverture et la matrice etaient ecrits une seule fois, au
       demarrage : changer de langue les laissait dans la precedente — du
       francais au milieu du kreyol, juste sous la barre de recherche. Ils
       deviennent une fonction, appelee ici ET par redessiner().

       « en vigueur » laissait entendre que le millesime 2018 est le decoupage
       legal d'aujourd'hui. Il est le referentiel que cette edition retient,
       parce qu'il est le seul a fournir des codes de jointure et des
       geometries — ce n'est pas la meme affirmation.

       Ce commentaire vivait entre TF( et sa chaine : verif_i18n_explorateur ne
       relevait alors pas la phrase, elle n'etait jamais comptee manquante,
       donc jamais traduite, et l'audit affichait 100 %. Rien ne doit se
       glisser entre l'appel et son premier argument. */
    function rendreCouverture() {
      var mc = $("#x-couv-corps");
      if (mc) mc.innerHTML = A.matriceCouverture();
      var cv = $("#x-couverture");
      if (!cv) return;
      cv.innerHTML = A.TF("Le référentiel territorial CNIGS 2018 retenu pour cette édition compte {decompte}. D'autres référentiels haïtiens, dont les estimations démographiques récentes de l'IHSI, en dénombrent davantage.",
        { decompte: "<b>" + A.TF("{dep} départements, {arr} arrondissements et {com} communes",
            { dep: nDep, arr: nArr, com: nCom }) + "</b>" }) +
        ' <button class="x-lien" id="x-pourquoi">' +
        A.T("Pourquoi ce nombre varie-t-il ?") + "</button>";
    }
    compteurs();
    rendreCouverture();

    var sel = $("#x-indicateur"), dispo = {};
    S.vals.forEach(function (v) { dispo[v.indicateur_id] = 1; });
    /* Les options portent le nom de l'indicateur : elles doivent etre
       reecrites quand la langue change, sinon la liste reste en francais
       au-dessus d'un tableau traduit. */
    function remplirIndicateurs() {
      var garde = sel.value;
      sel.innerHTML = "";
      Object.keys(dispo).sort().forEach(function (k) {
        var o = document.createElement("option");
        o.value = k; o.textContent = A.libelle(k, "nom") || k;
        sel.appendChild(o);
      });
      if (garde) sel.value = garde;
    }
    remplirIndicateurs();
    sel.value = "IND-QUA-001";
    precalculerAgregats();

    $("#x-chargement").hidden = true;
    $("#x-app").hidden = false;

    var champ = $("#x-recherche");
    champ.addEventListener("input", function () { A.afficherResultats(A.chercher(champ.value), champ.value); });
    champ.addEventListener("keydown", function (e) {
      var res = [].slice.call(document.querySelectorAll(".x-res"));
      if (e.key === "ArrowDown" && res.length) { e.preventDefault(); res[0].focus(); }
      if (e.key === "Escape") { $("#x-resultats").hidden = true; }
    });
    $("#x-resultats").addEventListener("keydown", function (e) {
      var res = [].slice.call(document.querySelectorAll(".x-res")), i = res.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (res[i + 1] || res[0]).focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); i <= 0 ? champ.focus() : res[i - 1].focus(); }
      if (e.key === "Escape") { $("#x-resultats").hidden = true; champ.focus(); }
    });

    document.addEventListener("click", function (e) {
      /* La bascule ne change que la carte : redessiner la fiche entière
         ferait sauter la page sous les yeux du lecteur. */
      var niv = e.target.closest(".x-carte-btn");
      if (niv) {
        S.carteNiveau = niv.dataset.niveau;
        var zone = document.querySelector(".x-carte");
        if (zone && S.courant) zone.outerHTML = A.blocCarte(S.courant);
        return;
      }
      /* Longueur de la fiche : le choix du lecteur, mémorisé. On redessine
         la fiche entière puisque c'est justement ce qui change. */
      var vue = e.target.closest("[data-vue]");
      if (vue) {
        S.vue = vue.dataset.vue;
        try { localStorage.setItem("atmart_vue", S.vue); } catch (err) {}
        if (S.courant) A.fiche(S.courant.atmart_geo_id);
        return;
      }
      var b = e.target.closest("[data-id]");
      if (b) {
        /* Depuis l'onglet Comparer, un resultat de recherche s'AJOUTE a la
           comparaison au lieu d'ouvrir sa fiche : c'est ce que le texte d'aide
           promet, et renvoyer l'utilisateur vers la fiche lui faisait perdre
           l'onglet et croire la comparaison impossible. */
        if (S.ongletActif === "comparaison" && b.classList.contains("x-res")) {
          A.ajouterComparaison(b.dataset.id);
          A.rendreComparaison(); A.majURL();
          $("#x-resultats").hidden = true; champ.value = "";
          var oc = document.querySelector('[data-onglet="comparaison"]');
          if (oc) oc.click();
          /* la main revient au champ : on enchaine les territoires sans re-cliquer */
          var nc = $("#x-comp-input");
          if (nc) nc.focus();
          return;
        }
        /* L'utilisateur a choisi un territoire : la fiche n'est plus un exemple. */
        S.montrerAccueil = false;
        A.fiche(b.dataset.id);
        $("#x-resultats").hidden = true; champ.value = "";
        var of = document.querySelector('[data-onglet="fiche"]');
        if (of) of.click();
        $("#x-fiche").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (e.target.closest(".x-btn-export") && S.courant) {
        var m = S.vals.filter(function (v) { return v.pcode_commune === S.courant.pcode; });
        A.telecharger("atmart_" + S.courant.pcode + "_indicateurs.csv",
          ["indicateur_id", "indicateur", "valeur", "unite", "annee_reference", "statut_valeur",
           "niveau_qualite", "source", "date_source", "methode"].concat(A.enTeteMeta()),
          m.map(function (v) {
            return [v.indicateur_id, libelle(v.indicateur_id, "nom"), v.valeur,
                    A.uniteL(v.unite), v.annee_reference,
                    v.statut_valeur, v.niveau_qualite, v.source, v.date_source,
                    v.methode].concat(A.ligneMeta());
          }));
        return;
      }
      /* La pyramide s'exporte avec ses effectifs exacts, pas avec les parts
         arrondies du graphique — et avec la ligne de traçabilité commune. */
      if (e.target.closest(".x-btn-pyr") && S.courant) {
        var p = A.pyramideDe(S.courant);
        if (!p) return;
        var lignes = [];
        S.pyrTranches.forEach(function (t, i) {
          ["F", "M", "T"].forEach(function (s) {
            lignes.push([S.courant.pcode || "", A.nomT(S.courant), S.pyrMeta.annee || "",
              s, A.libTranche(t), t.min, t.max === null ? "" : t.max, p[s][i],
              A.pct(p[s][i], p.total), S.pyrMeta.statut || "", S.pyrMeta.qualite || "",
              S.pyrMeta.source || ""].concat(A.ligneMeta()));
          });
        });
        A.telecharger("atmart_" + (S.courant.pcode || S.courant.atmart_geo_id) + "_pyramide_ages.csv",
          ["pcode", "territoire", "annee_reference", "sexe", "tranche_age", "borne_min",
           "borne_max", "effectif", "part_population", "statut_valeur", "niveau_qualite",
           "source"].concat(A.enTeteMeta()), lignes);
        return;
      }
      if (e.target.closest(".x-btn-lien")) {
        var u = location.href;
        if (navigator.clipboard) navigator.clipboard.writeText(u);
        var libelle = e.target.textContent;
        e.target.textContent = A.T("Lien copié ✓");
        setTimeout(function () { e.target.textContent = libelle; }, 2200);
        return;
      }
      var bc = e.target.closest("[data-comparer]");
      if (bc) {
        A.ajouterComparaison(bc.dataset.comparer);
        bc.textContent = S.comparees.indexOf(bc.dataset.comparer) > -1
          ? A.T("Ajouté à la comparaison ✓")
          : A.TF("Comparaison pleine ({n})", { n: A.MAX_COMP });
        return;
      }
      var br = e.target.closest("[data-retirer]");
      if (br) {
        S.comparees = S.comparees.filter(function (x) { return x !== br.dataset.retirer; });
        A.rendreComparaison(); A.majURL(); return;
      }
      if (e.target.closest(".x-btn-export-comp")) { A.exporterComparaison(); return; }
      if (e.target.closest(".x-btn-tout") && S.courant) {
        S.ficheComplete = !S.ficheComplete;
        A.fiche(S.courant.atmart_geo_id);
        var anc = $("#indicateurs");
        if (anc) anc.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      /* Imprimer une fiche dont la pyramide n'a pas encore été atteinte à
         l'écran produirait un PDF amputé : on l'attend, puis on imprime. */
      if (e.target.closest(".x-btn-print")) {
        if (S.courant && $("#x-pyramide") && !$("#x-pyramide").innerHTML) {
          A.remplirPyramide(S.courant).then(function () { window.print(); });
        } else window.print();
        return;
      }
      var ba = e.target.closest("[data-agg]");
      if (ba) {
        var ent = parId[ba.dataset.agg];
        var agg = agreger(ent, communesDe(ent));
        A.telecharger("atmart_" + (ent.pcode || ent.atmart_geo_id) + "_agregat.csv",
          ["atmart_geo_id", "territoire_fr", "territoire_ht", "niveau", "indicateur_id",
           "indicateur", "valeur", "unite", "annee_reference", "regle_agregation",
           "communes_couvertes"].concat(A.enTeteMeta()),
          Object.keys(agg).map(function (k) {
            return [ent.atmart_geo_id, ent.nom_fr, ent.nom_ht || "",
                    A.T(NIVEAU[ent.niveau_admin]), k,
                    libelle(k, "nom"), agg[k].valeur, A.uniteL(agg[k].unite), agg[k].annee,
                    (dico[k] || {}).regle_agregation,
                    agg[k].couvertes].concat(A.ligneMeta()); }));
        return;
      }
      if (e.target.closest(".x-vers-classement")) {
        document.querySelector('[data-onglet="classement"]').click();
        $("#x-vue-classement").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (e.target.closest("#x-pourquoi")) {
        var d = $("#x-millesimes"); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth" }); }
      }
    });

    /* Le sélecteur de produit vit dans une section réécrite à chaque rendu :
       l'écoute se fait donc sur le document, pas sur l'élément. */
    document.addEventListener("change", function (e) {
      if (!e.target || e.target.id !== "x-prix-produit" || !S.courant) return;
      S.prixProduit = e.target.value;
      A.remplirPrix(S.courant);
    });

    var selObj = $("#x-objectif");
    if (selObj) selObj.addEventListener("change", function () {
      S.objectif = selObj.value;
      if (S.courant) A.fiche(S.courant.atmart_geo_id);
    });

    sel.addEventListener("change", function () { A.classement(sel.value); A.majURL(); });
    var selNiv = $("#x-niveau");
    if (selNiv) selNiv.addEventListener("change", function () {
      S.niveauComp = selNiv.value; A.classement(sel.value); A.majURL(); });
    var selNorm = $("#x-normalisation");
    if (selNorm) selNorm.addEventListener("change", function () {
      var v = selNorm.value;
      if (!A.NORMALISATIONS[v].possible) {
        alert(A.T(A.NORMALISATIONS[v].raison));
        selNorm.value = S.normalisation; return;
      }
      S.normalisation = v; A.classement(sel.value); A.rendreComparaison(); A.majURL(); });
    function exporterClassement() {
      var l = window.__classement || [];
      var d = dico[sel.value] || {};
      var niv = S.niveauComp === "1" ? "departements" : S.niveauComp === "2" ? "arrondissements" : "communes";
      A.telecharger("atmart_" + sel.value + "_" + niv + "_" + S.normalisation + ".csv",
        ["rang", "atmart_geo_id", "pcode", "territoire_fr", "territoire_ht", "niveau",
         "indicateur_id", "indicateur",
         "valeur_affichee", "unite_affichee", "valeur_brute", "unite_brute", "annee_reference",
         "statut_valeur", "regle_agregation"].concat(A.enTeteMeta()),
        l.map(function (x, i) {
          return [i + 1, x.e.atmart_geo_id, x.e.pcode || "", x.e.nom_fr, x.e.nom_ht || "",
                  A.T(NIVEAU[x.e.niveau_admin]), sel.value, A.libelle(sel.value, "nom"),
                  x.aff, A.uniteL(x.unite), x.brut.valeur, A.uniteL(x.brut.unite), x.brut.annee,
                  x.brut.statut, d.regle_agregation || ""].concat(A.ligneMeta()); }));
    }
    $("#x-export").addEventListener("click", exporterClassement);
    document.addEventListener("click", function (e) {
      if (e.target.closest(".x-btn-export-cl")) exporterClassement();
      if (e.target.closest(".x-btn-comp-top")) {
        S.comparees = (window.__classement || []).slice(0, A.MAX_COMP)
          .map(function (x) { return x.e.atmart_geo_id; });
        A.rendreComparaison(); A.majURL();
        document.querySelector('[data-onglet="comparaison"]').click();
      }
    });

    [].forEach.call(document.querySelectorAll("[data-onglet]"), function (b) {
      b.addEventListener("click", function () {
        [].forEach.call(document.querySelectorAll("[data-onglet]"), function (x) {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-selected", x === b ? "true" : "false");
        });
        S.ongletActif = b.dataset.onglet;
        $("#x-vue-fiche").hidden = b.dataset.onglet !== "fiche";
        $("#x-vue-comparaison").hidden = b.dataset.onglet !== "comparaison";
        $("#x-vue-classement").hidden = b.dataset.onglet !== "classement";
        A.majURL();
      });
    });

    var niv = (location.search.match(/niveau=([123])/) || [])[1];
    if (niv) { S.niveauComp = niv; var sn = $("#x-niveau"); if (sn) sn.value = niv; }
    var nrm = (location.search.match(/norm=([a-z0-9]+)/) || [])[1];
    if (nrm && A.NORMALISATIONS[nrm] && A.NORMALISATIONS[nrm].possible) {
      S.normalisation = nrm; var snn = $("#x-normalisation"); if (snn) snn.value = nrm;
    }
    var ind = (location.search.match(/ind=(IND-[A-Z0-9-]+)/) || [])[1];
    if (ind && dico[ind]) sel.value = ind;
    A.classement(sel.value);
    var cmp = (location.search.match(/comparer=([A-Z0-9,\-]+)/) || [])[1];
    if (cmp) S.comparees = cmp.split(",").filter(function (x) { return parId[x]; }).slice(0, A.MAX_COMP);
    A.rendreComparaison();
    /* Un lien de comparaison doit ouvrir la comparaison, pas la fiche. */
    var ong = (location.search.match(/onglet=([a-z]+)/) || [])[1];
    if (!ong && cmp) ong = "comparaison";
    if (ong) {
      var bo = document.querySelector('[data-onglet="' + ong + '"]');
      if (bo) bo.click();
    }
    var ob = (location.search.match(/objectif=([a-z]+)/) || [])[1];
    if (A.OBJECTIFS[ob]) { S.objectif = ob; if (selObj) selObj.value = ob; }
    S.ficheComplete = /[?&]complet=1/.test(location.search);
    var id = (location.search.match(/id=([A-Z0-9-]+)/) || [])[1];
    /* Sans territoire demandé, la fiche ouverte est un exemple : on le dit. */
    S.montrerAccueil = !parId[id];
    A.fiche(parId[id] ? id : "HTC-0111");

    /* Changement de langue. L'etat de l'application — territoire courant,
       territoires compares, niveau, mode de lecture, onglet actif — vit dans
       des variables du module : il traverse le changement sans etre touche.
       On ne recharge que le dictionnaire, puis on redessine les trois vues. */
    function redessiner() {
      remplirIndicateurs();
      compteurs();
      rendreCouverture();
      A.classement(sel.value);
      A.rendreComparaison();
      if (S.courant) A.fiche(S.courant.atmart_geo_id);
      var actif = document.querySelector('[data-onglet="' + S.ongletActif + '"]');
      if (actif) actif.click();
    }
    document.addEventListener("atmart:lang", function (e) {
      var l = e.detail;
      if (window.ATM_LANGUES && window.ATM_LANGUES.indexOf(l) < 0) l = "fr";
      A.chargerLangue(l).then(redessiner);
    });
  }

  /* Une connexion instable coupe une requete sur cinq : on retente deux fois,
     en espacant, avant d'abandonner. Sans cela l'Explorateur affiche une erreur
     la ou un simple rechargement aurait suffi. */
  function charger(u, essais) {
    essais = essais === undefined ? 2 : essais;
    return fetch(u + DV).then(function (r) {
      if (!r.ok) throw new Error(u + " : " + r.status);
      return r.text();
    }).catch(function (e) {
      if (essais <= 0) throw e;
      return new Promise(function (ok) { setTimeout(ok, 500); })
        .then(function () { return charger(u, essais - 1); });
    });
  }

  /* Le registre est calculé par l'outil de découpage : une liste écrite à
     la main serait fausse au premier ajout de fonction, et fausse en silence. */
  Object.assign(A, { $, ADMIN, CFG, DIR, DV, F, NATURE_PERIODE, NIVEAU, QUALITE, REGLE, SITE, STATUT, STATUT_IND, THEME, aggEntite, agreger, annoncer, charger, communesDe, couverture, dico, enfantsDe, esc, fmt, jour, libCouverture, libFraicheur, lienParrainage, liste, nb, orgsCom, orgsSec, parId, parIndicateur, parseCSV, rang, sansAccent, situation });

  /* Les modules, dans l'ordre de leurs dépendances : i18n est une feuille
     dont tout le monde dépend, et la fiche appelle la carte.

     LES CINQ sont chargés à l'amorçage, et c'est une mesure, pas une
     facilité. Le premier écran ouvre une fiche avec sa carte, remplit le
     sélecteur d'indicateurs et dresse le classement : même « comparaison »,
     qu'on croyait derrière un onglet, est appelé par pret(). Le rendre
     paresseux demanderait de changer ce que la page montre à l'arrivée —
     un choix produit, pas une question de découpage.

     Le gain de poids attendu du chargement à la demande est donc nul ici.
     Ce que le découpage apporte reste entier : cinq fichiers séparés, deux
     chantiers qui ne se marchent plus dessus. Le vrai levier sur le premier
     chargement est ailleurs — atmart_indicateurs_communes_HT.csv pèse 1 Mo
     (57 Ko gzippés) et se charge en entier pour afficher une commune. */
  for (const m of ["i18n", "carte", "fiche", "recherche", "comparaison"]) {
    (await import("./explorateur-" + m + ".js")).default(A);
  }

  var liste = [F.terr, F.vals, F.dico].concat(F.orgs ? [F.orgs] : []);
  Promise.all(liste.map(function (u) { return charger(u); })).then(function (t) {
    S.terr = parseCSV(t[0]); S.vals = parseCSV(t[1]);
    parseCSV(t[2]).forEach(function (d) { dico[d.indicateur_id] = d; });
    if (t[3]) S.orgs = parseCSV(t[3]);
    /* Le contour est un agrement : s'il manque, la fiche s'affiche sans carte. */
    return charger(CFG.contour || DIR + "haiti_contour_simplifie.geojson")
      .then(function (t) { return JSON.parse(t); })
      .then(function (g) {
        if (g) S.contour = g.features[0].geometry.coordinates;
      })
      .catch(function () {})
      /* Les contours administratifs sont un agrément comme le contour
         national : s'ils manquent, la carte retombe sur les bulles. */
      .then(function () {
        return Promise.all([
          charger(DIR + "haiti_departements_simplifie.geojson")
            .then(function (x) { S.polyDep = JSON.parse(x).features; })
            .catch(function () { S.polyDep = null; }),
          charger(DIR + "haiti_communes_simplifie.geojson")
            .then(function (x) { S.polyCom = JSON.parse(x).features; })
            .catch(function () { S.polyCom = null; })
        ]);
      })
      .catch(function () {})
      /* La langue precede le premier rendu : sinon l'utilisateur voit un
         eclair de francais avant que sa langue ne s'applique. */
      .then(function () {
        var l = "fr";
        try { l = localStorage.getItem("atmart_lang") || "fr"; } catch (e) {}
        /* Un lien partagé dit dans quelle langue il a été écrit : il passe
           avant la préférence mémorisée du lecteur, mais après la langue de
           la page elle-même — sur /ht/, le HTML est déjà en kreyòl. */
        var lu = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
        if (lu && A.LOCALE[lu]) l = lu;
        if (window.ATM_LANG_FORCE) l = window.ATM_LANG_FORCE;   // page localisée
        /* La page peut restreindre les langues offertes : un visiteur venu
           d'une page en kreyol ne doit pas voir le moteur basculer seul
           pendant que le HTML de la page reste en francais. */
        if (window.ATM_LANGUES && window.ATM_LANGUES.indexOf(l) < 0) l = "fr";
        return A.chargerLangue(l);
      })
      .then(pret);
  }).catch(function (e) {
    /* Une panne silencieuse est pire qu'une panne visible : on trace la cause
       reelle avant de composer un message, dont la traduction pourrait echouer. */
    if (window.console) console.error("Explorateur :", e);
    $("#x-chargement").innerHTML = '<p class="x-vide">' +
      A.TF("Les données n'ont pas pu être chargées ({err}). Les fichiers restent téléchargeables depuis le {lien}.",
        { err: esc(e.message),
          lien: '<a href="' + SITE + 'datasets.html">' + A.T("catalogue") + "</a>" }) + "</p>";
  });
})();
