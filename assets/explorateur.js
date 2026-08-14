/* ===== Explorateur Haïti — Atmart Data =====
   Un seul moteur, deux éditions (window.ATM_EXPLORATEUR) :
     publique      : référentiel de base + indicateurs, depuis data/
     administrateur: référentiels complets, depuis un dossier local non publié
   Aucun compteur n'est écrit en dur : tout est compté depuis les fichiers. */
(function () {
  "use strict";

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
  var DV = "?d=2026-08-14a";
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

  var terr = [], vals = [], orgs = [], dico = {}, contour = null;
  var parId = {}, parPcode = {}, enfantsDe = {}, orgsCom = {}, orgsSec = {};
  var parIndicateur = {}, courant = null, objectif = "tout", comparees = [];
  /* Contours d'affichage des départements et des communes, chargés avec le
     contour national. Le niveau dessiné suit la fiche ; carteNiveau ne
     retient que le choix explicite du lecteur. */
  var polyDep = null, polyCom = null, carteNiveau = null;
  /* Couverture reelle : combien de communes du socle portent une valeur pour
     chaque indicateur. Comptee au demarrage, jamais ecrite en dur — c'est ce
     qui distingue « 140 communes au socle » de « 14 communes couvertes ». */
  var couverture = {}, nCommunes = 0, indBloques = [];
  var niveauComp = "3", normalisation = "total", ongletActif = "fiche";
  /* La fiche s'ouvre réduite aux indicateurs de l'usage choisi ; l'utilisateur
     déplie une fois et l'état suit dans l'URL, sinon un lien partagé rouvrirait
     replié la fiche que l'on voulait montrer entière. */
  var ficheComplete = false;
  /* Vrai tant que l'utilisateur n'a pas choisi de territoire : la fiche
     affichée est alors une démonstration, et doit le dire. */
  var montrerAccueil = false;
  var aggEntite = {};   /* agregats precalcules des departements et arrondissements */
  var aggNational = null;   /* le meme calcul, sur les 140 communes */
  var $ = function (s) { return document.querySelector(s); };

  /* ------------------------------------------------------------------ langue
     La cle de traduction est la phrase francaise elle-meme. Deux consequences
     voulues : aucun nom de cle a inventer, et une traduction absente degrade
     vers le francais lisible plutot que vers une cle technique affichee crue. */
  var LANG = "fr", DICO = {};
  var LOCALE = { fr: "fr-FR", ht: "fr-HT", en: "en-US", es: "es-ES" };
  var BASE = CFG.base || "";

  function substituer(t, vars) {
    Object.keys(vars || {}).forEach(function (k) {
      t = t.split("{" + k + "}").join(vars[k]);
    });
    return t;
  }
  function T(t) {
    if (LANG === "fr" || !t) return t;
    var v = DICO[t];
    if (v == null) return t;
    return typeof v === "string" ? v : (v.other || v.one || t);
  }
  /* Une phrase a variables reste une seule unite de traduction : le traducteur
     voit la phrase entiere et peut deplacer les variables selon sa grammaire. */
  function TF(t, vars) { return substituer(T(t), vars); }

  /* Le pluriel n'obeit pas aux memes regles partout : le francais met zero au
     singulier, l'anglais et l'espagnol au pluriel, et le creole n'inflechit pas
     apres un nombre. Une seule regle francaise cablee en dur produirait
     « 0 communes » en francais et « 1 territories » en anglais. */
  function formePlurielle(n) {
    if (LANG === "fr") return n < 2 ? "one" : "other";
    if (LANG === "ht") return "other";
    return n === 1 ? "one" : "other";
  }
  /* formes = { one: "...", other: "..." } en francais ; la cle de traduction
     est la forme « other ». Une langue peut ne fournir qu'une chaine. */
  function TN(formes, n, vars) {
    var trad = LANG === "fr" ? formes : DICO[formes.other];
    if (trad == null) trad = formes;
    if (typeof trad === "string") trad = { one: trad, other: trad };
    var f = trad[formePlurielle(n)] || trad.other || trad.one;
    return substituer(f, vars || {});
  }

  /* Un rang ne s'ecrit pas pareil partout : 1er/2e en francais, 1st/2nd en
     anglais, 1.º/2.º en espagnol, 1ye/2yem en creole. Coller « <sup>e</sup> »
     a un chiffre ne marche qu'en francais. */
  function ordinal(n) {
    if (LANG === "en") {
      var r100 = n % 100, r10 = n % 10;
      var suf = (r100 >= 11 && r100 <= 13) ? "th"
              : r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
      return n + "<sup>" + suf + "</sup>";
    }
    if (LANG === "es") return n + ".<sup>o</sup>";
    if (LANG === "ht") return n === 1 ? "1<sup>ye</sup>" : n + "<sup>yèm</sup>";
    return n === 1 ? "1<sup>er</sup>" : n + "<sup>e</sup>";
  }

  /* « de Ouest » se dit « de l'Ouest » : elision devant voyelle. C'est une
     regle francaise. Les autres langues recoivent le nom brut et composent
     leur propre tournure dans leur modele de phrase. */
  function deNom(n) {
    return /^[aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ]/.test(n) ? "de l'" + n : "de " + n;
  }
  /* Libelles du referentiel des indicateurs, dans un fichier satellite :
     le fichier d'origine reste intact pour qui l'a deja telecharge.
     Cle = indicateur|langue|champ. */
  var LIB = {}, UNITES = {}, libCharge = {};

  function chargerLibelles(l) {
    if (l === "fr" || libCharge[l]) return Promise.resolve();
    return charger(DIR + "atmart_referentiel_indicateurs_i18n.csv", 1)
      .then(function (t) {
        parseCSV(t).forEach(function (r) {
          LIB[r.indicateur_id + "|" + r.langue + "|" + r.champ] = r.valeur;
          if (r.champ === "unite") {
            var fr = (dico[r.indicateur_id] || {}).unite;
            if (fr) UNITES[fr + "|" + r.langue] = r.valeur;
          }
        });
        libCharge[l] = true;
      })
      /* Absent ou illisible : on garde le francais plutot que d'afficher des
         libelles vides. Une donnee sans nom est pire qu'une donnee en francais. */
      .catch(function () { libCharge[l] = true; });
  }

  /* Un champ du dictionnaire, dans la langue courante, francais par defaut. */
  /* Le nom d'un territoire suit la langue quand la source en fournit un :
     Pòtoprens en kreyol, Port-au-Prince ailleurs. L'anglais et l'espagnol
     n'ont pas de toponymie propre pour Haiti — ils gardent la forme
     francaise, qui est celle du referentiel officiel.
     Les identifiants et les p-codes ne changent JAMAIS : c'est par eux
     qu'on rejoint les fichiers, quelle que soit la langue affichee. */
  function nomT(e) {
    if (!e) return "";
    if (LANG === "ht" && e.nom_ht) return e.nom_ht;
    return e.nom_fr || "";
  }
  /* L'autre graphie, quand elle differe : on la montre en second pour que
     l'utilisateur reconnaisse le territoire sous ses deux noms. */
  function nomSecond(e) {
    if (!e) return "";
    var a = nomT(e), b = LANG === "ht" ? e.nom_fr : e.nom_ht;
    return b && b !== a ? b : "";
  }

  function libelle(indId, nom) {
    if (LANG !== "fr") {
      var v = LIB[indId + "|" + LANG + "|" + nom];
      if (v) return v;
    }
    return (dico[indId] || {})[nom] || "";
  }
  function uniteL(u) {
    if (LANG === "fr" || !u) return u;
    return UNITES[u + "|" + LANG] || T(u);
  }

  function chargerLangue(l) {
    LANG = LOCALE[l] ? l : "fr";
    if (LANG === "fr") { DICO = {}; return Promise.resolve(); }
    return fetch(BASE + "assets/i18n/explorateur." + LANG + ".json" + DV, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { DICO = j || {}; })
      .catch(function () { DICO = {}; })   /* dictionnaire absent : on reste en francais */
      .then(function () { return chargerLibelles(LANG); });
  }

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
    var s = (Math.round(n * 100) / 100).toLocaleString(LOCALE[LANG]);
    if (u === "%") return s + " %";
    if (!u || u === "nombre") return s;
    return s + " " + esc(uniteL(u));
  }
  /* La date suit la langue : 31/07/2026 en francais et en creole,
     7/31/2026 en anglais, 31/7/2026 en espagnol. */
  function jour(d) {
    if (!d) return "—";
    var p = d.split("-");
    if (p.length !== 3) return d;
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(LOCALE[LANG], { timeZone: "UTC" });
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

  /* Six usages plutôt que sept profils : chacun réordonne les thèmes, choisit
     les indicateurs qu'il met en premier, change le résumé et propose des
     actions différentes.

     « cles » est le seul champ éditorial de ce fichier : quels indicateurs
     répondent d'abord à cet usage. Il ne pouvait pas être calculé — aucune
     donnée ne dit qu'un urbaniste regarde la densité avant le rapport de
     masculinité — et il ne pouvait pas non plus vivre dans le dictionnaire sans
     y ajouter une matrice de 6 colonnes × 32 lignes. Il est donc ici, court et
     relisible. Tout le reste de la fiche continue d'être compté, jamais écrit.
     La vue complète, elle, n'en a pas : elle montre tout, c'est son objet. */
  var OBJECTIFS = {
    tout: {
      nom: T("Vue d'ensemble"), ordre: null,
      cles: ["IND-POP-001", "IND-GEO-001", "IND-POP-002", "IND-POP-010",
             "IND-GEO-002", "IND-EDU-001", "IND-SAN-001", "IND-MAR-001"],
      lecture: T("Les huit repères que l'on regarde en premier, quel que soit l'usage.")
    },
    planifier: {
      nom: T("Planifier les services publics"),
      ordre: ["Territoire", "Santé", "Éducation", "Marchés", "Qualité"],
      cles: ["IND-POP-001", "IND-POP-002", "IND-POP-007", "IND-POP-012",
             "IND-GEO-002", "IND-EDU-001", "IND-SAN-001"],
      lecture: T("Combien de personnes à servir, où elles vivent, et quels équipements sont recensés en face."),
      resume: function (r, s) {
        return TF(s.nAbsents > 1
          ? T("Profil administratif de {n}. {phrase} Les données disponibles couvrent {themes}. {absents} indicateurs restent à documenter sur cette commune.")
          : T("Profil administratif de {n}. {phrase} Les données disponibles couvrent {themes}. {absents} indicateur reste à documenter sur cette commune."),
          { n: esc(nomT(r)), phrase: s.phrase, themes: s.themes, absents: s.absents });
      },
      actions: [[T("Comparer aux communes voisines"), "#comparer"],
                [T("Voir ce qui reste à documenter"), "#lacunes"],
                ["Licence institutionnelle", "donnees-solutions.html#licences"]]
    },
    projet: {
      nom: T("Préparer un projet ou une intervention"),
      ordre: ["Santé", "Éducation", "Marchés", "Territoire", "Qualité"],
      cles: ["IND-POP-001", "IND-POP-003", "IND-POP-011", "IND-SAN-001",
             "IND-EDU-001", "IND-MAR-001", "IND-QUA-001"],
      lecture: T("Les publics, les services recensés, et l'état de la documentation sur laquelle reposera le diagnostic."),
      resume: function (r, s) {
        return TF("Avant d'intervenir sur {n} : {phrase} Le score de complétude vous dit d'avance sur quoi votre diagnostic reposera — et sur quoi il ne reposera pas.",
          { n: esc(nomT(r)), phrase: s.phrase });
      },
      actions: [[T("Voir ce qui reste à documenter"), "#lacunes"],
                [T("Référentiel géographique complet"), "donnees-pack-geo-haiti.html"],
                [T("Packs décisionnels"), "donnees-solutions.html#packs"]]
    },
    recherche: {
      nom: T("Réaliser une recherche"),
      ordre: ["Qualité", "Territoire", "Santé", "Éducation", "Marchés"],
      cles: ["IND-QUA-001", "IND-POP-001", "IND-POP-012", "IND-POP-013",
             "IND-GEO-001", "IND-GEO-003", "IND-SAN-003"],
      lecture: T("Les mesures dont la méthode et les limites sont écrites, et les indicateurs de qualité qui disent ce qu'elles valent."),
      resume: function (r, s) {
        return TF("Chaque valeur affichée pour {n} porte son année de référence, sa source et sa méthode de calcul — de quoi les reprendre dans une méthodologie. {phrase}",
          { n: esc(nomT(r)), phrase: s.phrase });
      },
      actions: [[T("Définitions et méthodes"), "donnees-backbone.html#indicateurs"],
                [T("Accès Campus pour un mémoire"), "donnees-campus.html"],
                [T("Registre des sources"), "data/atmart_registre_sources.csv"]]
    },
    implantation: {
      nom: T("Étudier une implantation économique"),
      ordre: ["Marchés", "Territoire", "Santé", "Éducation", "Qualité"],
      cles: ["IND-POP-001", "IND-POP-002", "IND-POP-004", "IND-MAR-001",
             "IND-GEO-001", "IND-GEO-004"],
      lecture: T("La taille du bassin, sa concentration, la population en âge de travailler et les marchés suivis."),
      resume: function (r, s) {
        return TF("Ce que la donnée publique dit du bassin de {n} : {phrase} Elle décrit une population et des équipements recensés — elle ne mesure ni la demande, ni le pouvoir d'achat, ni la concurrence.",
          { n: esc(nomT(r)), phrase: s.phrase });
      },
      actions: [[T("Comparer aux communes voisines"), "#comparer"],
                [T("Packs décisionnels"), "donnees-solutions.html#packs"],
                [T("Référentiel géographique complet"), "donnees-pack-geo-haiti.html"]]
    },
    macommune: {
      nom: "Explorer ma commune",
      ordre: ["Territoire", "Éducation", "Santé", "Marchés", "Qualité"],
      cles: ["IND-POP-001", "IND-POP-002", "IND-GEO-002", "IND-GEO-003",
             "IND-EDU-001", "IND-SAN-001", "IND-MAR-001"],
      lecture: T("Ce qui se voit depuis la commune : combien on est, sur quelle étendue, et quels services sont recensés."),
      resume: function (r, s) {
        return TF("Ce que l'on sait publiquement de {n} : {phrase} Tout ceci est libre et téléchargeable.",
          { n: esc(nomT(r)), phrase: s.phrase });
      },
      actions: [[T("Télécharger les données libres"), "datasets.html#shelf-free"],
                [T("Comment ces chiffres sont établis"), "donnees-backbone.html"]]
    }
  };

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
    if (normalisation === "total" || !normalisable(indId)) return { v: valeur, u: (dico[indId] || {}).unite };
    if (normalisation === "km2") {
      var s = nb(entite.superficie_km2);
      if (!s) return { v: null, u: "" };
      return { v: valeur / s * 100, u: "/ 100 km\u00b2" };
    }
    if (normalisation === "part") {
      if (!totalNational) return { v: null, u: "" };
      return { v: valeur / totalNational * 100, u: "%" };
    }
    if (normalisation === "habitant") {
      if (indId === "IND-POP-001") return { v: valeur, u: (dico[indId] || {}).unite };
      var pop = populationDe(entite);
      if (!pop) return { v: null, u: "" };
      return { v: valeur / pop * 10000, u: "/ 10 000 hab." };
    }
    return { v: valeur, u: (dico[indId] || {}).unite };
  }

  /* ------------------------------------------------------------- recherche */
  function chercher(q) {
    var k = sansAccent(q).trim();
    if (!k) return [];
    var exact = [], debut = [], dedans = [];
    terr.forEach(function (r) {
      var a = sansAccent(r.nom_fr), b = sansAccent(r.nom_ht),
          c = sansAccent(r.pcode), d = sansAccent(r.atmart_geo_id);
      /* Les alias sont des mots entiers (« pays », « nasyonal ») : un match
         partiel ferait remonter la fiche nationale sur « pa »… */
      if (r.alias && sansAccent(r.alias).split(" ").indexOf(k) > -1) { exact.push(r); return; }
      if (a === k || b === k || c === k || d === k) exact.push(r);
      else if (a.indexOf(k) === 0 || b.indexOf(k) === 0 || c.indexOf(k) === 0 || d.indexOf(k) === 0) debut.push(r);
      else if (a.indexOf(k) > 0 || b.indexOf(k) > 0 || c.indexOf(k) > -1 || d.indexOf(k) > -1) dedans.push(r);
    });
    var tri = function (x, y) { return x.niveau_admin - y.niveau_admin; };
    return exact.sort(tri).concat(debut.sort(tri), dedans.sort(tri)).slice(0, 30);
  }

  /* Suggestions en cas de faute : distance de Levenshtein bornée. */
  function proches(q) {
    var k = sansAccent(q).trim();
    if (k.length < 4) return [];
    function dist(a, b) {
      var m = a.length, n = b.length, prev = [], cur = [], i, j;
      if (Math.abs(m - n) > 3) return 99;
      for (j = 0; j <= n; j++) prev[j] = j;
      for (i = 1; i <= m; i++) {
        cur[0] = i;
        for (j = 1; j <= n; j++)
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur.slice();
      }
      return prev[n];
    }
    return terr.map(function (r) { return { r: r, d: dist(k, sansAccent(r.nom_fr)) }; })
      .filter(function (x) { return x.d <= 3; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 5).map(function (x) { return x.r; });
  }

  function afficherResultats(liste, q) {
    var el = $("#x-resultats");
    if (!q) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    if (!liste.length) {
      var sug = proches(q);
      el.innerHTML = '<p class="x-vide">' +
        TF("Aucun territoire ne correspond à « {q} ».", { q: esc(q) }) + "</p>" +
        (sug.length
          ? '<p class="x-vide" style="padding-top:0">' + T("Vouliez-vous dire :") + "</p>" +
            sug.map(function (r) { return carteResultat(r); }).join("")
          : '<p class="x-vide" style="padding-top:0">' +
            T("Essayez un nom de commune, un p-code (HT0121) ou un identifiant Atmart.") + "</p>");
      annoncer(sug.length
        ? TN({ one: "Aucun résultat exact. {n} suggestion proche.",
               other: "Aucun résultat exact. {n} suggestions proches." }, sug.length, { n: sug.length })
        : T("Aucun résultat."));
      return;
    }
    el.innerHTML = liste.map(carteResultat).join("");
    annoncer(TN({ one: "{n} territoire trouvé.", other: "{n} territoires trouvés." },
                liste.length, { n: liste.length }));
  }
  function carteResultat(r) {
    return '<button class="x-res" role="option" data-id="' + esc(r.atmart_geo_id) + '"><b>' +
      esc(nomT(r)) + "</b>" + (nomSecond(r) ? " <i>" + esc(nomSecond(r)) + "</i>" : "") +
      "<small>" + (T(NIVEAU[r.niveau_admin]) || esc(r.type_entite)) + " · " +
      esc(r.pcode || r.source_geo_id) + "</small></button>";
  }
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
    if (!c || !nCommunes) return null;
    return {
      court: TF("{n}/{t} communes", { n: c.avec, t: nCommunes }),
      phrase: c.avec >= nCommunes
        ? TF("les {t} communes du socle CNIGS 2018 portent une valeur.",
             { t: nCommunes })
        : TF("{n} communes sur {t} portent une valeur, soit {pct} % du socle CNIGS 2018. Les {r} autres sont documentées comme absentes, jamais comme des zéros.",
             { n: c.avec, t: nCommunes, r: nCommunes - c.avec,
               pct: Math.round(c.avec / nCommunes * 100) })
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
      return { texte: TF("Révision {quand}", { quand: p }), retard: false };
    }
    var auj = new Date().toISOString().slice(0, 10);
    return p < auj
      ? { texte: TF("Révision attendue depuis le {date}", { date: jour(p) }), retard: true }
      : { texte: TF("Prochaine révision prévue le {date}", { date: jour(p) }), retard: false };
  }

  /* Un lien « financer une donnée manquante » qui n'emporte ni l'indicateur ni
     le territoire oblige le visiteur à réécrire ce qu'il vient de lire. Le lien
     porte donc le contexte, et la page de parrainage préremplit son formulaire.
     Rien de personnel n'y transite : un nom d'indicateur et un nom de commune. */
  function lienParrainage(indId, r) {
    var q = [];
    if (indId) {
      q.push("jeu=" + encodeURIComponent(libelle(indId, "nom") || indId));
      var d = dico[indId] || {};
      if (d.dependance) q.push("src=" + encodeURIComponent(d.dependance));
      else if (d.source_primaire) q.push("src=" + encodeURIComponent(d.source_primaire));
    }
    if (r) q.push("terr=" + encodeURIComponent(nomT(r)));
    return SITE + "donnees-parrainage.html?" + q.join("&") + "#spo-form";
  }

  /* ----------------------------------------------------------------- blocs */
  function fil(r) {
    var ch = [], cur = parId[r.parent_atmart_geo_id], g = 0;
    while (cur && g++ < 6) { ch.unshift(cur); cur = parId[cur.parent_atmart_geo_id]; }
    return ch.map(function (p) {
      return '<button class="x-lien" data-id="' + esc(p.atmart_geo_id) + '">' + esc(nomT(p)) + "</button>";
    }).join(" › ") + (ch.length ? " › " : "") + "<span>" + esc(nomT(r)) + "</span>";
  }

  function situe(r) {
    var ch = [], cur = parId[r.parent_atmart_geo_id], g = 0;
    while (cur && g++ < 6) { ch.unshift(cur); cur = parId[cur.parent_atmart_geo_id]; }
    var dep = ch.filter(function (x) { return x.niveau_admin === "1"; })[0];
    var arr = ch.filter(function (x) { return x.niveau_admin === "2"; })[0];
    /* Chaque langue reçoit le nom brut ET la forme élidée française : elle
       compose sa propre tournure au lieu de recevoir « du département » collé. */
    var t = T(NIVEAU[r.niveau_admin]) || r.type_entite;
    if (dep && arr && r.niveau_admin === "3") {
      return TF("{niveau} du département {dep_de}, arrondissement {arr_de}",
        { niveau: t, dep: nomT(dep), dep_de: deNom(dep.nom_fr),
          arr: nomT(arr), arr_de: deNom(arr.nom_fr) });
    }
    if (dep) {
      return TF("{niveau} du département {dep_de}",
        { niveau: t, dep: nomT(dep), dep_de: deNom(dep.nom_fr) });
    }
    return t;
  }

  function synthese(r) {
    var m = vals.filter(function (v) { return v.pcode_commune === r.pcode; });
    var connus = m.filter(function (v) { return v.statut_valeur !== "N"; });
    var absents = m.filter(function (v) { return v.statut_valeur === "N"; });
    var themes = {}, sources = {}, annees = [];
    connus.forEach(function (v) {
      var d = dico[v.indicateur_id] || {};
      if (d.categorie && d.categorie !== "Qualité") themes[d.categorie] = 1;
      if (v.source) sources[v.source] = 1;
      if (v.annee_reference) annees.push(v.annee_reference);
    });
    var sec = (m.filter(function (v) { return v.indicateur_id === "IND-GEO-002"; })[0] || {}).valeur;
    var loc = (m.filter(function (v) { return v.indicateur_id === "IND-GEO-003"; })[0] || {}).valeur;
    var comp = (m.filter(function (v) { return v.indicateur_id === "IND-QUA-001"; })[0] || {}).valeur;
    return {
      nConnus: connus.length, nAbsents: absents.length, absents: absents.length,
      /* Ce qui reste à documenter, c'est la somme de deux choses de nature
         différente : les absences constatées sur ce territoire, et les
         indicateurs que personne ne peut encore calculer nulle part. Les
         compter séparément faisait afficher « 0 » à Port-au-Prince au-dessus
         d'un tableau qui listait cinq manques. */
      nManques: absents.length + indBloques.length,
      nBloques: indBloques.length,
      nSources: Object.keys(sources).length,
      completude: comp,
      annees: annees.length ? [Math.min.apply(null, annees), Math.max.apply(null, annees)] : null,
      themes: Object.keys(themes).map(function (t) { return T(t).toLowerCase(); }).join(", ") || T("aucun thème"),
      phrase: !sec
        ? ""
        : (loc
            ? TN({ one: "Elle compte {sec} section communale et {loc} localités référencées.",
                   other: "Elle compte {sec} sections communales et {loc} localités référencées." },
                 +sec, { sec: sec, loc: loc })
            : TN({ one: "Elle compte {sec} section communale.",
                   other: "Elle compte {sec} sections communales." }, +sec, { sec: sec }))
    };
  }

  function blocResume(r) {
    var s = synthese(r);
    /* La date de mise à jour est la plus récente des relevés, pas celle de la
       première ligne du fichier : l'ordre des lignes n'est pas une chronologie,
       et un tri de fichier ferait rajeunir ou vieillir la fiche sans raison. */
    var maj = { date_extraction: vals.reduce(function (d, v) {
      return v.date_extraction > d ? v.date_extraction : d; }, "") };
    var h = ['<div class="x-tete"><p class="x-fil">' + fil(r) + "</p>",
      "<h2>" + esc(nomT(r)) + (nomSecond(r) ?
        " <em>" + esc(nomSecond(r)) + "</em>" : "") + "</h2>",
      '<p class="x-situe">' + esc(situe(r)) + "</p>"];

    if (r.niveau_admin === "3") {
      h.push('<div class="x-actions">');
      h.push('<button class="btn btn-primary x-btn-export" data-export="' + esc(r.pcode) + '">' +
             TN({ one: "Télécharger l'indicateur de {nom} (CSV)",
                  other: "Télécharger les {n} indicateurs de {nom} (CSV)" },
                s.nConnus, { n: s.nConnus, nom: esc(nomT(r)) }) + "</button>");
      h.push('<button class="btn btn-outline x-btn-lien">' +
             T("Copier le lien de cette fiche") + "</button>");
      h.push('<a class="btn btn-outline" href="#lacunes">' +
             TF("Ce qui reste à documenter ({n})", { n: s.nManques }) + "</a>");
      h.push('<button class="btn btn-outline x-btn-comp" data-comparer="' + esc(r.atmart_geo_id) +
             '">' + T("Ajouter à la comparaison") + "</button>");
      h.push('<button class="btn btn-outline x-btn-print">' + T("Imprimer / PDF") + "</button>");
      h.push("</div>");
      /* Ligne de confiance : chaque segment est une phrase autonome, assemblée
         par un séparateur neutre. Aucune langue n'hérite de l'ordre français. */
      var seg = [
        TF("Fiche {version}", { version: esc(r.version) }),
        TN({ one: "{n} source", other: "{n} sources" }, s.nSources, { n: s.nSources })
      ];
      /* « complétude 100 % » ne disait pas complétude de quoi. Le score porte
         sur cinq dimensions du socle — pas sur les 32 indicateurs, pas sur les
         sources. Le dénominateur est nommé dans le libellé, et la méthode
         complète s'affiche au survol : elle vient du dictionnaire, pas d'ici. */
      if (s.completude) {
        seg.push('<span title="' + esc(libelle("IND-QUA-001", "methode_calcul")) + '">' +
                 TF("profil de base {pct} % des dimensions du socle",
                    { pct: s.completude }) + "</span>");
      }
      if (s.annees) seg.push(TF("données de {a} à {b}", { a: s.annees[0], b: s.annees[1] }));
      seg.push(TF("mise à jour Atmart le {date}", { date: jour(maj.date_extraction) }));
      h.push('<p class="x-confiance">' + seg.join(" · ") +
             ' · <a href="' + SITE + 'donnees-backbone.html#statuts">' + T("méthodologie") + "</a></p>");
    }
    h.push("</div>");
    return h.join("");
  }

  /* ------------------------------------------------------------- la carte
     Carte de situation en SVG, sans dépendance externe : le contour national
     simplifié du CNIGS, les centres officiels des communes, et l'entité
     sélectionnée mise en évidence. Le découpage administratif détaillé reste
     dans le Pack Géo — cette carte situe, elle ne délimite pas. */
  function anneauxDe(g) {
    if (g.type === "Polygon") return g.coordinates;
    var out = [];
    g.coordinates.forEach(function (poly) {
      poly.forEach(function (a) { out.push(a); });
    });
    return out;
  }

  /* Le département qui contient une entité, en remontant les parents. */
  function departementDe(x) {
    var cur = x, g = 0;
    while (cur && cur.niveau_admin !== "1" && g++ < 5) cur = parId[cur.parent_atmart_geo_id];
    return cur && cur.niveau_admin === "1" ? cur : null;
  }

  function blocCarte(r) {
    if (!contour) return "";
    var L = 760, H = 420, M = 14;

    /* Cadrage. À l'échelle du pays, une commune de la zone métropolitaine
       mesure treize pixels de côté : Port-au-Prince s'y confondait avec le
       département de l'Ouest, alors que son contour était bien tracé et bien
       mis en évidence. Il était trop petit pour se voir.

       Quand la fiche est une commune, on cadre donc sur son département. Les
       communes voisines restent visibles et cliquables ; la bascule
       « Départements » ramène à la vue du pays. */
    var cadreSur = null;
    if (r.niveau_admin === "3" && polyDep && (carteNiveau || "3") === "3") {
      var dep = departementDe(r);
      if (dep) {
        var fd = polyDep.filter(function (f) {
          return f.properties.atmart_geo_id === dep.atmart_geo_id; });
        if (fd.length) cadreSur = fd[0].geometry;
      }
    }

    var xs = [], ys = [];
    if (cadreSur) {
      anneauxDe(cadreSur).forEach(function (a) {
        a.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      });
    } else {
      contour.forEach(function (poly) {
        poly[0].forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      });
    }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var kx = Math.cos((y0 + y1) / 2 * Math.PI / 180);   // correction méridienne
    var w = (x1 - x0) * kx, h = y1 - y0;
    var ech = Math.min((L - 2 * M) / w, (H - 2 * M) / h);
    var dx = (L - w * ech) / 2, dy = (H - h * ech) / 2;
    function px(lon) { return dx + (lon - x0) * kx * ech; }
    function py(lat) { return dy + (y1 - lat) * ech; }

    var chemins = contour.map(function (poly) {
      return "M" + poly[0].map(function (p) {
        return px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1); }).join("L") + "Z";
    }).join(" ");

    /* quelles communes mettre en avant : celles du même parent */
    var famille = {};
    if (r.niveau_admin === "3") {
      (enfantsDe[r.parent_atmart_geo_id] || []).forEach(function (x) { famille[x.atmart_geo_id] = 1; });
    } else {
      terr.forEach(function (x) {
        if (x.niveau_admin !== "3") return;
        var cur = x, g = 0;
        while (cur && g++ < 5) {
          if (cur.atmart_geo_id === r.atmart_geo_id) { famille[x.atmart_geo_id] = 1; return; }
          cur = parId[cur.parent_atmart_geo_id];
        }
      });
    }

    /* Le niveau dessiné suit la fiche : on regarde un département en
       départements, une commune en communes. Le lecteur peut en décider
       autrement, et son choix tient jusqu'à ce qu'il en change. */
    var auto = r.niveau_admin === "3" ? "3" : "1";
    var niv = carteNiveau || auto;
    var couche = niv === "3" ? polyCom : polyDep;
    var fond = niv === "3" ? polyDep : polyCom;

    function trace(g) {
      return anneauxDe(g).map(function (a) {
        return "M" + a.map(function (p) {
          return px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1); }).join("L") + "Z";
      }).join(" ");
    }
    /* Un territoire est mis en avant s'il est celui de la fiche, une de ses
       communes, ou l'un de ses parents — un département reste visible quand on
       regarde l'une de ses communes. */
    function rang(id) {
      if (id === r.atmart_geo_id) return "sel";
      if (famille[id]) return "pro";
      var cur = r, g = 0;
      while (cur && g++ < 5) {
        if (cur.atmart_geo_id === id) return "pro";
        cur = parId[cur.parent_atmart_geo_id];
      }
      return "";
    }

    var formes = "";
    if (fond) {
      formes += fond.map(function (f) {
        return '<path class="x-fond" d="' + trace(f.geometry) + '" />';
      }).join("");
    }
    if (couche) {
      formes += couche.map(function (f) {
        var id = f.properties.atmart_geo_id, k = rang(id);
        return '<path class="x-zone' + (k ? " x-zone-" + k : "") + '" d="' +
          trace(f.geometry) + '" data-id="' + esc(id) + '" tabindex="0" role="button">' +
          "<title>" + esc(f.properties.nom_fr) + "</title></path>";
      }).join("");
    }

    /* Les bulles restent pour ce qui n'a pas de contour : le repli quand les
       fichiers ne se chargent pas, et les niveaux fins — section communale,
       localité — dont la géométrie n'est pas publiée. */
    var pts = terr.filter(function (x) {
      if (!x.latitude || !x.longitude) return false;
      if (!couche) return x.niveau_admin === "3";
      /* L'arrondissement est un regroupement administratif, pas un lieu : une
         bulle posee sur son chef-lieu ferait croire a une ville de plus. Les
         bulles ne restent donc que pour les niveaux fins — section communale,
         localite — dont la geometrie n'est pas publiee. */
      return x.niveau_admin !== "1" && x.niveau_admin !== "2" && x.niveau_admin !== "3";
    }).map(function (x) {
      var sel = x.atmart_geo_id === r.atmart_geo_id;
      var pro = !sel && famille[x.atmart_geo_id];
      return '<circle class="x-pt' + (sel ? " x-pt-sel" : pro ? " x-pt-pro" : "") + '" r="' +
        (sel ? 7 : pro ? 4.5 : 3) + '" cx="' + px(+x.longitude).toFixed(1) + '" cy="' +
        py(+x.latitude).toFixed(1) + '" data-id="' + esc(x.atmart_geo_id) + '"><title>' +
        esc(nomT(x)) + "</title></circle>";
    }).join("");

    var cible = r.latitude ? r : null;
    var repere = cible ?
      '<circle class="x-pt-halo" cx="' + px(+cible.longitude).toFixed(1) + '" cy="' +
      py(+cible.latitude).toFixed(1) + '" r="15" />' : "";

    /* la famille contient l'entité elle-même : on ne la compte pas deux fois */
    var nFam = Object.keys(famille).filter(function (k) { return k !== r.atmart_geo_id; }).length;
    var commune = r.niveau_admin === "3";
    var libFam = commune
      ? TN({ one: "{n} autre commune du même arrondissement",
             other: "{n} autres communes du même arrondissement" }, nFam, { n: nFam })
      : TN({ one: "sa commune", other: "ses {n} communes" }, nFam, { n: nFam });
    /* Texte alternatif de la carte : une phrase entière par cas, jamais un
       assemblage — un lecteur d'écran lit une phrase, pas des morceaux. */
    var alt = commune
      ? TF("{nom} est située sur la carte d'Haïti, avec {famille}.",
           { nom: nomT(r), famille: libFam, n: nFam })
      : TF("{nom} sur la carte d'Haïti : {famille} sont mises en évidence.",
           { nom: nomT(r), famille: libFam, n: nFam });

    var bascule = (polyDep && polyCom) ?
      '<div class="x-carte-niv" role="group" aria-label="' +
      esc(T("Niveau affiché sur la carte")) + '">' +
      ["1", "3"].map(function (n) {
        return '<button type="button" class="x-carte-btn' + (n === niv ? " actif" : "") +
          '" data-niveau="' + n + '" aria-pressed="' + (n === niv) + '">' +
          esc(n === "1" ? T("Départements") : T("Communes")) + "</button>";
      }).join("") + "</div>" : "";

    return '<div class="x-carte"><svg viewBox="0 0 ' + L + " " + H + '" role="img" ' +
      'aria-label="' + esc(alt) + '" preserveAspectRatio="xMidYMid meet">' +
      '<path class="x-terre" d="' + chemins + '" />' + formes + repere + pts + "</svg>" +
      bascule +
      '<p class="x-legende">' +
      '<span class="x-l-sel"></span> ' + esc(nomT(r)) + "  " +
      '<span class="x-l-pro"></span> ' + esc(libFam) +
      ' — <a href="' + SITE + 'donnees-pack-geo-haiti.html">' +
      T("géométrie complète, au mètre") + "</a></p>" +
      '<p class="x-note">' +
      (cadreSur
        ? TF("Carte cadrée sur {dep} : à l'échelle du pays, une commune de cette taille serait illisible. Cliquez un territoire pour ouvrir sa fiche.",
             { dep: nomT(departementDe(r) || r) })
        : T("Contours d'affichage du CNIGS, simplifiés pour la lecture à l'échelle du pays. Cliquez un territoire pour ouvrir sa fiche.")) +
      "</p></div>";
  }

  /* ------------------------------------------------------ pyramide des âges
     Le fichier de structure par âge pèse 1,1 Mo — plus que tous les autres
     réunis. Il n'est donc pas chargé au démarrage mais à la première fiche
     ouverte, et une seule fois : la plupart des visites ne le demandent
     jamais. S'il manque — hors connexion, cache incomplet — la fiche s'affiche
     sans pyramide et le dit, comme elle s'affiche sans carte quand le contour
     manque. Les grands groupes d'âge, eux, restent dans les indicateurs. */
  var pyrIdx = null, pyrPromesse = null, pyrTranches = [], pyrMeta = {};

  function chargerPyramide() {
    if (pyrPromesse) return pyrPromesse;
    pyrPromesse = charger(F.pyr, 1).then(function (t) {
      var idx = {}, tr = {};
      parseCSV(t).forEach(function (l) {
        var rg = +l.rang_tranche;
        if (!rg || !l.pcode_commune) return;
        tr[rg] = { rang: rg, min: +l.borne_min,
                   max: l.borne_max === "" ? null : +l.borne_max };
        var c = idx[l.pcode_commune] || (idx[l.pcode_commune] = { F: [], M: [], T: [] });
        if (c[l.sexe]) c[l.sexe][rg - 1] = nb(l.effectif) || 0;
        pyrMeta = { annee: l.annee_reference, source: l.source, statut: l.statut_valeur,
                    qualite: l.niveau_qualite, extraction: l.date_extraction,
                    version: l.version };
      });
      pyrTranches = Object.keys(tr).map(Number).sort(function (a, b) { return a - b; })
                          .map(function (k) { return tr[k]; });
      pyrIdx = pyrTranches.length ? idx : null;
      return pyrIdx;
    }).catch(function () { pyrIdx = null; return null; });
    return pyrPromesse;
  }

  /* « 0-4 », « 80+ » : des chiffres, lisibles dans les quatre langues. */
  function libTranche(t) { return t.max === null ? t.min + "+" : t.min + "-" + t.max; }

  /* Une commune lit ses propres lignes ; un arrondissement ou un département
     somme celles de ses communes — la structure par âge s'additionne, c'est la
     règle « somme » du dictionnaire, pas une moyenne. */
  function pyramideDe(r) {
    if (!pyrIdx) return null;
    var communes = r.niveau_admin === "3" ? [r] : communesDe(r);
    var n = pyrTranches.length, out = { F: [], M: [], T: [], communes: 0 }, i;
    for (i = 0; i < n; i++) { out.F[i] = 0; out.M[i] = 0; out.T[i] = 0; }
    communes.forEach(function (c) {
      var d = pyrIdx[c.pcode];
      if (!d) return;
      out.communes++;
      for (var j = 0; j < n; j++) {
        out.F[j] += d.F[j] || 0; out.M[j] += d.M[j] || 0; out.T[j] += d.T[j] || 0;
      }
    });
    if (!out.communes) return null;
    out.total = out.T.reduce(function (a, b) { return a + b; }, 0);
    if (!out.total) return null;
    /* Les trois grands groupes se déduisent des bornes, jamais d'un rang écrit
       en dur : si la source changeait de découpage, le calcul suivrait. */
    out.jeunes = out.actifs = out.aines = 0;
    pyrTranches.forEach(function (t, k) {
      if (t.max !== null && t.max < 15) out.jeunes += out.T[k];
      else if (t.min >= 65) out.aines += out.T[k];
      else out.actifs += out.T[k];
    });
    out.femmes = out.F.reduce(function (a, b) { return a + b; }, 0);
    out.hommes = out.M.reduce(function (a, b) { return a + b; }, 0);
    return out;
  }

  function pct(x, total) { return Math.round(x / total * 1000) / 10; }

  /* Échelle « ronde » : un axe qui s'arrête à 6,37 % ne se lit pas. */
  function pasAxe(max) {
    return max <= 2 ? 0.5 : max <= 5 ? 1 : max <= 12 ? 2 : 5;
  }

  function svgPyramide(p, r) {
    /* MARGE : la graduation extrême est centrée sur le bord de la grille — sans
       marge, la moitié de « 6 % » sort du cadre, des deux côtés.
       Sur un écran étroit, le même dessin réduit de moitié rendrait les 17
       intitulés illisibles : le cadre devient vertical, et seules les
       graduations extrêmes restent écrites. */
    var etroit = (window.innerWidth || 1024) < 720;
    var L = etroit ? 420 : 760, H = etroit ? 520 : 430;
    var HAUT = 26, BAS = 40, GOUT = etroit ? 50 : 54, MARGE = etroit ? 20 : 26;
    var n = pyrTranches.length, i;
    var hb = (H - HAUT - BAS) / n, demi = (L - GOUT - 2 * MARGE) / 2;
    var gauche = MARGE + demi, droite = MARGE + demi + GOUT;
    var max = 0;
    for (i = 0; i < n; i++) {
      max = Math.max(max, p.F[i] / p.total * 100, p.M[i] / p.total * 100);
    }
    var pas = pasAxe(max), axe = Math.ceil(max / pas) * pas || pas;
    var lg = function (v) { return v / axe * demi; };
    var y = function (k) { return HAUT + (n - 1 - k) * hb; };   // 0-4 en bas
    var out = [], t;

    /* grille et graduations, symétriques */
    for (var g = 0; g <= axe + 1e-9; g += pas) {
      var d = lg(g);
      out.push('<line class="x-pyr-grille" x1="' + (gauche - d).toFixed(1) + '" x2="' +
        (gauche - d).toFixed(1) + '" y1="' + HAUT + '" y2="' + (H - BAS) + '" />');
      out.push('<line class="x-pyr-grille" x1="' + (droite + d).toFixed(1) + '" x2="' +
        (droite + d).toFixed(1) + '" y1="' + HAUT + '" y2="' + (H - BAS) + '" />');
      if (etroit && g > 0 && Math.abs(g - axe) > 1e-9) continue;
      var et = fmt(g, "%");
      out.push('<text class="x-pyr-axe" x="' + (gauche - d).toFixed(1) + '" y="' + (H - BAS + 15) +
        '" text-anchor="middle">' + esc(et) + "</text>");
      out.push('<text class="x-pyr-axe" x="' + (droite + d).toFixed(1) + '" y="' +
        (H - BAS + 15) + '" text-anchor="middle">' + esc(et) + "</text>");
    }

    for (i = 0; i < n; i++) {
      t = pyrTranches[i];
      var hf = Math.max(hb - 2.5, 2);
      [["F", p.F[i]], ["M", p.M[i]]].forEach(function (s) {
        var w = lg(s[1] / p.total * 100), femme = s[0] === "F";
        out.push('<rect class="x-pyr-' + (femme ? "f" : "m") + '" x="' +
          (femme ? gauche - w : droite).toFixed(1) + '" y="' + y(i).toFixed(1) +
          '" width="' + Math.max(w, 0.4).toFixed(1) + '" height="' + hf.toFixed(1) +
          '" rx="1.5"><title>' + esc(TF(
            femme ? "{tranche} ans, femmes : {n} ({pct} %)"
                  : "{tranche} ans, hommes : {n} ({pct} %)",
            { tranche: libTranche(t), n: fmt(s[1]), pct: fmt(pct(s[1], p.total)) })) +
          "</title></rect>");
      });
      out.push('<text class="x-pyr-lab" x="' + ((gauche + droite) / 2).toFixed(1) + '" y="' +
        (y(i) + hb / 2 + 0.5).toFixed(1) + '" text-anchor="middle" dominant-baseline="middle">' +
        esc(libTranche(t)) + "</text>");
    }

    out.push('<text class="x-pyr-tete" x="' + (gauche - lg(axe)).toFixed(1) + '" y="' + (HAUT - 10) +
      '" text-anchor="start">' + esc(T("Femmes")) + "</text>");
    out.push('<text class="x-pyr-tete" x="' + (droite + lg(axe)).toFixed(1) + '" y="' +
      (HAUT - 10) + '" text-anchor="end">' + esc(T("Hommes")) + "</text>");

    var alt = TF("Pyramide des âges {de} : {n} habitants répartis en {b} tranches d'âge de cinq ans, femmes à gauche et hommes à droite. {jeunes} % ont moins de 15 ans, {aines} % ont 65 ans ou plus. Les effectifs exacts sont dans le tableau qui suit.",
      /* Le nom brut ET sa forme élidée française : « de l'Ouest » est une règle
         française, les autres langues composent leur propre tournure. */
      { nom: nomT(r), de: deNom(nomT(r)), n: fmt(p.total), b: n,
        jeunes: fmt(pct(p.jeunes, p.total)), aines: fmt(pct(p.aines, p.total)) });
    return '<svg class="' + (etroit ? "x-pyr-etroit" : "x-pyr-large") +
      '" viewBox="0 0 ' + L + " " + H + '" role="img" aria-label="' + esc(alt) +
      '" preserveAspectRatio="xMidYMid meet">' + out.join("") + "</svg>";
  }

  function tablePyramide(p) {
    /* `scope` sur chaque en-tête : sans lui, un lecteur d'écran annonce une
       cellule sans dire de quelle colonne ni de quelle ligne elle vient. */
    var h = ['<div class="x-tabwrap"><table class="x-tab x-pyr-tab"><thead><tr><th scope="col">' +
             T("Tranche d'âge") + '</th><th scope="col">' + T("Femmes") +
             '</th><th scope="col">' + T("Hommes") + '</th><th scope="col">' +
             T("Ensemble") + '</th><th scope="col">' + T("Part") +
             "</th></tr></thead><tbody>"];
    for (var i = pyrTranches.length - 1; i >= 0; i--) {
      h.push('<tr><th scope="row">' + esc(libTranche(pyrTranches[i])) + "</th><td>" + fmt(p.F[i]) +
        "</td><td>" + fmt(p.M[i]) + "</td><td>" + fmt(p.T[i]) + "</td><td>" +
        fmt(pct(p.T[i], p.total), "%") + "</td></tr>");
    }
    h.push('<tr><th scope="row">' + T("Ensemble") + "</th><td>" + fmt(p.femmes) + "</td><td>" +
      fmt(p.hommes) + "</td><td>" + fmt(p.total) + "</td><td>" + fmt(100, "%") +
      "</td></tr></tbody></table></div>");
    return h.join("");
  }

  function blocPyramide(r) {
    /* Le conteneur est posé tout de suite, rempli quand le fichier arrive :
       la fiche ne doit pas attendre 1,1 Mo pour s'afficher. */
    return '<div id="x-pyramide" class="x-pyr"></div>';
  }

  /* Le déclencheur n'est pas l'ouverture de la fiche mais son approche à
     l'écran. L'Explorateur ouvre toujours une fiche au démarrage — Port-au-
     Prince par défaut : charger 1,1 Mo à ce moment-là ferait payer le
     graphique à tout visiteur, y compris à celui qui vient pour le classement
     et ne descendra jamais jusqu'ici. */
  function observerPyramide(r) { aLApproche("#x-pyramide", remplirPyramide, r); }

  /* Deux sections lourdes suivent la même règle : le fichier ne part que si la
     section approche de l'écran. La pyramide pèse 7 140 lignes à analyser, la
     série de prix 14 140 — sur un téléphone bas de gamme, c'est ce coût-là qui
     se voit, pas le téléchargement. */
  function aLApproche(selecteur, remplir, r) {
    var b = $(selecteur);
    if (!b) return;
    if (!window.IntersectionObserver) return remplir(r);
    var io = new IntersectionObserver(function (entrees) {
      if (!entrees.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      remplir(r);
    }, { rootMargin: "300px" });
    io.observe(b);
  }

  function remplirPyramide(r) {
    var boite = $("#x-pyramide");
    if (!boite) return Promise.resolve();
    return chargerPyramide().then(function () {
      /* L'utilisateur a pu ouvrir une autre fiche entre-temps. */
      if (!courant || courant.atmart_geo_id !== r.atmart_geo_id) return;
      var b = $("#x-pyramide");
      if (!b) return;
      var p = pyramideDe(r);
      if (!p) {
        b.innerHTML = '<h3 class="x-h3" id="pyramide">' + T("Pyramide des âges") +
          '</h3><p class="x-note" style="margin-top:0">' +
          T("La structure par âge n'a pas pu être chargée — connexion interrompue, ou fichier absent du cache hors connexion. Les grands groupes d'âge restent affichés dans les indicateurs ci-dessus.") +
          "</p>";
        return;
      }
      var lect = [
        TF("{pct} % ont moins de 15 ans", { pct: fmt(pct(p.jeunes, p.total)) }),
        TF("{pct} % ont 65 ans ou plus", { pct: fmt(pct(p.aines, p.total)) }),
        TF("{n} dépendants pour 100 personnes de 15 à 64 ans",
           { n: fmt(Math.round((p.jeunes + p.aines) / p.actifs * 1000) / 10) }),
        TF("{n} hommes pour 100 femmes",
           { n: fmt(Math.round(p.hommes / p.femmes * 1000) / 10) })
      ];
      var couv = r.niveau_admin === "3" ? "" :
        TN({ one: "somme sur {n} commune", other: "somme sur {n} communes" },
           p.communes, { n: p.communes });
      b.innerHTML = '<h3 class="x-h3" id="pyramide">' + T("Pyramide des âges") + "</h3>" +
        '<p class="x-note" style="margin-top:0">' +
        T("Femmes à gauche, hommes à droite ; chaque barre est la part de la population totale du territoire. Les effectifs exacts sont sous le graphique.") +
        (couv ? " " + esc(couv) + "." : "") + "</p>" +
        '<div class="x-pyr-fig">' + svgPyramide(p, r) + "</div>" +
        '<p class="x-legende"><span class="x-l-f"></span> ' + T("Femmes") +
        '  <span class="x-l-m"></span> ' + T("Hommes") + "</p>" +
        '<p class="x-pyr-lect">' + lect.map(esc).join(" · ") + "</p>" +
        '<details class="x-tech"><summary>' + T("Voir les effectifs") + "</summary>" +
        tablePyramide(p) + '<p class="x-note">' + TF(
          "{src} · millésime {an} · {statut} · relevé par Atmart le {date}",
          { src: esc(pyrMeta.source || ""), an: esc(pyrMeta.annee || ""),
            statut: esc(T(STATUT[pyrMeta.statut]) || pyrMeta.statut || ""),
            date: jour(pyrMeta.extraction) }) + "</p></details>" +
        '<p class="x-note">' +
        T("Projection, pas un dénombrement : la structure par âge d'une seule commune se lit avec prudence — le rapport de masculinité à 0-4 ans, stable au niveau national, varie de 89 à 116 selon la commune.") +
        ' <button class="x-lien x-btn-pyr">' + T("Télécharger cette pyramide (CSV)") +
        "</button></p>";
    });
  }

  /* --------------------------------------------------- résumé décisionnel
     Trois constats, trois manques, l'état de la documentation, les
     avertissements, les actions. Tout est calculé sur les valeurs publiées, et
     rien n'y est interprété : un rang est un rang, pas une performance. Dire
     qu'une commune est première pour la densité est un fait ; dire qu'elle est
     « en difficulté » serait une lecture que la donnée ne porte pas. */

  /* Ce qui distingue un territoire : les indicateurs où son rang est le plus
     extrême, une seule fois par famille — sans quoi les onze indicateurs
     démographiques rempliraient les trois lignes à eux seuls. Un rang établi
     sur moins de vingt communes ne distingue rien : il est ignoré. */
  function traitsDistinctifs(r) {
    if (r.niveau_admin !== "3") return [];
    var cand = [];
    Object.keys(parIndicateur).forEach(function (k) {
      var d = dico[k] || {};
      if (d.categorie === "Qualité") return;
      var rg = rang(k, r.pcode), v = valeurBrute(r, k);
      if (!rg || !v || v.valeur === null || rg.total < 20) return;
      cand.push({ id: k, rg: rg, v: v, famille: k.slice(0, 7),
                  ecart: Math.max(rg.pct, 100 - rg.pct) });
    });
    /* À écart égal — être premier sur deux indicateurs arrive souvent — on
       garde celui dont le classement porte sur le plus de communes : un rang
       sur 140 dit davantage qu'un rang sur 14. */
    cand.sort(function (a, b) {
      return (b.ecart - a.ecart) || (b.rg.total - a.rg.total);
    });
    var vues = {}, tri = [];
    cand.forEach(function (t) {
      if (vues[t.famille] || tri.length >= 3) return;
      vues[t.famille] = 1;
      tri.push(t);
    });
    return tri;
  }

  /* Ce que la donnée ne dit pas : d'abord les absences constatées sur ce
     territoire, avec leur motif tel qu'il est écrit dans la donnée ; puis, s'il
     en reste de la place, les indicateurs que personne ne peut encore calculer
     nulle part. */
  function lacunesLisibles(r) {
    var out = [];
    vals.forEach(function (v) {
      if (v.pcode_commune !== r.pcode || v.statut_valeur !== "N") return;
      out.push({ id: v.indicateur_id,
                 nom: libelle(v.indicateur_id, "nom") || v.indicateur_id,
                 motif: v.methode });
    });
    indBloques.forEach(function (k) {
      out.push({ id: k, nom: libelle(k, "nom") || k,
                 motif: (T(STATUT_IND[dico[k].statut]) || dico[k].statut) +
                        (dico[k].dependance ? " — " + dico[k].dependance : "") });
    });
    return out;
  }

  function avertissements(r) {
    var m = vals.filter(function (v) {
      return v.pcode_commune === r.pcode && v.statut_valeur !== "N"; });
    var a = [], statuts = {}, annees = [], partiels = 0;
    m.forEach(function (v) {
      statuts[v.statut_valeur] = 1;
      if (v.annee_reference) annees.push(+v.annee_reference);
      var c = couverture[v.indicateur_id];
      if (c && c.avec < nCommunes) partiels++;
    });
    if (!statuts.O) {
      a.push(T("Aucune valeur n'est observée directement : tout est agrégé par Atmart ou estimé à partir d'une projection."));
    }
    if (annees.length && Math.max.apply(null, annees) - Math.min.apply(null, annees) > 1) {
      a.push(TF("Les millésimes vont de {a} à {b} : cette fiche n'est pas un instantané.",
        { a: Math.min.apply(null, annees), b: Math.max.apply(null, annees) }));
    }
    if (partiels) {
      /* Le compte porte sur les indicateurs documentés de ce territoire, pas
         sur les seules cartes visibles : la phrase doit le dire ainsi. */
      a.push(TN({ one: "{n} indicateur documenté ici ne couvre pas tout le pays : son rang se lit sur les communes documentées, pas sur 140.",
                  other: "{n} indicateurs documentés ici ne couvrent pas tout le pays : leur rang se lit sur les communes documentées, pas sur 140." },
        partiels, { n: partiels }));
    }
    return a;
  }

  /* --------------------------------------------------- prix des marchés
     La première série temporelle du produit. Elle se lit un produit à la fois :
     du maïs à 60 gourdes la marmite et de l'huile à 500 gourdes le gallon sur
     le même axe ne se compareraient pas, et tout indexer sur 100 masquerait le
     prix réel. Un produit, son unité, ses gourdes. */
  var prixIdx = null, prixPromesse = null, prixMeta = {}, prixProduit = null;
  var FENETRE = 60;   /* mois affichés : cinq ans ; la série entière est en CSV */

  function chargerPrix() {
    if (prixPromesse) return prixPromesse;
    prixPromesse = charger(F.prix, 1).then(function (txt) {
      var idx = {};
      parseCSV(txt).forEach(function (l) {
        if (!l.pcode_commune || !l.prix) return;
        var c = idx[l.pcode_commune] || (idx[l.pcode_commune] = {});
        var k = l.produit + " · " + l.marche;
        var s = c[k] || (c[k] = { produit: l.produit, marche: l.marche,
                                  unite: l.unite_mesure, points: [] });
        s.points.push({ mois: l.mois, prix: nb(l.prix) });
        prixMeta = { source: l.source, statut: l.statut_valeur,
                     extraction: l.date_extraction };
      });
      Object.keys(idx).forEach(function (pc) {
        Object.keys(idx[pc]).forEach(function (k) {
          idx[pc][k].points.sort(function (a, b) { return a.mois < b.mois ? -1 : 1; });
        });
      });
      prixIdx = idx;
      return idx;
    }).catch(function () { prixIdx = null; return null; });
    return prixPromesse;
  }

  /* Un axe qui s'arrête à 137,4 gourdes ne se lit pas : on arrondit vers le haut
     à un pas rond. Et l'axe part de zéro — tronquer l'origine d'un graphique de
     prix exagère visuellement la moindre variation. */
  function pasRond(max) {
    var p = Math.pow(10, Math.floor(Math.log(max) / Math.LN10) - 1);
    var c = [1, 2, 2.5, 5, 10].map(function (m) { return m * p; })
              .filter(function (x) { return max / x <= 8; });
    return c.length ? c[0] : p * 10;
  }

  function svgSerie(s, etroit) {
    var pts = s.points.slice(-FENETRE);
    var L = etroit ? 420 : 760, H = etroit ? 260 : 300;
    var G = etroit ? 48 : 56, BAS = 28, HAUT = 14;
    var max = Math.max.apply(null, pts.map(function (p) { return p.prix; }));
    var pas = pasRond(max), axe = Math.ceil(max / pas) * pas;
    var x = function (i) { return G + i * (L - G - 10) / Math.max(pts.length - 1, 1); };
    var y = function (v) { return HAUT + (1 - v / axe) * (H - HAUT - BAS); };
    var out = [], g;
    for (g = 0; g <= axe + 1e-9; g += pas) {
      out.push('<line class="x-pyr-grille" x1="' + G + '" x2="' + (L - 10) +
        '" y1="' + y(g).toFixed(1) + '" y2="' + y(g).toFixed(1) + '" />');
      out.push('<text class="x-pyr-axe" x="' + (G - 6) + '" y="' + (y(g) + 4).toFixed(1) +
        '" text-anchor="end">' + esc(fmt(g)) + "</text>");
    }
    /* Une étiquette par année — mais pas deux collées : une série qui commence
       en septembre place 2019 et 2020 à quatre mois d'écart, illisibles côte à
       côte sur un écran étroit. */
    var an = "", dernierX = -1e9, ecart = etroit ? 46 : 58;
    pts.forEach(function (p, i) {
      if (p.mois.slice(0, 4) === an) return;
      an = p.mois.slice(0, 4);
      if (x(i) - dernierX < ecart) return;
      dernierX = x(i);
      out.push('<text class="x-pyr-axe" x="' + x(i).toFixed(1) + '" y="' + (H - 8) +
        '" text-anchor="middle">' + an + "</text>");
    });
    out.push('<path class="x-serie" d="M' + pts.map(function (p, i) {
      return x(i).toFixed(1) + " " + y(p.prix).toFixed(1); }).join("L") + '" />');
    pts.forEach(function (p, i) {
      out.push('<circle class="x-serie-pt" cx="' + x(i).toFixed(1) + '" cy="' +
        y(p.prix).toFixed(1) + '" r="' + (etroit ? 3.4 : 2.6) + '"><title>' +
        esc(p.mois + " · " + fmt(p.prix) + " HTG / " + s.unite) + "</title></circle>");
    });
    var dernier = pts[pts.length - 1], premier = pts[0];
    var alt = TF("Prix de {produit} au marché de {marche}, de {debut} à {fin} : {n} relevés mensuels, de {min} à {max} gourdes par {unite}. Dernier relevé connu, {dernier} gourdes.",
      { produit: s.produit, marche: s.marche, debut: premier.mois, fin: dernier.mois,
        n: pts.length, unite: s.unite,
        min: fmt(Math.min.apply(null, pts.map(function (p) { return p.prix; }))),
        max: fmt(max), dernier: fmt(dernier.prix) });
    return '<svg class="' + (etroit ? "x-pyr-etroit" : "x-pyr-large") +
      '" viewBox="0 0 ' + L + " " + H + '" role="img" aria-label="' + esc(alt) +
      '" preserveAspectRatio="xMidYMid meet">' + out.join("") + "</svg>";
  }

  function blocPrix(r) { return '<div id="x-prix" class="x-pyr"></div>'; }

  function remplirPrix(r) {
    if (!$("#x-prix")) return Promise.resolve();
    return chargerPrix().then(function () {
      if (!courant || courant.atmart_geo_id !== r.atmart_geo_id) return;
      var b = $("#x-prix");
      if (!b) return;
      var com = prixIdx && prixIdx[r.pcode];
      /* Pas de série ici : la commune n'est pas sur le réseau du PAM. Inutile de
         le répéter — l'absence est déjà documentée dans « ce qui reste à
         documenter », avec son motif. */
      if (!com) { b.innerHTML = ""; return; }
      var cles = Object.keys(com).sort(function (a, b2) {
        return com[b2].points.length - com[a].points.length; });
      if (cles.indexOf(prixProduit) < 0) prixProduit = cles[0];
      var s = com[prixProduit];
      var pts = s.points.slice(-FENETRE);
      var opts = cles.map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === prixProduit ? " selected" : "") +
               ">" + esc(com[k].produit + " — " + com[k].marche) +
               " (" + com[k].points.length + ")</option>";
      }).join("");
      b.innerHTML = '<h3 class="x-h3" id="prix">' + T("Prix sur le marché") + "</h3>" +
        '<p class="x-note" style="margin-top:0">' +
        T("La première série mensuelle du backbone. Un produit à la fois, dans son unité et en gourdes courantes : des prix d'unités différentes sur un même axe ne se compareraient pas.") +
        "</p>" +
        '<div class="x-adapter"><label for="x-prix-produit">' + T("Produit suivi") +
        '</label><select id="x-prix-produit">' + opts + "</select></div>" +
        '<div class="x-pyr-fig">' + svgSerie(s, (window.innerWidth || 1024) < 720) + "</div>" +
        '<p class="x-pyr-lect">' + esc(TF(
          "{n} relevés affichés, de {debut} à {fin} · dernier prix connu {prix} gourdes la {unite} · {total} relevés dans la série complète",
          { n: pts.length, debut: pts[0].mois, fin: pts[pts.length - 1].mois,
            prix: fmt(pts[pts.length - 1].prix), unite: s.unite,
            total: s.points.length })) + "</p>" +
        '<p class="x-note">' +
        T("Prix de détail nominaux en gourdes, non déflatés : une partie de la hausse visible est de l'inflation. Le PAM relève sur un marché urbain principal par département — ce ne sont pas des prix ruraux.") +
        ' <a href="data/atmart_prix_marches_HT.csv" download>' +
        T("Série complète (CSV)") + "</a></p>";
    });
  }

  /* -------------------------------------------------- repères nationaux
     La fiche du pays porte ce que l'État publie au niveau national et que
     personne ne peut ventiler par territoire : le budget exécuté (SRC-024).
     Chargé à la demande comme la pyramide — la plupart des visites ne
     l'ouvrent jamais. S'il manque, la fiche s'affiche sans lui et le dit. */
  var natLignes = null, natPromesse = null;

  function chargerNat() {
    if (natPromesse) return natPromesse;
    natPromesse = charger(DIR + "atmart_indicateurs_national_HT.csv", 1)
      .then(function (t) { natLignes = parseCSV(t); return natLignes; })
      .catch(function () { natLignes = null; return null; });
    return natPromesse;
  }

  function blocNat() { return '<div id="x-nat" class="x-pyr"></div>'; }

  function remplirNat() {
    var el = $("#x-nat");
    if (!el) return;
    chargerNat().then(function (lignes) {
      if (!lignes || !lignes.length) {
        el.innerHTML = '<p class="x-note">' +
          T("Les repères nationaux n'ont pas pu être chargés — la fiche reste lisible sans eux.") + "</p>";
        return;
      }
      var h = ['<h3 class="x-h3">' + T("Repères nationaux — finances publiques") + "</h3>"];
      h.push('<div class="x-mesures">' + lignes.map(function (l) {
        return '<details class="x-mesure"><summary><b>' + fmt(nb(l.valeur_htg), "HTG") +
          "</b><span>" + esc(l.libelle) + '</span><small class="x-mill">' +
          TF("Exercice {ex}", { ex: esc(l.exercice) }) + " · " + esc(l.couverture_periode) +
          "</small></summary>" +
          '<div class="x-detail">' +
          "<p><b>" + T("Par habitant.") + "</b> " +
          TF("{v} HTG sur la période — le dénominateur est une projection de population ({pop}) : un ordre de grandeur, pas une mesure.",
             { v: fmt(nb(l.valeur_par_habitant_htg), ""), pop: esc(l.population_source) }) + "</p>" +
          "<p><b>" + T("Concept.") + "</b> " + esc(l.concept) + "</p>" +
          "<p><b>" + T("Source.") + "</b> " + esc(l.source_id) + " — " + esc(l.document) + " · " +
          TF("extrait le {date}", { date: jour(l.date_extraction) }) + "</p>" +
          (l.note ? '<p class="x-limite"><b>' + T("Limites.") + "</b> " + esc(l.note) + "</p>" : "") +
          "</div></details>";
      }).join("") + "</div>");
      h.push('<p class="x-note">' +
        T("Le budget de l'État n'est publié qu'au niveau national, par ministère : aucune répartition par département ou commune n'existe à ce jour. Le jour où le MEF la publiera, elle apparaîtra ici, territoire par territoire — l'afficher avant serait l'inventer.") +
        ' <a href="' + DIR + 'atmart_indicateurs_national_HT.csv" download>' +
        T("Télécharger le CSV des repères nationaux") + "</a> · " +
        '<a href="https://budget.gouv.ht/" rel="noopener">budget.gouv.ht</a></p>');
      el.innerHTML = h.join("");
    });
  }

  /* ------------------------------------------- services et organisations
     Trois annuaires publiés le 14/08/2026, chargés à l'approche (≈ 1 Mo à
     trois) et indexés par p-code de commune :
       - professionnels du droit foncier (SRC-025, classe C — compilation web
         non recoupée avec le registre MJSP : la fiabilité s'affiche par fiche) ;
       - présence 3W OCHA (SRC-026, CC BY — présence humanitaire déclarée,
         pas un recensement de toutes les organisations) ;
       - registre légal des ONG MPCE (SRC-027 — zones déclarées en texte libre).
     Une commune sans ligne n'est pas une commune sans services : chaque
     section vide le dit avec la couverture réelle de sa source. */
  var svcIdx = null, svcPromesse = null;

  function chargerServices() {
    if (svcPromesse) return svcPromesse;
    svcPromesse = Promise.all([
      charger(DIR + "atmart_annuaire_professionnels_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_presence_organisations_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_registre_ong_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_infrastructures_communes_HT.csv", 1).catch(function () { return null; })
    ]).then(function (t) {
      if (!t[0] && !t[1] && !t[2] && !t[3]) { svcIdx = null; return null; }
      svcIdx = { pro: {}, orgs: {}, ong: {}, infra: {} };
      (t[3] ? parseCSV(t[3]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (svcIdx.infra[l.pcode_commune] = svcIdx.infra[l.pcode_commune] || []).push(l);
      });
      (t[0] ? parseCSV(t[0]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (svcIdx.pro[l.pcode_commune] = svcIdx.pro[l.pcode_commune] || []).push(l);
      });
      (t[1] ? parseCSV(t[1]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (svcIdx.orgs[l.pcode_commune] = svcIdx.orgs[l.pcode_commune] || []).push(l);
      });
      (t[2] ? parseCSV(t[2]) : []).forEach(function (l) {
        String(l.pcodes_communes || "").split(";").forEach(function (p) {
          p = p.trim();
          if (p) (svcIdx.ong[p] = svcIdx.ong[p] || []).push(l);
        });
      });
      return svcIdx;
    });
    return svcPromesse;
  }

  function blocServices(r) {
    return r.niveau_admin === "3" ? '<div id="x-services" class="x-pyr"></div>' : "";
  }

  function sectionServices(titre, corps, note) {
    return '<details class="x-mesure"><summary><b>' + titre + "</b></summary>" +
      '<div class="x-detail">' + corps +
      (note ? '<p class="x-limite">' + note + "</p>" : "") + "</div></details>";
  }

  function remplirServices(r) {
    var el = $("#x-services");
    if (!el) return;
    chargerServices().then(function (ix) {
      if (!ix) {
        el.innerHTML = '<p class="x-note">' +
          T("Les annuaires de services n'ont pas pu être chargés — la fiche reste lisible sans eux.") + "</p>";
        return;
      }
      var pro = ix.pro[r.pcode] || [], decl = ix.orgs[r.pcode] || [], ong = ix.ong[r.pcode] || [];
      /* 3W : une organisation apparaît une fois, avec ses secteurs réunis. */
      var parOrg = {};
      decl.forEach(function (l) {
        var o = parOrg[l.acronyme] || (parOrg[l.acronyme] = { l: l, secteurs: {} });
        if (l.secteur) o.secteurs[l.secteur] = 1;
      });
      var orgs = Object.keys(parOrg).map(function (k) { return parOrg[k]; });
      var h = ['<h3 class="x-h3">' +
               TF("Services et organisations — {nom}", { nom: esc(nomT(r)) }) + "</h3>",
               '<div class="x-mesures">'];

      var corpsPro = pro.length
        ? '<div class="x-tabwrap"><table class="x-tab"><thead><tr><th scope="col">' +
          T("Nom") + '</th><th scope="col">' + T("Profession") + '</th><th scope="col">' +
          T("Contact") + '</th><th scope="col">' + T("Fiabilité de la fiche") + "</th></tr></thead><tbody>" +
          pro.map(function (p) {
            return "<tr><td>" + esc(p.nom) + "</td><td>" + esc(p.sous_categorie) + "</td><td>" +
              esc([p.adresse, p.telephones, p.courriel].filter(Boolean).join(" · ") || "—") +
              "</td><td>" + esc(p.fiabilite_source || "—") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : "<p>" + T("Aucun professionnel recensé ici dans la compilation — qui couvre environ la moitié des quelque 1 500 notaires et arpenteurs du pays.") + "</p>";
      h.push(sectionServices(
        TN({ one: "{n} notaire ou arpenteur recensé",
             other: "{n} notaires et arpenteurs recensés" }, pro.length, { n: pro.length }),
        corpsPro,
        T("Compilation de sources web (août 2026), non recoupée avec le registre officiel du MJSP, qui n'est pas publié. La fiabilité affichée est celle de chaque fiche — vérifiez avant tout acte.")));

      var corpsOrg = orgs.length
        ? '<div class="x-tabwrap"><table class="x-tab"><thead><tr><th scope="col">' +
          T("Organisation") + '</th><th scope="col">' + T("Type") + '</th><th scope="col">' +
          T("Secteurs ici") + "</th></tr></thead><tbody>" +
          orgs.map(function (o) {
            return "<tr><td>" + esc(o.l.nom) + (o.l.acronyme && o.l.acronyme !== o.l.nom ?
              " <code>" + esc(o.l.acronyme) + "</code>" : "") + "</td><td>" +
              esc(o.l.type_organisation || "—") + "</td><td>" +
              esc(Object.keys(o.secteurs).join(", ") || "—") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : "<p>" + T("Aucune présence déclarée aux clusters dans cette commune au dernier relevé.") + "</p>";
      h.push(sectionServices(
        TN({ one: "{n} organisation présente (3W OCHA, juin 2026)",
             other: "{n} organisations présentes (3W OCHA, juin 2026)" },
           orgs.length, { n: orgs.length }),
        corpsOrg,
        T("Le 3W recense la présence humanitaire et de développement déclarée aux clusters — pas toutes les organisations du pays. Licence CC BY, attribution OCHA Haïti.")));

      var MAX_ONG = 40;
      var corpsOng = ong.length
        ? '<div class="x-puces">' + ong.slice(0, MAX_ONG).map(function (o) {
            return '<span class="x-puce">' + esc(o.sigle || o.nom) + "</span>";
          }).join("") + "</div>" +
          (ong.length > MAX_ONG
            ? '<p class="x-note">' + TF("{n} autres — la liste complète est dans le CSV.",
                { n: ong.length - MAX_ONG }) + "</p>" : "")
        : "<p>" + T("Aucune ONG du registre ne déclare nommément cette commune — beaucoup ne déclarent que leur département.") + "</p>";
      h.push(sectionServices(
        TN({ one: "{n} ONG du registre légal déclarant cette commune",
             other: "{n} ONG du registre légal déclarant cette commune" },
           ong.length, { n: ong.length }),
        corpsOng,
        T("Registre MPCE/UCAONG capturé le 14/08/2026. Les zones d'intervention y sont du texte libre : seuls les noms reconnus sans ambiguïté sont rattachés.")));

      /* -------- infrastructures : comptages par sources ouvertes (v39) */
      var infra = ix.infra[r.pcode] || [];
      var parFam = {};
      infra.forEach(function (l) {
        (parFam[l.famille] = parFam[l.famille] || []).push(l);
      });
      var FAMILLES = [
        ["eau_wpdx", "Points d'eau (WPdx)", "Relevés de terrain Haiti Outreach et partenaires (CC BY-SA) — couverture concentrée dans le Nord et le Centre : un zéro ailleurs dit l'absence de relevé, pas l'absence d'eau."],
        ["eau_osm", "Eau potable (OSM)", "Points « eau potable » d'OpenStreetMap (ODbL) — cartographie contributive, complète nulle part."],
        ["carburant", "Stations-service (OSM)", "Objets « fuel » d'OpenStreetMap (ODbL, extrait HOT du 06/08/2026)."],
        ["finance", "Banques et transferts (OSM)", "Banques, guichets, agences de transfert et bureaux de change cartographiés dans OpenStreetMap (ODbL)."],
        ["routes", "Routes (OSM)", "Longueurs par type, chaque tronçon affecté à la commune de son point médian — ordre de grandeur, pas un cadastre (~100 m de tolérance aux limites)."],
        ["lieux_habites", "Lieux habités (OSM)", "Villes, bourgs, villages, hameaux et habitats isolés typés dans OpenStreetMap — le référentiel CNIGS du socle reste la source des localités officielles."],
        ["electricite", "Électricité (OSM)", "L'OSM haïtien ne recense que 74 objets électriques dans tout le pays (14/08/2026) : ce comptage dit surtout ce qui n'est pas cartographié. Aucune carte officielle ouverte du réseau EDH n'existe."]
      ];
      var corpsInfra = FAMILLES.map(function (fdef) {
        var lgs = parFam[fdef[0]];
        if (!lgs) return "";
        var morceaux = lgs.map(function (l) {
          return esc(l.sous_type) + " : " + fmt(nb(l.valeur), l.unite === "km" ? "km" : "");
        }).join(" · ");
        return "<p><b>" + T(fdef[1]) + ".</b> " + morceaux +
               ' <span class="x-mill">— ' + T(fdef[2]) + "</span></p>";
      }).filter(Boolean).join("");
      h.push(sectionServices(
        infra.length
          ? T("Infrastructures — comptages par sources ouvertes")
          : T("Infrastructures — aucun objet affecté à cette commune"),
        corpsInfra || "<p>" +
          T("Aucun objet des sources ouvertes (OSM, WPdx) n'est affecté à cette commune — cela mesure la cartographie, pas le terrain.") + "</p>",
        T("Comptages, pas inventaires officiels : OpenStreetMap est contributif et inégal, WPdx suit ses contributeurs. Affectation par coordonnées aux polygones officiels COD-AB, tolérance ~100 m aux limites.")));

      h.push("</div>");
      h.push('<p class="x-note">' +
        T("Trois annuaires, trois niveaux de confiance — chaque section porte le sien.") + " " +
        '<a href="' + DIR + 'atmart_annuaire_professionnels_HT.csv" download>' + T("Professionnels (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_presence_organisations_HT.csv" download>' + T("Présence 3W (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_registre_ong_HT.csv" download>' + T("ONG du registre (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_infrastructures_communes_HT.csv" download>' + T("Infrastructures (CSV)") + "</a></p>");
      el.innerHTML = h.join("");
    });
  }

  function blocObjectif(r) {
    if (ADMIN || r.niveau_admin !== "3") return "";
    var o = OBJECTIFS[objectif] || {};
    var s = synthese(r), h = [];
    var traits = traitsDistinctifs(r), manques = lacunesLisibles(r), av = avertissements(r);

    h.push('<div class="x-objectif x-decision"><p class="x-theme">' +
           esc(T(o.nom) || "") + "</p>");
    if (o.resume) h.push("<p>" + o.resume(r, s) + "</p>");

    h.push('<div class="x-dec-cols">');
    if (traits.length) {
      h.push('<div><p class="x-dec-t">' + T("Ce qui situe ce territoire") + "</p><ul>" +
        traits.map(function (t) {
          return "<li><b>" + esc(libelle(t.id, "nom") || t.id) + "</b> " +
            esc(fmt(t.v.valeur, t.v.unite)) + " <small>" +
            TF("{rang} sur {total} communes documentées",
               { rang: ordinal(t.rg.rang), total: t.rg.total }) + "</small></li>";
        }).join("") + "</ul></div>");
    }
    if (manques.length) {
      h.push('<div><p class="x-dec-t">' + T("Ce que la donnée ne dit pas encore") +
        "</p><ul>" + manques.slice(0, 3).map(function (l) {
          return "<li><b>" + esc(l.nom) + "</b> <small>" + esc(l.motif) + "</small></li>";
        }).join("") +
        (manques.length > 3
          ? '<li class="x-dec-plus"><a href="#lacunes">' +
            TF("et {n} autres", { n: manques.length - 3 }) + "</a></li>"
          : "") + "</ul></div>");
    }
    h.push("</div>");

    var etat = [TF("{n} indicateurs documentés sur {t} au dictionnaire",
                   { n: s.nConnus, t: s.nConnus + s.nManques })];
    if (s.annees) etat.push(TF("données de {a} à {b}", { a: s.annees[0], b: s.annees[1] }));
    h.push('<p class="x-dec-etat">' + etat.join(" · ") + "</p>");
    if (av.length) {
      h.push('<ul class="x-dec-avert">' + av.map(function (t) {
        return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>");
    }

    /* Les actions de l'usage choisi, plus les deux qui valent pour tous. */
    var actions = (o.actions || []).concat([
      [T("Ce qui reste à documenter"), "#lacunes"],
      [T("Financer une donnée manquante"),
       lienParrainage((manques[0] || {}).id, r)]]);
    var vues = {};
    h.push('<div class="x-actions x-actions-sec">' + actions.filter(function (a) {
      if (vues[a[1]]) return false;
      vues[a[1]] = 1;
      return true;
    }).map(function (a) {
      var cible = a[1];
      if (cible.charAt(0) !== "#" && cible.indexOf("data/") !== 0) cible = SITE + cible;
      return '<a class="btn btn-outline" href="' + cible + '">' + esc(T(a[0])) +
             (cible.charAt(0) === "#" ? "" : " →") + "</a>";
    }).join("") + "</div></div>");
    return h.join("");
  }

  /* Première visite : l'Explorateur ouvre une fiche d'exemple. Sans un mot pour
     le dire, l'utilisateur croit lire son territoire. */
  function blocAccueil(r) {
    var n = {};
    terr.forEach(function (t) { n[t.niveau_admin] = (n[t.niveau_admin] || 0) + 1; });
    return '<div class="x-accueil"><p class="x-accueil-vp">' +
      T("Chaque territoire d'Haïti a ici sa fiche : les chiffres documentés avec leur source, leur millésime et leur méthode — et, à côté, ce qui n'est pas documenté, dit comme tel.") +
      '</p><p class="x-note">' +
      TF("Trois niveaux : {dep} départements, {arr} arrondissements, {com} communes. Comparez-en deux à quatre, ou classez-les toutes, par les onglets ci-dessus.",
         { dep: n["1"] || 0, arr: n["2"] || 0, com: n["3"] || 0 }) +
      '</p><p class="x-accueil-ex">' +
      TF("Ci-dessous, {nom} en exemple — cherchez votre territoire dans la barre de recherche.",
         { nom: esc(nomT(r)) }) + "</p></div>";
  }

  function blocIndicateurs(r) {
    var m = vals.filter(function (v) { return v.pcode_commune === r.pcode; });
    if (!m.length) return "";
    var connus = m.filter(function (v) { return v.statut_valeur !== "N"; });
    var o = OBJECTIFS[objectif] || {};

    /* Vingt-sept cartes d'un coup, personne ne les lit : la fiche s'ouvre sur
       les indicateurs que l'usage choisi met en premier, et le reste est à un
       clic. Si l'usage ne retient rien de documenté ici — une commune sans
       école ni centre de santé recensés, par exemple — on montre tout plutôt
       qu'une fiche vide. */
    var retenus = connus, masques = 0;
    if (o.cles && !ficheComplete) {
      var garde = {};
      o.cles.forEach(function (k) { garde[k] = 1; });
      var reduits = connus.filter(function (v) { return garde[v.indicateur_id]; });
      if (reduits.length) { masques = connus.length - reduits.length; retenus = reduits; }
    }

    var groupes = {};
    retenus.forEach(function (v) {
      var d = dico[v.indicateur_id] || {};
      (groupes[d.categorie || "Autres"] = groupes[d.categorie || "Autres"] || []).push([v, d]);
    });
    var ordre = o.ordre || ["Territoire", "Santé", "Éducation", "Marchés", "Qualité"];
    var cles = ordre.filter(function (c) { return groupes[c]; })
                    .concat(Object.keys(groupes).filter(function (c) { return ordre.indexOf(c) < 0; }));
    var h = ['<h3 class="x-h3" id="indicateurs">' +
             (masques ? TF("Indicateurs documentés — {n} sur {t}",
                           { n: retenus.length, t: connus.length })
                      : TF("Indicateurs documentés — {t}", { t: connus.length })) + "</h3>",
             '<p class="x-note" style="margin-top:0">' +
             (o.lecture ? esc(T(o.lecture)) + " " : "") +
             T("Chaque chiffre porte son année de référence, sa source et son statut. Dépliez une carte pour la définition et la méthode.") +
             "</p>"];
    cles.forEach(function (cat) {
      h.push('<p class="x-theme">' + (T(THEME[cat]) || esc(cat)) + "</p>");
      h.push('<div class="x-mesures">' + groupes[cat].map(function (p) {
        var v = p[0], d = p[1], rg = rang(v.indicateur_id, r.pcode);
        var couv = libCouverture(v.indicateur_id), fraich = libFraicheur(d);
        var situ = situation(r, v.indicateur_id, nb(v.valeur));
        return '<details class="x-mesure"><summary>' +
          "<b>" + fmt(v.valeur, v.unite) + "</b>" +
          "<span>" + esc(libelle(v.indicateur_id, "nom") || v.indicateur_id) + "</span>" +
          '<small class="x-mill">' +
          (v.annee_reference ? TF("Millésime {an}", { an: esc(v.annee_reference) }) + " · " : "") +
          esc((d.source_primaire || v.source).split(" — ")[0]) +
          (couv ? " · " + esc(couv.court) : "") + "</small>" +
          (rg ? '<small class="x-rang">' +
                TF("{rang} sur {total} communes documentées",
                   { rang: ordinal(rg.rang), total: rg.total }) + "</small>" : "") + "</summary>" +
          '<div class="x-detail">' +
          (d.definition ? "<p><b>" + T("Définition.") + "</b> " +
            esc(libelle(v.indicateur_id, "definition")) + "</p>" : "") +
          (d.methode_calcul ? "<p><b>" + T("Méthode.") + "</b> " +
            esc(libelle(v.indicateur_id, "methode_calcul")) + "</p>" : "") +
          /* La couverture est la première question à poser à un indicateur :
             une valeur juste sur 14 communes ne dit rien des 126 autres. */
          (couv ? '<p class="x-couv"><b>' + T("Couverture.") + "</b> " +
            esc(couv.phrase) + "</p>" : "") +
          "<p><b>" + T("Statut.") + "</b> " + esc(T(STATUT[v.statut_valeur]) || v.statut_valeur) + " · " +
          esc(T(QUALITE[v.niveau_qualite]) || v.niveau_qualite) +
          (d.niveau_territorial_min ? " · " +
            TF("niveau minimal : {niv}", { niv: esc(T(d.niveau_territorial_min) || d.niveau_territorial_min) }) : "") +
          (d.regle_agregation ? " · " +
            TF("agrégation : {regle}", { regle: esc(T(REGLE[d.regle_agregation]) || d.regle_agregation) }) : "") +
          (v.periode ? " · " + TF("période {p}", { p: esc(v.periode) }) : "") + "</p>" +
          /* Le millésime et sa nature, puis l'échéance de révision : trois
             informations que le dictionnaire porte et que la fiche taisait. */
          (v.annee_reference && NATURE_PERIODE[d.nature_periode]
            ? "<p><b>" + T("Millésime.") + "</b> " +
              TF("{an} — {nature}.", { an: esc(v.annee_reference),
                 nature: esc(T(NATURE_PERIODE[d.nature_periode])) }) +
              (fraich ? ' <span class="' + (fraich.retard ? "x-perime" : "") + '">' +
                        esc(fraich.texte) + ".</span>" : "") + "</p>"
            : "") +
          (situ ? "<p><b>" + T("Situation.") + "</b> " + situ + "</p>" : "") +
          (d.comparabilite ? "<p><b>" + T("Comparabilité.") + "</b> " +
            esc(libelle(v.indicateur_id, "comparabilite")) + "</p>" : "") +
          "<p><b>" + T("Source.") + "</b> " +
          (v.date_source
            ? TF("{src}, publiée le {date}", { src: esc(v.source), date: jour(v.date_source) })
            : esc(v.source)) + " · " +
          TF("relevée par Atmart le {date}", { date: jour(v.date_extraction) }) + "</p>" +
          (d.limites_connues ? '<p class="x-limite"><b>' + T("Limites.") + "</b> " +
            esc(libelle(v.indicateur_id, "limites_connues")) + "</p>" : "") +
          (d.sens_interpretation ? "<p><b>" + T("Lecture.") + "</b> " +
            esc(libelle(v.indicateur_id, "sens_interpretation")) + "</p>" : "") +
          "</div></details>";
      }).join("") + "</div>");
    });
    if (masques) {
      h.push('<p class="x-note"><button class="btn btn-outline x-btn-tout">' +
             TF("Voir tous les indicateurs ({t})", { t: connus.length }) +
             "</button></p>");
    } else if (ficheComplete && o.cles) {
      h.push('<p class="x-note"><button class="btn btn-outline x-btn-tout">' +
             TF("Revenir aux {n} indicateurs de cette vue", { n: o.cles.length }) +
             "</button></p>");
    }
    return h.join("");
  }

  function blocLacunes(r) {
    var m = vals.filter(function (v) { return v.pcode_commune === r.pcode; });
    var absents = m.filter(function (v) { return v.statut_valeur === "N"; });
    /* Même liste que celle comptée par le bouton « Ce qui reste à documenter » :
       deux calculs séparés finiraient par diverger. */
    var bloques = indBloques;
    var h = ['<h3 class="x-h3" id="lacunes">' + T("Ce qui reste à documenter") + "</h3>"];
    h.push('<p class="x-note" style="margin-top:0">' +
           T("Une case vide n'est pas un zéro. Chaque ligne indique pourquoi la donnée manque et ce qui la débloquerait.") +
           "</p>");
    h.push('<div class="x-tabwrap"><table class="x-tab x-lacunes"><thead><tr><th scope="col">' +
           T("Indicateur") + '</th><th scope="col">' + T("À quoi il sert") + '</th><th scope="col">' +
           T("Pourquoi il manque") + '</th><th scope="col">' + T("Ce qui le débloquerait") +
           "</th></tr></thead><tbody>");
    absents.forEach(function (v) {
      var d = dico[v.indicateur_id] || {};
      h.push("<tr><td><b>" + esc(libelle(v.indicateur_id, "nom") || v.indicateur_id) +
        "</b></td><td>" +
        esc(libelle(v.indicateur_id, "sens_interpretation") ||
            libelle(v.indicateur_id, "definition") || "—") + "</td><td>" + esc(v.methode) +
        "</td><td>" + TF("Compléter le registre national — {lien}",
          { lien: '<a href="' + esc(lienParrainage(v.indicateur_id, r)) + '">' +
                  T("parrainable") + "</a>" }) +
        "</td></tr>");
    });
    bloques.forEach(function (k) {
      var d = dico[k];
      h.push("<tr><td><b>" + esc(libelle(k, "nom")) + "</b></td><td>" +
        esc(libelle(k, "sens_interpretation") || libelle(k, "definition")) +
        "</td><td>" + esc(T(STATUT_IND[d.statut] || d.statut)) + " — " + esc(d.dependance) +
        '</td><td><a href="' + esc(lienParrainage(k, r)) + '">' +
        T("Financer la source manquante") + "</a></td></tr>");
    });
    if (!absents.length && !bloques.length) {
      h.push("<tr><td colspan=4>" + T("Aucune lacune connue.") + "</td></tr>");
    }
    h.push("</tbody></table></div>");
    h.push('<p class="x-note">' + TF(
      "Vous disposez d'une source pour l'une de ces lignes ? {lien} — elle sera créditée au registre des sources.",
      { lien: '<a href="mailto:sales@atmart.ltd?subject=Source%20pour%20un%20indicateur%20manquant">' +
              T("Signalez-la") + "</a>" }) + "</p>");
    return h.join("");
  }

  function blocComparer(r) {
    if (r.niveau_admin !== "3") return "";
    var voisins = [];
    var parent = parId[r.parent_atmart_geo_id];
    if (parent) voisins = (enfantsDe[parent.atmart_geo_id] || []).filter(function (x) {
      return x.atmart_geo_id !== r.atmart_geo_id; });
    var h = ['<h3 class="x-h3" id="comparer">' + T("Comparer") + "</h3>"];
    if (voisins.length) {
      h.push('<p class="x-note" style="margin-top:0">' +
             TF("Les autres communes de l'arrondissement {arr_de} :",
                { arr: esc(nomT(parent)), arr_de: deNom(esc(parent.nom_fr)) }) + "</p>");
      h.push('<div class="x-puces">' + voisins.map(function (v) {
        return '<button class="x-puce" data-id="' + esc(v.atmart_geo_id) + '">' + esc(nomT(v)) + "</button>";
      }).join("") + "</div>");
    }
    var nCom = terr.filter(function (x) { return x.niveau_admin === "3"; }).length;
    h.push('<p class="x-note">' + TF(
      "Le {lien} permet de situer n'importe quel territoire sur un indicateur, et d'exporter le tableau.",
      { lien: '<button class="x-lien x-vers-classement">' +
              TF("classement des {n} communes", { n: nCom }) + "</button>" }) + "</p>");
    return h.join("");
  }

  function blocTechnique(r) {
    var l = [[T("Code officiel (p-code OCHA)"), r.pcode || "—"],
             [T("Identifiant Atmart"), r.atmart_geo_id],
             [T("Version du référentiel"), r.version],
             [T("Découpage en vigueur depuis"), jour(r.date_validite_debut)],
             [T("Statut de la valeur"), (T(STATUT[r.statut_valeur]) || r.statut_valeur) + " (" + r.statut_valeur + ")"],
             [T("Niveau de qualité"), (T(QUALITE[r.niveau_qualite]) || r.niveau_qualite) + " (" + r.niveau_qualite + ")"],
             [T("Source"), r.date_source
               ? TF("{src}, publiée le {date}", { src: r.source, date: jour(r.date_source) })
               : r.source],
             [T("Géométrie"), ADMIN ? T("disponible dans le Pack Géo") : T("non incluse dans l'édition publique")]];
    if (r.latitude) l.push([T("Centre (WGS84)"), (+r.latitude).toFixed(5) + ", " + (+r.longitude).toFixed(5)]);
    if (r.methode) l.push([T("Méthode"), r.methode]);
    return '<details class="x-tech"><summary>' + T("Informations techniques") + "</summary>" +
      '<p class="x-note">' + T("Deux identifiants coexistent : le p-code est le code officiel OCHA/CNIGS, utilisé par les acteurs humanitaires ; l'identifiant Atmart ne change jamais, même si la source renumérote, ce qui permet de suivre une entité dans le temps.") + "</p>" +
      '<table class="x-tab">' + l.map(function (x) {
        return '<tr><th scope="row">' + esc(x[0]) + "</th><td>" + esc(x[1]) + "</td></tr>"; }).join("") +
      "</table></details>";
  }

  function blocOrganisations(r) {
    if (!ADMIN) return "";
    var liste = (r.niveau_admin === "3" ? orgsCom[r.pcode] : orgsSec[r.pcode]) || [];
    if (!liste.length) {
      return '<h3 class="x-h3">' + T("Organisations recensées") + '</h3><p class="x-note">' +
             T("Aucune.") + "</p>";
    }
    var parCat = {};
    liste.forEach(function (o) { (parCat[o.categorie] = parCat[o.categorie] || []).push(o); });
    var h = ['<h3 class="x-h3">' +
             TF("Organisations recensées — {n}", { n: liste.length }) + "</h3>"];
    Object.keys(parCat).forEach(function (cat) {
      var g = parCat[cat];
      h.push('<p class="x-theme">' + (T(THEME[cat]) || esc(cat)) + " — " + g.length + "</p>");
      h.push('<div class="x-tabwrap"><table class="x-tab x-orgs"><thead><tr><th scope="col">' +
             T("Nom") + '</th><th scope="col">' + T("Type") + '</th><th scope="col">' + T("Statut") + '</th><th scope="col">' +
             T("Géo") + '</th><th scope="col">' + T("Identifiant") + "</th></tr></thead><tbody>");
      g.slice(0, 60).forEach(function (o) {
        h.push("<tr><td>" + esc(o.nom) + "</td><td>" + esc(o.sous_categorie) + "</td><td>" +
          (esc(o.statut) || "—") + "</td><td>" + (o.geocode === "Oui" ? "✓" : "—") +
          "</td><td><code>" + esc(o.atmart_org_id) + "</code></td></tr>");
      });
      h.push("</tbody></table></div>");
      if (g.length > 60) {
        h.push('<p class="x-note">' + TN({ one: "{n} autre non affichée.",
          other: "{n} autres non affichées." }, g.length - 60, { n: g.length - 60 }) + "</p>");
      }
    });
    return h.join("");
  }

  function blocEnfants(r) {
    var enf = enfantsDe[r.atmart_geo_id] || [];
    if (!enf.length) return "";
    /* Le titre est une phrase complète par niveau : « 20 communes » ne se
       fabrique pas en collant un nombre et un mot, le créole intercale. */
    var titre = {
      "0": { one: "{n} département", other: "{n} départements" },
      "1": { one: "{n} arrondissement", other: "{n} arrondissements" },
      "2": { one: "{n} commune", other: "{n} communes" },
      "3": { one: "{n} section communale", other: "{n} sections communales" },
      "4": { one: "{n} localité", other: "{n} localités" }
    }[r.niveau_admin] || { one: "{n} entité", other: "{n} entités" };
    var h = ['<h3 class="x-h3">' + TN(titre, enf.length, { n: enf.length }) + "</h3>",
             '<div class="x-puces">' + enf.slice(0, 120).map(function (e) {
               return '<button class="x-puce" data-id="' + esc(e.atmart_geo_id) + '">' + esc(nomT(e)) + "</button>";
             }).join("") + "</div>"];
    if (enf.length > 120) {
      h.push('<p class="x-note">' + TF("{n} autres — affinez par la recherche.",
        { n: enf.length - 120 }) + "</p>");
    }
    return h.join("");
  }

  function blocVerrou(r) {
    if (ADMIN || r.niveau_admin !== "3") return "";
    return '<h3 class="x-h3">' + T("Aller plus bas que la commune") +
      '</h3><div class="x-verrou"><div><p>' +
      T("Les sections communales, les localités et quartiers et les polygones existent dans le référentiel, mais l'édition publique s'arrête à la commune. Ils sont livrés avec le Pack Géo Haïti.") +
      "</p><p>" +
      T("Les écoles, centres de santé et marchés nommés sont identifiés et rattachés à leur territoire ; leur couverture reste partielle, ils seront ouverts quand les registres nationaux seront complets.") +
      '</p></div><a class="btn btn-primary" href="' + SITE + 'donnees-pack-geo-haiti.html">' +
      T("Voir le Pack Géo") + "</a></div>";
  }

  /* Agregation : la regle vient du dictionnaire, plus d'une liste ecrite ici.
     Un pourcentage se recalcule sur les totaux ; le moyenner entre communes
     donnerait le meme poids a une commune de 3 000 habitants qu'a la capitale. */

  /* Deux ratios ne se recalculent pas sur la meme echelle : un pourcentage et
     « pour 100 km² » se multiplient par 100, une densite au km² par 1. Le
     dictionnaire porte ce facteur depuis v1.2026.08. S'il vient d'un fichier
     anterieur — un cache hors connexion, par exemple — on le relit dans le
     denominateur de l'unite plutot que de rendre un ordre de grandeur faux. */
  function facteurRatio(d) {
    var f = nb(d.facteur_ratio);
    if (f) return f;
    if (d.unite === "%") return 100;
    var chiffres = String(d.unite || "").split("/")[1] || "";
    return +chiffres.replace(/[^\d]/g, "") || 1;
  }

  function communesDe(r) {
    var out = [];
    terr.forEach(function (x) {
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
    vals.forEach(function (v) {
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
        note = T("valeur officielle de l'entité");
        if (val === null && sommes[k] !== undefined) { val = sommes[k]; note = T("somme des communes couvertes"); }
      } else if (regle === "somme") {
        if (sommes[k] === undefined) return;
        val = sommes[k];
        note = TN({ one: "somme sur {n} commune couverte",
                    other: "somme sur {n} communes couvertes" }, compte[k], { n: compte[k] });
      } else if (regle === "ratio_recalcule") {
        var num = d.numerateur === "IND-GEO-001" ? nb(r.superficie_km2) : sommes[d.numerateur];
        var den = d.denominateur === "IND-GEO-001" ? nb(r.superficie_km2) : sommes[d.denominateur];
        if (num == null || den == null || !den) return;
        val = num / den * facteurRatio(d);
        note = T("recalculé sur les totaux, pas moyenné entre communes");
      } else if (regle === "moyenne_simple") {
        if (compte[k] === undefined) return;
        val = sommes[k] / compte[k];
        note = TF("moyenne non pondérée des {n} communes couvertes", { n: compte[k] });
      }
      if (val === null || val === undefined) return;
      res[k] = { valeur: val, unite: unites[k] || d.unite, annee: annees[k], note: note,
                 couvertes: compte[k] || 0 };
    });
    return res;
  }

  function agregat(r) {
    var communes = communesDe(r);
    var agg = agreger(r, communes);
    var cles = Object.keys(agg).filter(function (k) { return (dico[k] || {}).categorie !== "Qualité" || k === "IND-QUA-001"; });
    var h = ['<h3 class="x-h3">' +
             TN({ one: "Agrégat sur {n} commune", other: "Agrégat sur {n} communes" },
                communes.length, { n: communes.length }) + "</h3>",
             '<div class="x-mesures">' + cles.map(function (k) {
               var d = dico[k] || {}, a = agg[k];
               return '<details class="x-mesure"><summary><b>' + fmt(a.valeur, a.unite) + "</b><span>" +
                 esc(libelle(k, "nom") || k) + '</span><small class="x-mill">' +
                 (a.annee ? TF("Millésime {an}", { an: esc(a.annee) }) + " · " : "") +
                 esc(a.note) + "</small></summary>" +
                 '<div class="x-detail">' +
                 (d.definition ? "<p><b>" + T("Définition.") + "</b> " +
                   esc(libelle(k, "definition")) + "</p>" : "") +
                 "<p><b>" + T("Règle d'agrégation.") + "</b> " +
                 esc(T(REGLE[d.regle_agregation] || d.regle_agregation)) +
                 (d.numerateur ? " — " + esc(libelle(d.numerateur, "nom") || d.numerateur) + " ÷ " +
                   esc(libelle(d.denominateur, "nom") || d.denominateur) : "") + "</p>" +
                 "<p><b>" + T("Couverture.") + "</b> " +
                 TN({ one: "{n} commune sur {total} apporte une valeur.",
                      other: "{n} communes sur {total} apportent une valeur." },
                    a.couvertes, { n: a.couvertes, total: communes.length }) + "</p>" +
                 (d.limites_connues ? '<p class="x-limite"><b>' + T("Limites.") + "</b> " +
                   esc(libelle(k, "limites_connues")) + "</p>" : "") +
                 "</div></details>";
             }).join("") + "</div>"];
    h.push('<p class="x-note">' +
      T("Les totaux ne portent que sur les communes où la donnée existe : additionner des absences reviendrait à les compter pour zéro.") +
      " " + TF("Les pourcentages sont {recalcules} — une moyenne des taux communaux donnerait le même poids à la plus petite commune qu'à la plus grande.",
        { recalcules: "<b>" + T("recalculés sur les totaux") + "</b>" }) + "</p>");
    h.push('<div class="x-actions"><button class="btn btn-outline x-btn-export-agg" data-agg="' +
           esc(r.atmart_geo_id) + '">' + T("Exporter cet agrégat (CSV)") + "</button>" +
           '<button class="btn btn-outline x-btn-comp" data-comparer="' + esc(r.atmart_geo_id) +
           '">' + T("Ajouter à la comparaison") + "</button>" +
           '<button class="btn btn-outline x-btn-print">' + T("Imprimer / PDF") + "</button></div>");
    return h.join("");
  }

  function fiche(id) {
    var r = parId[id];
    if (!r) return;
    courant = r;
    var h = [montrerAccueil ? blocAccueil(r) : "", blocResume(r), blocCarte(r)];
    if (r.niveau_admin === "3") {
      h.push(blocObjectif(r), blocIndicateurs(r), blocPyramide(r), blocPrix(r),
             blocServices(r), blocComparer(r), blocLacunes(r));
    } else if (r.niveau_admin === "0") {
      /* La fiche du pays : repères nationaux d'abord (ce qui n'existe qu'à ce
         niveau), puis le même agrégat que pour un département. Pas de bloc
         technique : l'entité est synthétique, ses métadonnées sont celles de
         ses sources, affichées repère par repère. */
      h.push(blocNat(), agregat(r), blocPyramide(r));
    } else h.push(agregat(r), blocPyramide(r));
    if (r.niveau_admin !== "0") h.push(blocOrganisations(r));
    h.push(blocEnfants(r), blocVerrou(r));
    if (r.niveau_admin !== "0") h.push(blocTechnique(r));
    $("#x-fiche").innerHTML = h.join("");
    $("#x-fiche").hidden = false;
    observerPyramide(r);
    aLApproche("#x-prix", remplirPrix, r);
    aLApproche("#x-nat", remplirNat, r);
    aLApproche("#x-services", remplirServices, r);
    var t = $("#x-titre-fiche");
    if (t) t.textContent = nomT(r);
    majURL();
    annoncer(TF("Fiche de {nom} affichée.", { nom: nomT(r) }));
  }

  function majURL() {
    if (!courant) return;
    var q = "?id=" + courant.atmart_geo_id +
            (objectif !== "tout" ? "&objectif=" + objectif : "") +
            (comparees.length ? "&comparer=" + comparees.join(",") : "") +
            (ongletActif !== "fiche" ? "&onglet=" + ongletActif : "") +
            (niveauComp !== "3" ? "&niveau=" + niveauComp : "") +
            (normalisation !== "total" ? "&norm=" + normalisation : "") +
            (ficheComplete ? "&complet=1" : "") +
            /* Neuvième paramètre d'état. Sans lui, un lien copié depuis une
               fiche en kreyòl se rouvrait en français chez le destinataire :
               tout l'état était partageable sauf la langue dans laquelle on
               avait lu. */
            (LANG !== "fr" ? "&lang=" + LANG : "");
    var si = $("#x-indicateur");
    if (si && si.value && si.value !== "IND-QUA-001") q += "&ind=" + si.value;
    try { history.replaceState(null, "", q); } catch (e) {}
  }

  /* --------------------------------------------- valeurs par niveau territorial
     Un departement n'a pas de valeurs propres dans le fichier : elles sont
     agregees depuis ses communes, selon la regle du dictionnaire. On les
     calcule une fois au demarrage plutot qu'a chaque affichage. */
  function precalculerAgregats() {
    terr.forEach(function (e) {
      if (e.niveau_admin === "1" || e.niveau_admin === "2") {
        aggEntite[e.atmart_geo_id] = agreger(e, communesDe(e));
      }
    });
    /* Le national suit exactement les mêmes règles que les départements : une
       somme se somme, un ratio se recalcule sur les totaux. Le calculer
       autrement ferait mentir la comparaison qu'on va afficher juste à côté. */
    aggNational = agreger({}, entitesDuNiveau("3"));
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
    var aN = (aggNational || {})[indId];
    if (!aN) return null;
    if (d.regle_agregation === "somme") {
      var pD = aD && aD.valeur ? valeur / aD.valeur * 100 : null;
      var pN = aN.valeur ? valeur / aN.valeur * 100 : null;
      if (pN === null) return null;
      var txt = dep && pD !== null
        ? TF("{pctD} % du total {dep_de}, {pctN} % du total national.",
             { pctD: fmt(Math.round(pD * 10) / 10), dep: nomT(dep),
               dep_de: deNom(dep.nom_fr), pctN: fmt(Math.round(pN * 10) / 10) })
        : TF("{pctN} % du total national.", { pctN: fmt(Math.round(pN * 10) / 10) });
      /* Une part de 100 % d'un total partiel ne dit pas ce qu'elle a l'air de
         dire : sur un indicateur couvert par une seule commune du département,
         « 100 % du total » signifie « seule commune documentée », pas « toutes
         les écoles du département ». Le total est donc qualifié dès qu'il ne
         repose pas sur l'ensemble des communes. */
      var nDep = dep ? communesDe(dep).length : 0;
      if (dep && aD && aD.couvertes < nDep) {
        txt += " " + TN({ one: "Ce total départemental ne repose que sur {n} commune documentée sur {t}.",
                          other: "Ce total départemental ne repose que sur {n} communes documentées sur {t}." },
                        aD.couvertes, { n: aD.couvertes, t: nDep });
      }
      if (aN.couvertes < nCommunes) {
        txt += " " + TF("Le total national en couvre {n} sur {t}.",
                        { n: aN.couvertes, t: nCommunes });
      }
      return txt;
    }
    if (d.regle_agregation !== "ratio_recalcule") return null;
    return dep && aD
      ? TF("{dep} : {vD} · Haïti : {vN} — recalculés sur les totaux, jamais moyennés.",
           { dep: esc(nomT(dep)), vD: fmt(aD.valeur, aD.unite),
             vN: fmt(aN.valeur, aN.unite) })
      : TF("Haïti : {vN} — recalculé sur les totaux, jamais moyenné.",
           { vN: fmt(aN.valeur, aN.unite) });
  }

  /* ------------------------------------------------- matrice de couverture
     Le trou de ce produit n'est pas la valeur qu'il affiche, c'est celle qu'il
     n'a pas. Une source par ligne, un département par colonne, et le compte des
     communes couvertes dans chaque case : on voit d'un coup d'œil que la santé
     s'arrête à quatre départements, et lesquels. Tout est compté, rien n'est
     écrit. */
  function matriceCouverture() {
    var deps = entitesDuNiveau("1").sort(function (a, b) {
      return a.pcode < b.pcode ? -1 : 1; });
    var dansDep = {};
    deps.forEach(function (d) {
      communesDe(d).forEach(function (c) { dansDep[c.pcode] = d.atmart_geo_id; });
    });
    var nDep = {};
    deps.forEach(function (d) { nDep[d.atmart_geo_id] = communesDe(d).length; });

    /* Une source peut alimenter plusieurs indicateurs : on la compte une fois,
       sur l'union des communes qu'elle documente. */
    var srcs = {};
    vals.forEach(function (v) {
      if (v.statut_valeur === "N" || nb(v.valeur) === null) return;
      /* La clé est la source entière, pas l'organisme : « OCHA Haïti » publie
         la cartographie scolaire de 2022 ET la liste sanitaire de 2023, qui ne
         couvrent ni le même nombre de communes ni les mêmes. Les confondre sur
         une ligne effacerait précisément ce que ce tableau doit montrer. */
      var nom = (v.source || "—").trim();
      var s = srcs[nom] || (srcs[nom] = { communes: {}, annees: {}, inds: {} });
      s.communes[v.pcode_commune] = 1;
      s.inds[v.indicateur_id] = 1;
      if (v.annee_reference) s.annees[v.annee_reference] = 1;
    });

    var noms = Object.keys(srcs).sort(function (a, b) {
      return Object.keys(srcs[b].communes).length - Object.keys(srcs[a].communes).length; });
    var h = ['<p class="x-note" style="margin-top:0">' +
      T("Chaque case donne le nombre de communes du département que la source documente. Une case vide n'est pas un zéro : c'est un territoire que la source ne couvre pas.") +
      '</p><div class="x-tabwrap"><table class="x-tab x-couv"><thead><tr><th scope="col">' +
      T("Source") + '</th><th scope="col">' + T("Millésimes") +
      '</th><th scope="col">' + T("Indicateurs") + '</th>'];
    /* « Nord », « Nord-Est » et « Nord-Ouest » tronqués à quatre lettres
       donnent trois fois « Nord ». Un nom composé se réduit à ses initiales. */
    var court = function (n) {
      return n.indexOf("-") > -1
        ? n.split("-").map(function (m) { return m.charAt(0).toUpperCase(); }).join("-")
        : n.slice(0, 4);
    };
    deps.forEach(function (d) {
      h.push('<th scope="col" title="' + esc(nomT(d)) + '">' +
             esc(court(nomT(d))) + "</th>");
    });
    h.push('<th scope="col">' + T("Total") + "</th></tr></thead><tbody>");

    noms.forEach(function (nom) {
      var s = srcs[nom], parDep = {};
      Object.keys(s.communes).forEach(function (pc) {
        var g = dansDep[pc];
        if (g) parDep[g] = (parDep[g] || 0) + 1;
      });
      var tot = Object.keys(s.communes).length;
      h.push('<tr><th scope="row">' + esc(nom) + "</th><td>" +
        esc(Object.keys(s.annees).sort().join(", ")) + "</td><td>" +
        Object.keys(s.inds).length + "</td>");
      deps.forEach(function (d) {
        var n = parDep[d.atmart_geo_id] || 0, t = nDep[d.atmart_geo_id];
        h.push('<td class="' + (n === 0 ? "x-couv-nul" : n < t ? "x-couv-part" : "") +
               '">' + (n === 0 ? "—" : n === t ? String(n) : n + "/" + t) + "</td>");
      });
      h.push("<td><b>" + tot + "/" + nCommunes + "</b></td></tr>");
    });
    h.push("</tbody></table></div>");
    h.push('<p class="x-note">' + T("Une source qui couvre les 140 communes affiche son nombre sans dénominateur. Toute autre case porte le rapport, parce que c'est le rapport qui compte.") + "</p>");
    /* La série de prix ne se lit pas dans ce tableau : elle est mensuelle, pas
       territoriale. Elle se télécharge, en attendant qu'un graphique la lise. */
    h.push('<p class="x-note">' + TF(
      "Une série historique est publiée à part : {lien} — 14 140 relevés de prix de détail, 240 mois de janvier 2005 à juillet 2025. Le PAM n'y tire pas un échantillon de communes : il tient un réseau sentinelle d'un marché urbain principal par département, dans 9 départements sur 10. Ce sont des prix de ville, et la première série temporelle du backbone.",
      { lien: '<a href="data/atmart_prix_marches_HT.csv" download>' +
              T("prix des marchés (CSV)") + "</a>" }) + "</p>");
    return h.join("");
  }

  function entitesDuNiveau(niv) {
    return terr.filter(function (e) { return e.niveau_admin === niv; });
  }

  /* La population d'une entite : la valeur communale, ou la somme
     precalculee pour un departement ou un arrondissement. Nulle si absente —
     jamais zero. */
  function populationDe(entite) {
    var v = valeurBrute(entite, "IND-POP-001");
    return v && v.valeur ? v.valeur : null;
  }

  function valeurBrute(entite, indId) {
    if (entite.niveau_admin === "3") {
      var v = vals.filter(function (x) {
        return x.pcode_commune === entite.pcode && x.indicateur_id === indId; })[0];
      if (!v || v.statut_valeur === "N") return null;
      return { valeur: nb(v.valeur), unite: v.unite, annee: v.annee_reference,
               statut: v.statut_valeur, source: v.source, methode: v.methode };
    }
    var a = (aggEntite[entite.atmart_geo_id] || {})[indId];
    if (!a) return null;
    return { valeur: a.valeur, unite: a.unite, annee: a.annee, statut: "A",
             source: T("Agrégat Atmart"), methode: a.note, couvertes: a.couvertes };
  }

  function totalNational(indId) {
    var t = 0, n = 0;
    entitesDuNiveau("3").forEach(function (c) {
      var v = valeurBrute(c, indId);
      if (v && v.valeur !== null) { t += v.valeur; n++; }
    });
    return n ? t : 0;
  }

  /* ----------------------------------------------------------- comparaison
     Deux a quatre territoires cote a cote. Une ligne par indicateur, avec son
     millesime : comparer des valeurs de millesimes differents est signale. */
  var MAX_COMP = 4;

  function ajouterComparaison(id) {
    if (comparees.indexOf(id) > -1 || comparees.length >= MAX_COMP) return;
    comparees.push(id);
    rendreComparaison();
    majURL();
  }

  function valeursDe(r) {
    var m = {};
    if (r.niveau_admin === "3") {
      vals.forEach(function (v) { if (v.pcode_commune === r.pcode) m[v.indicateur_id] = v; });
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
    if (comparees.length >= MAX_COMP) return "";
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
        return comparees.indexOf(r.atmart_geo_id) < 0; }).slice(0, 8);
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
      choix.innerHTML = comparees.length
        ? comparees.map(function (id) {
            var e = parId[id];
            return '<span class="x-jeton">' + esc(e ? nomT(e) : id) +
              '<button class="x-jeton-x" data-retirer="' + esc(id) + '" aria-label="' +
              esc(TF("Retirer {nom} de la comparaison", { nom: e ? nomT(e) : id })) +
              '">\u00d7</button></span>';
          }).join("")
        : '<span class="x-note">' + T("Aucun territoire sélectionné.") + "</span>";
    }
    if (comparees.length < 2) {
      zone.innerHTML = chercheCompHtml() + '<p class="x-note">' + TF(
        "Ajoutez au moins deux territoires. Depuis une fiche, le bouton « Ajouter à la comparaison » ; ou cherchez un territoire dans la barre ci-dessus puis ajoutez-le. Jusqu'à {max} territoires, communes et départements mélangés.",
        { max: MAX_COMP }) + "</p>";
      brancherChercheComp();
      if (refocus && $("#x-comp-input")) $("#x-comp-input").focus();
      return;
    }
    var ents = comparees.map(function (id) { return parId[id]; }).filter(Boolean);
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
    var ents = comparees.map(function (id) { return parId[id]; }).filter(Boolean);
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
    var ents = entitesDuNiveau(niveauComp);
    var sansValeur = niveauComp === "1"
      ? { one: "{n} département sans valeur", other: "{n} départements sans valeur" }
      : niveauComp === "2"
      ? { one: "{n} arrondissement sans valeur", other: "{n} arrondissements sans valeur" }
      : { one: "{n} commune sans valeur", other: "{n} communes sans valeur" };
    var tot = normalisation === "part" ? totalNational(indId) : 0;

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
    var normInfo = NORMALISATIONS[normalisation];
    var h = ['<p class="x-note">' + esc(libelle(indId, "definition")) +
             (an ? " <b>" + TF("Millésime {an}.", { an: esc(an) }) + "</b>" : "") +
             /* Annoncer « Lecture : pour 100 km² » au-dessus de valeurs brutes
                contredirait l'avertissement affiche juste en dessous. */
             (normalisation !== "total" && normalisable(indId)
               ? " <b>" + T("Lecture :") + "</b> " + esc(T(normInfo.nom)) + "." : "") +
             (normalisation === "habitant" && normInfo.note
               ? " " + esc(T(normInfo.note)) : "") +
             (d.limites_connues ? " <b>" + T("Limite :") + "</b> " +
               esc(libelle(indId, "limites_connues")) : "") +
             "</p>"];

    if (normalisation !== "total" && !normalisable(indId)) {
      h.push('<p class="x-avert">' +
        T("Cet indicateur est déjà un taux ou une densité : le normaliser n'aurait pas de sens. Les valeurs brutes sont affichées.") +
        "</p>");
    }

    var colTerr = T(NIVEAU[niveauComp]);
    h.push('<div class="x-tabwrap"><table class="x-tab x-classement"><thead><tr><th scope="col">#</th><th scope="col">' +
           esc(colTerr) + '</th><th scope="col">' + esc(libelle(indId, "nom") || indId) +
           (normalisation !== "total" && normalisable(indId)
             ? " <small>" + esc(T(normInfo.nom)) + "</small>" : "") +
           '</th><th scope="col">' + (niveauComp === "3" ? esc(T(NIVEAU["1"])) : T("Couverture")) +
           '</th><th scope="col"><span class="x-sr">' + T("Comparer") + "</span></th></tr></thead><tbody>");

    lignes.forEach(function (l, i) {
      var contexte;
      if (niveauComp === "3") {
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
    return ["Atmart Data \u2014 atmart.ltd", "CNIGS 2018", (terr[0] || {}).version || "",
            (vals[0] || {}).date_extraction || "", T(NORMALISATIONS[normalisation].nom), LANG,
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

  /* ------------------------------------------------------------- démarrage */
  function pret() {
    /* Le pays lui-même est cherchable : « Haïti » (ou « pays », « peyi »,
       « national ») ouvre une fiche nationale. Entité synthétique — le socle
       CNIGS s'arrête au département — raccrochée AU-DESSUS des départements
       pour que fil d'Ariane, carte, pyramide et agrégats suivent exactement le
       même chemin que pour n'importe quel territoire. Aucune valeur écrite en
       dur : superficie et population restent des sommes de communes. */
    terr.forEach(function (r) { if (r.niveau_admin === "1") r.parent_atmart_geo_id = "HT"; });
    terr.push({ atmart_geo_id: "HT", pcode: "HT", nom_fr: "Haïti", nom_ht: "Ayiti",
                niveau_admin: "0", type_entite: "Pays", parent_atmart_geo_id: "",
                superficie_km2: "", alias: "pays peyi nation nasyonal national" });
    terr.forEach(function (r) {
      parId[r.atmart_geo_id] = r;
      if (r.pcode) parPcode[r.pcode] = r;
      (enfantsDe[r.parent_atmart_geo_id] = enfantsDe[r.parent_atmart_geo_id] || []).push(r);
    });
    orgs.forEach(function (o) {
      if (o.pcode_commune) (orgsCom[o.pcode_commune] = orgsCom[o.pcode_commune] || []).push(o);
      if (o.pcode_section) (orgsSec[o.pcode_section] = orgsSec[o.pcode_section] || []).push(o);
    });
    vals.forEach(function (v) {
      if (v.statut_valeur === "N" || nb(v.valeur) === null) return;
      (parIndicateur[v.indicateur_id] = parIndicateur[v.indicateur_id] || []).push(v);
    });
    Object.keys(parIndicateur).forEach(function (k) {
      parIndicateur[k].sort(function (a, b) { return nb(b.valeur) - nb(a.valeur); });
    });

    /* Couverture par indicateur, et liste des indicateurs encore a construire.
       Les deux repondent a la meme question posee autrement : « sur quoi ce
       territoire est-il documente, et sur quoi ne l'est-il pas ». */
    nCommunes = terr.filter(function (r) { return r.niveau_admin === "3"; }).length;
    vals.forEach(function (v) {
      var c = couverture[v.indicateur_id] ||
              (couverture[v.indicateur_id] = { avec: 0, sans: 0 });
      if (v.statut_valeur === "N" || nb(v.valeur) === null) c.sans++; else c.avec++;
    });
    indBloques = Object.keys(dico).filter(function (k) {
      return dico[k].statut !== "Disponible";
    });

    /* compteurs : comptés, jamais écrits en dur */
    var nDep = terr.filter(function (r) { return r.niveau_admin === "1"; }).length;
    var nArr = terr.filter(function (r) { return r.niveau_admin === "2"; }).length;
    var nCom = terr.filter(function (r) { return r.niveau_admin === "3"; }).length;
    var nObs = vals.filter(function (v) { return v.statut_valeur !== "N"; }).length;
    var nAbs = vals.length - nObs;
    function compteurs() {
      var el = $("#x-compte");
      if (!el) return;
      /* « communes documentées » laissait entendre que les 140 le sont sur tout.
         Le socle territorial et la couverture d'un indicateur sont deux choses :
         la seconde se lit indicateur par indicateur, et va ici de 10 % à 100 %. */
      /* terr contient l'entité synthétique « Haïti » : elle n'est pas une
         entité du socle CNIGS, on ne la compte pas — le chiffre affiché doit
         rester exactement celui du référentiel. */
      var nTer = terr.filter(function (r) { return r.niveau_admin !== "0"; }).length;
      el.innerHTML = TF("{t} territoires au socle CNIGS 2018 · {c} communes · {o} valeurs sourcées · {a} absences documentées",
        { t: nTer.toLocaleString(LOCALE[LANG]), c: nCom,
          o: nObs.toLocaleString(LOCALE[LANG]),
          a: nAbs.toLocaleString(LOCALE[LANG]) }) +
        (ADMIN ? " · " + TF("{n} organisations",
          { n: orgs.length.toLocaleString(LOCALE[LANG]) }) : "");
    }
    compteurs();
    var mc = $("#x-couv-corps");
    if (mc) mc.innerHTML = matriceCouverture();
    var cv = $("#x-couverture");
    if (cv) {
      cv.innerHTML = TF(
        /* « en vigueur » laissait entendre que le millésime 2018 est le
           découpage légal d'aujourd'hui. Il est le référentiel que cette
           édition retient, parce qu'il est le seul à fournir des codes de
           jointure et des géométries — ce n'est pas la même affirmation. */
        "Le référentiel territorial CNIGS 2018 retenu pour cette édition compte {decompte}. D'autres référentiels haïtiens, dont les estimations démographiques récentes de l'IHSI, en dénombrent davantage.",
        { decompte: "<b>" + TF("{dep} départements, {arr} arrondissements et {com} communes",
            { dep: nDep, arr: nArr, com: nCom }) + "</b>" }) +
        ' <button class="x-lien" id="x-pourquoi">' +
        T("Pourquoi ce nombre varie-t-il ?") + "</button>";
    }

    var sel = $("#x-indicateur"), dispo = {};
    vals.forEach(function (v) { dispo[v.indicateur_id] = 1; });
    /* Les options portent le nom de l'indicateur : elles doivent etre
       reecrites quand la langue change, sinon la liste reste en francais
       au-dessus d'un tableau traduit. */
    function remplirIndicateurs() {
      var garde = sel.value;
      sel.innerHTML = "";
      Object.keys(dispo).sort().forEach(function (k) {
        var o = document.createElement("option");
        o.value = k; o.textContent = libelle(k, "nom") || k;
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
    champ.addEventListener("input", function () { afficherResultats(chercher(champ.value), champ.value); });
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
        carteNiveau = niv.dataset.niveau;
        var zone = document.querySelector(".x-carte");
        if (zone && courant) zone.outerHTML = blocCarte(courant);
        return;
      }
      var b = e.target.closest("[data-id]");
      if (b) {
        /* Depuis l'onglet Comparer, un resultat de recherche s'AJOUTE a la
           comparaison au lieu d'ouvrir sa fiche : c'est ce que le texte d'aide
           promet, et renvoyer l'utilisateur vers la fiche lui faisait perdre
           l'onglet et croire la comparaison impossible. */
        if (ongletActif === "comparaison" && b.classList.contains("x-res")) {
          ajouterComparaison(b.dataset.id);
          rendreComparaison(); majURL();
          $("#x-resultats").hidden = true; champ.value = "";
          var oc = document.querySelector('[data-onglet="comparaison"]');
          if (oc) oc.click();
          /* la main revient au champ : on enchaine les territoires sans re-cliquer */
          var nc = $("#x-comp-input");
          if (nc) nc.focus();
          return;
        }
        /* L'utilisateur a choisi un territoire : la fiche n'est plus un exemple. */
        montrerAccueil = false;
        fiche(b.dataset.id);
        $("#x-resultats").hidden = true; champ.value = "";
        var of = document.querySelector('[data-onglet="fiche"]');
        if (of) of.click();
        $("#x-fiche").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (e.target.closest(".x-btn-export") && courant) {
        var m = vals.filter(function (v) { return v.pcode_commune === courant.pcode; });
        telecharger("atmart_" + courant.pcode + "_indicateurs.csv",
          ["indicateur_id", "indicateur", "valeur", "unite", "annee_reference", "statut_valeur",
           "niveau_qualite", "source", "date_source", "methode"].concat(enTeteMeta()),
          m.map(function (v) {
            return [v.indicateur_id, libelle(v.indicateur_id, "nom"), v.valeur,
                    uniteL(v.unite), v.annee_reference,
                    v.statut_valeur, v.niveau_qualite, v.source, v.date_source,
                    v.methode].concat(ligneMeta());
          }));
        return;
      }
      /* La pyramide s'exporte avec ses effectifs exacts, pas avec les parts
         arrondies du graphique — et avec la ligne de traçabilité commune. */
      if (e.target.closest(".x-btn-pyr") && courant) {
        var p = pyramideDe(courant);
        if (!p) return;
        var lignes = [];
        pyrTranches.forEach(function (t, i) {
          ["F", "M", "T"].forEach(function (s) {
            lignes.push([courant.pcode || "", nomT(courant), pyrMeta.annee || "",
              s, libTranche(t), t.min, t.max === null ? "" : t.max, p[s][i],
              pct(p[s][i], p.total), pyrMeta.statut || "", pyrMeta.qualite || "",
              pyrMeta.source || ""].concat(ligneMeta()));
          });
        });
        telecharger("atmart_" + (courant.pcode || courant.atmart_geo_id) + "_pyramide_ages.csv",
          ["pcode", "territoire", "annee_reference", "sexe", "tranche_age", "borne_min",
           "borne_max", "effectif", "part_population", "statut_valeur", "niveau_qualite",
           "source"].concat(enTeteMeta()), lignes);
        return;
      }
      if (e.target.closest(".x-btn-lien")) {
        var u = location.href;
        if (navigator.clipboard) navigator.clipboard.writeText(u);
        var libelle = e.target.textContent;
        e.target.textContent = T("Lien copié ✓");
        setTimeout(function () { e.target.textContent = libelle; }, 2200);
        return;
      }
      var bc = e.target.closest("[data-comparer]");
      if (bc) {
        ajouterComparaison(bc.dataset.comparer);
        bc.textContent = comparees.indexOf(bc.dataset.comparer) > -1
          ? T("Ajouté à la comparaison ✓")
          : TF("Comparaison pleine ({n})", { n: MAX_COMP });
        return;
      }
      var br = e.target.closest("[data-retirer]");
      if (br) {
        comparees = comparees.filter(function (x) { return x !== br.dataset.retirer; });
        rendreComparaison(); majURL(); return;
      }
      if (e.target.closest(".x-btn-export-comp")) { exporterComparaison(); return; }
      if (e.target.closest(".x-btn-tout") && courant) {
        ficheComplete = !ficheComplete;
        fiche(courant.atmart_geo_id);
        var anc = $("#indicateurs");
        if (anc) anc.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      /* Imprimer une fiche dont la pyramide n'a pas encore été atteinte à
         l'écran produirait un PDF amputé : on l'attend, puis on imprime. */
      if (e.target.closest(".x-btn-print")) {
        if (courant && $("#x-pyramide") && !$("#x-pyramide").innerHTML) {
          remplirPyramide(courant).then(function () { window.print(); });
        } else window.print();
        return;
      }
      var ba = e.target.closest("[data-agg]");
      if (ba) {
        var ent = parId[ba.dataset.agg];
        var agg = agreger(ent, communesDe(ent));
        telecharger("atmart_" + (ent.pcode || ent.atmart_geo_id) + "_agregat.csv",
          ["atmart_geo_id", "territoire_fr", "territoire_ht", "niveau", "indicateur_id",
           "indicateur", "valeur", "unite", "annee_reference", "regle_agregation",
           "communes_couvertes"].concat(enTeteMeta()),
          Object.keys(agg).map(function (k) {
            return [ent.atmart_geo_id, ent.nom_fr, ent.nom_ht || "",
                    T(NIVEAU[ent.niveau_admin]), k,
                    libelle(k, "nom"), agg[k].valeur, uniteL(agg[k].unite), agg[k].annee,
                    (dico[k] || {}).regle_agregation,
                    agg[k].couvertes].concat(ligneMeta()); }));
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
      if (!e.target || e.target.id !== "x-prix-produit" || !courant) return;
      prixProduit = e.target.value;
      remplirPrix(courant);
    });

    var selObj = $("#x-objectif");
    if (selObj) selObj.addEventListener("change", function () {
      objectif = selObj.value;
      if (courant) fiche(courant.atmart_geo_id);
    });

    sel.addEventListener("change", function () { classement(sel.value); majURL(); });
    var selNiv = $("#x-niveau");
    if (selNiv) selNiv.addEventListener("change", function () {
      niveauComp = selNiv.value; classement(sel.value); majURL(); });
    var selNorm = $("#x-normalisation");
    if (selNorm) selNorm.addEventListener("change", function () {
      var v = selNorm.value;
      if (!NORMALISATIONS[v].possible) {
        alert(T(NORMALISATIONS[v].raison));
        selNorm.value = normalisation; return;
      }
      normalisation = v; classement(sel.value); rendreComparaison(); majURL(); });
    function exporterClassement() {
      var l = window.__classement || [];
      var d = dico[sel.value] || {};
      var niv = niveauComp === "1" ? "departements" : niveauComp === "2" ? "arrondissements" : "communes";
      telecharger("atmart_" + sel.value + "_" + niv + "_" + normalisation + ".csv",
        ["rang", "atmart_geo_id", "pcode", "territoire_fr", "territoire_ht", "niveau",
         "indicateur_id", "indicateur",
         "valeur_affichee", "unite_affichee", "valeur_brute", "unite_brute", "annee_reference",
         "statut_valeur", "regle_agregation"].concat(enTeteMeta()),
        l.map(function (x, i) {
          return [i + 1, x.e.atmart_geo_id, x.e.pcode || "", x.e.nom_fr, x.e.nom_ht || "",
                  T(NIVEAU[x.e.niveau_admin]), sel.value, libelle(sel.value, "nom"),
                  x.aff, uniteL(x.unite), x.brut.valeur, uniteL(x.brut.unite), x.brut.annee,
                  x.brut.statut, d.regle_agregation || ""].concat(ligneMeta()); }));
    }
    $("#x-export").addEventListener("click", exporterClassement);
    document.addEventListener("click", function (e) {
      if (e.target.closest(".x-btn-export-cl")) exporterClassement();
      if (e.target.closest(".x-btn-comp-top")) {
        comparees = (window.__classement || []).slice(0, MAX_COMP)
          .map(function (x) { return x.e.atmart_geo_id; });
        rendreComparaison(); majURL();
        document.querySelector('[data-onglet="comparaison"]').click();
      }
    });

    [].forEach.call(document.querySelectorAll("[data-onglet]"), function (b) {
      b.addEventListener("click", function () {
        [].forEach.call(document.querySelectorAll("[data-onglet]"), function (x) {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-selected", x === b ? "true" : "false");
        });
        ongletActif = b.dataset.onglet;
        $("#x-vue-fiche").hidden = b.dataset.onglet !== "fiche";
        $("#x-vue-comparaison").hidden = b.dataset.onglet !== "comparaison";
        $("#x-vue-classement").hidden = b.dataset.onglet !== "classement";
        majURL();
      });
    });

    var niv = (location.search.match(/niveau=([123])/) || [])[1];
    if (niv) { niveauComp = niv; var sn = $("#x-niveau"); if (sn) sn.value = niv; }
    var nrm = (location.search.match(/norm=([a-z0-9]+)/) || [])[1];
    if (nrm && NORMALISATIONS[nrm] && NORMALISATIONS[nrm].possible) {
      normalisation = nrm; var snn = $("#x-normalisation"); if (snn) snn.value = nrm;
    }
    var ind = (location.search.match(/ind=(IND-[A-Z0-9-]+)/) || [])[1];
    if (ind && dico[ind]) sel.value = ind;
    classement(sel.value);
    var cmp = (location.search.match(/comparer=([A-Z0-9,\-]+)/) || [])[1];
    if (cmp) comparees = cmp.split(",").filter(function (x) { return parId[x]; }).slice(0, MAX_COMP);
    rendreComparaison();
    /* Un lien de comparaison doit ouvrir la comparaison, pas la fiche. */
    var ong = (location.search.match(/onglet=([a-z]+)/) || [])[1];
    if (!ong && cmp) ong = "comparaison";
    if (ong) {
      var bo = document.querySelector('[data-onglet="' + ong + '"]');
      if (bo) bo.click();
    }
    var ob = (location.search.match(/objectif=([a-z]+)/) || [])[1];
    if (OBJECTIFS[ob]) { objectif = ob; if (selObj) selObj.value = ob; }
    ficheComplete = /[?&]complet=1/.test(location.search);
    var id = (location.search.match(/id=([A-Z0-9-]+)/) || [])[1];
    /* Sans territoire demandé, la fiche ouverte est un exemple : on le dit. */
    montrerAccueil = !parId[id];
    fiche(parId[id] ? id : "HTC-0111");

    /* Changement de langue. L'etat de l'application — territoire courant,
       territoires compares, niveau, mode de lecture, onglet actif — vit dans
       des variables du module : il traverse le changement sans etre touche.
       On ne recharge que le dictionnaire, puis on redessine les trois vues. */
    function redessiner() {
      remplirIndicateurs();
      compteurs();
      classement(sel.value);
      rendreComparaison();
      if (courant) fiche(courant.atmart_geo_id);
      var actif = document.querySelector('[data-onglet="' + ongletActif + '"]');
      if (actif) actif.click();
    }
    document.addEventListener("atmart:lang", function (e) {
      var l = e.detail;
      if (window.ATM_LANGUES && window.ATM_LANGUES.indexOf(l) < 0) l = "fr";
      chargerLangue(l).then(redessiner);
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

  var liste = [F.terr, F.vals, F.dico].concat(F.orgs ? [F.orgs] : []);
  Promise.all(liste.map(function (u) { return charger(u); })).then(function (t) {
    terr = parseCSV(t[0]); vals = parseCSV(t[1]);
    parseCSV(t[2]).forEach(function (d) { dico[d.indicateur_id] = d; });
    if (t[3]) orgs = parseCSV(t[3]);
    /* Le contour est un agrement : s'il manque, la fiche s'affiche sans carte. */
    return charger(CFG.contour || DIR + "haiti_contour_simplifie.geojson")
      .then(function (t) { return JSON.parse(t); })
      .then(function (g) {
        if (g) contour = g.features[0].geometry.coordinates;
      })
      .catch(function () {})
      /* Les contours administratifs sont un agrément comme le contour
         national : s'ils manquent, la carte retombe sur les bulles. */
      .then(function () {
        return Promise.all([
          charger(DIR + "haiti_departements_simplifie.geojson")
            .then(function (x) { polyDep = JSON.parse(x).features; })
            .catch(function () { polyDep = null; }),
          charger(DIR + "haiti_communes_simplifie.geojson")
            .then(function (x) { polyCom = JSON.parse(x).features; })
            .catch(function () { polyCom = null; })
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
        if (lu && LOCALE[lu]) l = lu;
        if (window.ATM_LANG_FORCE) l = window.ATM_LANG_FORCE;   // page localisée
        /* La page peut restreindre les langues offertes : un visiteur venu
           d'une page en kreyol ne doit pas voir le moteur basculer seul
           pendant que le HTML de la page reste en francais. */
        if (window.ATM_LANGUES && window.ATM_LANGUES.indexOf(l) < 0) l = "fr";
        return chargerLangue(l);
      })
      .then(pret);
  }).catch(function (e) {
    /* Une panne silencieuse est pire qu'une panne visible : on trace la cause
       reelle avant de composer un message, dont la traduction pourrait echouer. */
    if (window.console) console.error("Explorateur :", e);
    $("#x-chargement").innerHTML = '<p class="x-vide">' +
      TF("Les données n'ont pas pu être chargées ({err}). Les fichiers restent téléchargeables depuis le {lien}.",
        { err: esc(e.message),
          lien: '<a href="' + SITE + 'datasets.html">' + T("catalogue") + "</a>" }) + "</p>";
  });
})();
