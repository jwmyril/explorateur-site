/* Module « fiche » du moteur — découpé le 16/08/2026.
   Le code est celui d'explorateur.js, déplacé verbatim : seules les
   variables réassignées ont pris le préfixe S. de l'état partagé.
   A porte les fonctions des autres modules. */
import { S } from "./etat.js";
export default function (A) {
  /* Ce que ce module reçoit des autres — calculé, jamais listé à la main. */
  const { $, ADMIN, DIR, F, NATURE_PERIODE, NIVEAU, QUALITE, REGLE, SITE, STATUT, STATUT_IND, T, TF, THEME, TN, agreger, annoncer, blocCarte, charger, communesDe, couverture, deNom, dico, enfantsDe, esc, fmt, jour, libCouverture, libFraicheur, libelle, lienParrainage, liste, nb, nomSecond, nomT, ordinal, orgsCom, orgsSec, parId, parIndicateur, parseCSV, rang, situation, valeurBrute } = A;
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
    var m = S.vals.filter(function (v) { return v.pcode_commune === r.pcode; });
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
      nManques: absents.length + S.indBloques.length,
      nBloques: S.indBloques.length,
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
    var maj = { date_extraction: S.vals.reduce(function (d, v) {
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

  /* ------------------------------------------------------ pyramide des âges
     Le fichier de structure par âge pèse 1,1 Mo — plus que tous les autres
     réunis. Il n'est donc pas chargé au démarrage mais à la première fiche
     ouverte, et une seule fois : la plupart des visites ne le demandent
     jamais. S'il manque — hors connexion, cache incomplet — la fiche s'affiche
     sans pyramide et le dit, comme elle s'affiche sans carte quand le contour
     manque. Les grands groupes d'âge, eux, restent dans les indicateurs. */
  

  function chargerPyramide() {
    if (S.pyrPromesse) return S.pyrPromesse;
    S.pyrPromesse = charger(F.pyr, 1).then(function (t) {
      var idx = {}, tr = {};
      parseCSV(t).forEach(function (l) {
        var rg = +l.rang_tranche;
        if (!rg || !l.pcode_commune) return;
        tr[rg] = { rang: rg, min: +l.borne_min,
                   max: l.borne_max === "" ? null : +l.borne_max };
        var c = idx[l.pcode_commune] || (idx[l.pcode_commune] = { F: [], M: [], T: [] });
        if (c[l.sexe]) c[l.sexe][rg - 1] = nb(l.effectif) || 0;
        S.pyrMeta = { annee: l.annee_reference, source: l.source, statut: l.statut_valeur,
                    qualite: l.niveau_qualite, extraction: l.date_extraction,
                    version: l.version };
      });
      S.pyrTranches = Object.keys(tr).map(Number).sort(function (a, b) { return a - b; })
                          .map(function (k) { return tr[k]; });
      S.pyrIdx = S.pyrTranches.length ? idx : null;
      return S.pyrIdx;
    }).catch(function () { S.pyrIdx = null; return null; });
    return S.pyrPromesse;
  }

  /* « 0-4 », « 80+ » : des chiffres, lisibles dans les quatre langues. */
  function libTranche(t) { return t.max === null ? t.min + "+" : t.min + "-" + t.max; }

  /* Une commune lit ses propres lignes ; un arrondissement ou un département
     somme celles de ses communes — la structure par âge s'additionne, c'est la
     règle « somme » du dictionnaire, pas une moyenne. */
  function pyramideDe(r) {
    if (!S.pyrIdx) return null;
    var communes = r.niveau_admin === "3" ? [r] : communesDe(r);
    var n = S.pyrTranches.length, out = { F: [], M: [], T: [], communes: 0 }, i;
    for (i = 0; i < n; i++) { out.F[i] = 0; out.M[i] = 0; out.T[i] = 0; }
    communes.forEach(function (c) {
      var d = S.pyrIdx[c.pcode];
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
    S.pyrTranches.forEach(function (t, k) {
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
    var n = S.pyrTranches.length, i;
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
      t = S.pyrTranches[i];
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
    for (var i = S.pyrTranches.length - 1; i >= 0; i--) {
      h.push('<tr><th scope="row">' + esc(libTranche(S.pyrTranches[i])) + "</th><td>" + fmt(p.F[i]) +
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
      if (!S.courant || S.courant.atmart_geo_id !== r.atmart_geo_id) return;
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
          { src: esc(S.pyrMeta.source || ""), an: esc(S.pyrMeta.annee || ""),
            statut: esc(T(STATUT[S.pyrMeta.statut]) || S.pyrMeta.statut || ""),
            date: jour(S.pyrMeta.extraction) }) + "</p></details>" +
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
    S.vals.forEach(function (v) {
      if (v.pcode_commune !== r.pcode || v.statut_valeur !== "N") return;
      out.push({ id: v.indicateur_id,
                 nom: libelle(v.indicateur_id, "nom") || v.indicateur_id,
                 motif: v.methode });
    });
    S.indBloques.forEach(function (k) {
      out.push({ id: k, nom: libelle(k, "nom") || k,
                 motif: (T(STATUT_IND[dico[k].statut]) || dico[k].statut) +
                        (dico[k].dependance ? " — " + dico[k].dependance : "") });
    });
    return out;
  }

  function avertissements(r) {
    var m = S.vals.filter(function (v) {
      return v.pcode_commune === r.pcode && v.statut_valeur !== "N"; });
    var a = [], statuts = {}, annees = [], partiels = 0;
    m.forEach(function (v) {
      statuts[v.statut_valeur] = 1;
      if (v.annee_reference) annees.push(+v.annee_reference);
      var c = couverture[v.indicateur_id];
      if (c && c.avec < S.nCommunes) partiels++;
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
  
  var FENETRE = 60;   /* mois affichés : cinq ans ; la série entière est en CSV */

  function chargerPrix() {
    if (S.prixPromesse) return S.prixPromesse;
    S.prixPromesse = charger(F.prix, 1).then(function (txt) {
      var idx = {};
      parseCSV(txt).forEach(function (l) {
        if (!l.pcode_commune || !l.prix) return;
        var c = idx[l.pcode_commune] || (idx[l.pcode_commune] = {});
        var k = l.produit + " · " + l.marche;
        var s = c[k] || (c[k] = { produit: l.produit, marche: l.marche,
                                  unite: l.unite_mesure, points: [] });
        s.points.push({ mois: l.mois, prix: nb(l.prix) });
        S.prixMeta = { source: l.source, statut: l.statut_valeur,
                     extraction: l.date_extraction };
      });
      Object.keys(idx).forEach(function (pc) {
        Object.keys(idx[pc]).forEach(function (k) {
          idx[pc][k].points.sort(function (a, b) { return a.mois < b.mois ? -1 : 1; });
        });
      });
      S.prixIdx = idx;
      return idx;
    }).catch(function () { S.prixIdx = null; return null; });
    return S.prixPromesse;
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
      if (!S.courant || S.courant.atmart_geo_id !== r.atmart_geo_id) return;
      var b = $("#x-prix");
      if (!b) return;
      var com = S.prixIdx && S.prixIdx[r.pcode];
      /* Pas de série ici : la commune n'est pas sur le réseau du PAM. Inutile de
         le répéter — l'absence est déjà documentée dans « ce qui reste à
         documenter », avec son motif. */
      if (!com) { b.innerHTML = ""; return; }
      var cles = Object.keys(com).sort(function (a, b2) {
        return com[b2].points.length - com[a].points.length; });
      if (cles.indexOf(S.prixProduit) < 0) S.prixProduit = cles[0];
      var s = com[S.prixProduit];
      var pts = s.points.slice(-FENETRE);
      var opts = cles.map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === S.prixProduit ? " selected" : "") +
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
  

  function chargerNat() {
    if (S.natPromesse) return S.natPromesse;
    S.natPromesse = charger(DIR + "atmart_indicateurs_national_HT.csv", 1)
      .then(function (t) { S.natLignes = parseCSV(t); return S.natLignes; })
      .catch(function () { S.natLignes = null; return null; });
    return S.natPromesse;
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
  

  function chargerServices() {
    if (S.svcPromesse) return S.svcPromesse;
    S.svcPromesse = Promise.all([
      /* Dénombrement, pas annuaire : décision du 14/08/2026 — on publie
         combien de notaires et d'arpenteurs par commune, jamais les noms,
         adresses ou téléphones de personnes physiques compilés du web. */
      charger(DIR + "atmart_professions_communes_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_presence_organisations_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_registre_ong_HT.csv", 1).catch(function () { return null; }),
      charger(DIR + "atmart_infrastructures_communes_HT.csv", 1).catch(function () { return null; }),
      /* 87 Ko : l'historique sismique des 140 communes, chargé dans la
         même vague que les services pour ne pas ajouter d'aller-retour. */
      charger(DIR + "atmart_seismes_communes.json", 1).catch(function () { return null; })
    ]).then(function (t) {
      try { S.seismes = t[4] ? JSON.parse(t[4]) : null; } catch (e) { S.seismes = null; }
      if (!t[0] && !t[1] && !t[2] && !t[3]) { S.svcIdx = null; return null; }
      S.svcIdx = { pro: {}, orgs: {}, ong: {}, infra: {} };
      (t[3] ? parseCSV(t[3]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (S.svcIdx.infra[l.pcode_commune] = S.svcIdx.infra[l.pcode_commune] || []).push(l);
      });
      (t[0] ? parseCSV(t[0]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (S.svcIdx.pro[l.pcode_commune] = S.svcIdx.pro[l.pcode_commune] || []).push(l);
      });
      (t[1] ? parseCSV(t[1]) : []).forEach(function (l) {
        if (l.pcode_commune)
          (S.svcIdx.orgs[l.pcode_commune] = S.svcIdx.orgs[l.pcode_commune] || []).push(l);
      });
      (t[2] ? parseCSV(t[2]) : []).forEach(function (l) {
        String(l.pcodes_communes || "").split(";").forEach(function (p) {
          p = p.trim();
          if (p) (S.svcIdx.ong[p] = S.svcIdx.ong[p] || []).push(l);
        });
      });
      return S.svcIdx;
    });
    return S.svcPromesse;
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

      var nPro = 0;
      var corpsPro = pro.length
        ? "<p>" + pro.map(function (p) {
            nPro += nb(p.effectif) || 0;
            return "<b>" + fmt(nb(p.effectif), "") + "</b> " + esc(p.profession.toLowerCase()) +
                   (nb(p.effectif) > 1 ? "s" : "");
          }).join(" · ") + "</p>"
        : "<p>" + T("Aucun professionnel dans nos sources pour cette commune — ce qui ne veut pas dire aucun sur le territoire : la compilation couvre environ la moitié des quelque 1 500 notaires et arpenteurs du pays, sur 55 communes.") + "</p>";
      h.push(sectionServices(
        TN({ one: "{n} notaire ou arpenteur dénombré",
             other: "{n} notaires et arpenteurs dénombrés" }, nPro, { n: nPro }),
        corpsPro,
        T("Dénombrement issu d'une compilation de sources web (août 2026), non recoupée avec le registre officiel du MJSP, qui n'est pas publié. Les noms ne sont pas publiés : un décideur a besoin de savoir s'il y a un notaire, pas de son téléphone.")));

      var corpsOrg = S.orgs.length
        ? '<div class="x-tabwrap"><table class="x-tab"><thead><tr><th scope="col">' +
          T("Organisation") + '</th><th scope="col">' + T("Type") + '</th><th scope="col">' +
          T("Secteurs ici") + "</th></tr></thead><tbody>" +
          S.orgs.map(function (o) {
            return "<tr><td>" + esc(o.l.nom) + (o.l.acronyme && o.l.acronyme !== o.l.nom ?
              " <code>" + esc(o.l.acronyme) + "</code>" : "") + "</td><td>" +
              esc(o.l.type_organisation || "—") + "</td><td>" +
              esc(Object.keys(o.secteurs).join(", ") || "—") + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : "<p>" + T("Aucune présence déclarée aux clusters dans cette commune au dernier relevé.") + "</p>";
      h.push(sectionServices(
        TN({ one: "{n} organisation présente (3W OCHA, juin 2026)",
             other: "{n} organisations présentes (3W OCHA, juin 2026)" },
           S.orgs.length, { n: S.orgs.length }),
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
        ["eau_wpdx", T("Points d'eau (WPdx)"), T("Relevés de terrain Haiti Outreach et partenaires (CC BY-SA) — couverture concentrée dans le Nord et le Centre : un zéro ailleurs dit l'absence de relevé, pas l'absence d'eau.")],
        ["eau_osm", T("Eau potable (OSM)"), T("Points « eau potable » d'OpenStreetMap (ODbL) — cartographie contributive, complète nulle part.")],
        ["carburant", T("Stations-service (OSM)"), T("Objets « fuel » d'OpenStreetMap (ODbL, extrait HOT du 06/08/2026).")],
        ["finance", T("Banques et transferts (OSM)"), T("Banques, guichets, agences de transfert et bureaux de change cartographiés dans OpenStreetMap (ODbL).")],
        ["routes", T("Routes (OSM)"), T("Longueurs par type, chaque tronçon affecté à la commune de son point médian — ordre de grandeur, pas un cadastre (~100 m de tolérance aux limites).")],
        ["lieux_habites", T("Lieux habités (OSM)"), T("Villes, bourgs, villages, hameaux et habitats isolés typés dans OpenStreetMap — le référentiel CNIGS du socle reste la source des localités officielles.")],
        ["electricite", T("Électricité (OSM)"), T("L'OSM haïtien ne recense que 74 objets électriques dans tout le pays (14/08/2026) : ce comptage dit surtout ce qui n'est pas cartographié. Aucune carte officielle ouverte du réseau EDH n'existe.")],
        ["mobile", T("Antennes mobiles (OpenCelliD)"), T("7 antennes recensées dans TOUT le pays (14/08/2026) : la base participative est quasi vide pour Haïti — ce chiffre mesure la participation, pas le réseau. Digicel et Natcom couvrent bien davantage ; leurs cartes ne sont pas ouvertes.")],
        ["telecom", T("Équipements télécom par opérateur (OSM)"), T("Pylônes et mâts de communication, boutiques mobiles, bureaux d'opérateur et accès internet cartographiés dans OpenStreetMap (ODbL, Overpass du 15/08/2026), rattachés à Digicel, Natcom, Voilà ou Access Haiti quand la source les nomme. Ce n'est PAS le parc des opérateurs : ni Digicel, ni Natcom, ni le CONATEL ne le publient. 498 équipements dans 81 communes sur 140 — une commune sans point n'est pas une commune sans couverture.")]
      ];
      var corpsInfra = FAMILLES.map(function (fdef) {
        var lgs = parFam[fdef[0]];
        if (!lgs) return "";
        var morceaux = lgs.map(function (l) {
          return esc(l.sous_type) + " : " + fmt(nb(l.valeur), l.unite === "km" ? "km" : "");
        }).join(" · ");
        /* fdef[1] et fdef[2] sont deja traduits : la table les enveloppe
           dans T() a sa construction, ce qui les rend visibles au releve
           statique. Les repasser par T() ici chercherait la traduction
           d'une traduction. */
        return "<p><b>" + fdef[1] + ".</b> " + morceaux +
               ' <span class="x-mill">— ' + fdef[2] + "</span></p>";
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
        '<a href="' + DIR + 'atmart_professions_communes_HT.csv" download>' + T("Professions dénombrées (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_presence_organisations_HT.csv" download>' + T("Présence 3W (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_registre_ong_HT.csv" download>' + T("ONG du registre (CSV)") + "</a> · " +
        '<a href="' + DIR + 'atmart_infrastructures_communes_HT.csv" download>' + T("Infrastructures (CSV)") + "</a></p>");
      el.innerHTML = h.join("");
    });
  }

  function blocObjectif(r) {
    if (ADMIN || r.niveau_admin !== "3") return "";
    var o = OBJECTIFS[S.objectif] || {};
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
    S.terr.forEach(function (t) { n[t.niveau_admin] = (n[t.niveau_admin] || 0) + 1; });
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
    var m = S.vals.filter(function (v) { return v.pcode_commune === r.pcode; });
    if (!m.length) return "";
    var connus = m.filter(function (v) { return v.statut_valeur !== "N"; });
    var o = OBJECTIFS[S.objectif] || {};

    /* Vingt-sept cartes d'un coup, personne ne les lit : la fiche s'ouvre sur
       les indicateurs que l'usage choisi met en premier, et le reste est à un
       clic. Si l'usage ne retient rien de documenté ici — une commune sans
       école ni centre de santé recensés, par exemple — on montre tout plutôt
       qu'une fiche vide. */
    var retenus = connus, masques = 0;
    if (o.cles && !S.ficheComplete) {
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
    } else if (S.ficheComplete && o.cles) {
      h.push('<p class="x-note"><button class="btn btn-outline x-btn-tout">' +
             TF("Revenir aux {n} indicateurs de cette vue", { n: o.cles.length }) +
             "</button></p>");
    }
    return h.join("");
  }

  /* ------------------------------------------------ histoire sismique (v49)
     Un historique, pas une carte d'aléa : ce qui s'est produit, quand, à
     quelle distance. Source USGS ComCat, domaine public (passeport PSP-029).

     Ce bloc n'écrit jamais qu'une commune a été « affectée » : la distance
     à un épicentre ne dit rien des dégâts, qui dépendent du sol, du bâti et
     de l'heure. Il dit « exposée », et il dit à quelle distance. */
  function blocSeismes(r) {
    /* Un conteneur vide, rempli quand la section approche de l'écran — même
       motif que les services et la pyramide. La première version rendait le
       HTML directement et ne s'affichait jamais : au moment du rendu, le
       JSON n'était pas encore arrivé, la fonction renvoyait une chaîne vide,
       et la section n'existait pas. Rien dans la console, aucune erreur : la
       fiche s'affichait simplement sans son histoire sismique. */
    return r.niveau_admin === "3"
      ? '<div id="x-seismes" class="x-pyr"><p class="x-note">' +
        T("Histoire sismique — chargement…") + "</p></div>"
      : "";
  }

  /* Le bloc charge SA donnée lui-même au lieu de se greffer sur la promesse
     des services. Cette greffe a coûté une soirée : le fichier partait bien,
     le module était à jour, et `S.seismes` restait vide sans qu'aucune
     erreur ne le dise. Un bloc qui dépend de l'ordre de résolution d'une
     promesse partagée avec quatre autres jeux est un bloc dont la panne
     n'est pas diagnosticable depuis la page.

     Le coût est nul : la requête part en parallèle des autres, et la
     promesse est gardée pour ne charger qu'une fois. */
  function chargerSeismes() {
    if (S.seismesPromesse) return S.seismesPromesse;
    S.seismesPromesse = charger(DIR + "atmart_seismes_communes.json", 1)
      .then(function (t) {
        S.seismes = JSON.parse(t);
        return S.seismes;
      })
      .catch(function () { S.seismes = null; return null; });
    return S.seismesPromesse;
  }

  function remplirSeismes(r) {
    var el = $("#x-seismes");
    if (!el) return;
    chargerSeismes().then(function () {
      var h = htmlSeismes(r);
      /* Si la donnée manque, on le DIT au lieu de laisser un vide : une
         section blanche laisse croire à un bug d'affichage, ce qui est
         moins utile qu'une phrase honnête. */
      el.innerHTML = h || ('<p class="x-note">' +
        T("L'historique sismique n'a pas pu être chargé — la fiche reste lisible sans lui.") +
        "</p>");
    });
  }

  function htmlSeismes(r) {
    var d = S.seismes && S.seismes.communes ? S.seismes.communes[r.pcode] : null;
    if (!d) return "";
    var meta = S.seismes.meta || {};
    var h = ['<h3>' + T("Histoire sismique") + "</h3>"];
    h.push('<p class="x-note">' +
      TF("{n25} séisme(s) de magnitude 4 ou plus documenté(s) à moins de 25 km, " +
         "{n50} à moins de 50 km, {n100} à moins de 100 km — catalogue {periode}.",
         { n25: d.n25, n50: d.n50, n100: d.n100, periode: esc(meta.periode || "") }) +
      "</p>");
    if (d.ev && d.ev.length) {
      h.push('<ul class="x-liste-seismes">');
      d.ev.forEach(function (e) {
        h.push("<li><b>M" + esc(e.m) + "</b> — " + esc(e.d) +
          " · " + TF("à {km} km", { km: e.km }) +
          (e.p !== "" && e.p != null ? " · " + TF("profondeur {p} km", { p: e.p }) : "") +
          "<br><small>" + esc(e.q) + " · " + esc(e.l) +
          (e.u ? ' · <a href="' + esc(e.u) + '" rel="noopener" target="_blank">' +
                 T("fiche USGS") + "</a>" : "") +
          "</small></li>");
      });
      h.push("</ul>");
    }
    h.push('<p class="x-src"><small>' +
      T("Source : USGS ComCat (domaine public). Distance mesurée de l'épicentre au contour de la commune.") +
      " " + esc(meta.avertissement || "") + "</small></p>");
    return h.join("");
  }

  /* ------------------------------------------------ pluie et sécheresse (v54)
     CHIRPS 2.0, domaine public (passeport PSP-030). Estimation modélisée qui
     combine satellite et stations au sol — pas un pluviomètre, et la fiche le
     dit. La normale suit la période de référence de l'OMM, 1991-2020. */
  function blocPluie(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-pluie" class="x-pyr"><p class="x-note">' +
        T("Pluie et sécheresse — chargement…") + "</p></div>"
      : "";
  }

  function chargerPluie() {
    if (S.pluiePromesse) return S.pluiePromesse;
    S.pluiePromesse = charger(DIR + "atmart_pluie_communes.json", 1)
      .then(function (t) { S.pluie = JSON.parse(t); return S.pluie; })
      .catch(function () { S.pluie = null; return null; });
    return S.pluiePromesse;
  }

  function remplirPluie(r) {
    var el = $("#x-pluie");
    if (!el) return;
    chargerPluie().then(function () {
      var h = htmlPluie(r);
      el.innerHTML = h || ('<p class="x-note">' +
        T("Les données de pluie n'ont pas pu être chargées — la fiche reste lisible sans elles.") +
        "</p>");
    });
  }

  function htmlPluie(r) {
    var d = S.pluie && S.pluie.communes ? S.pluie.communes[r.pcode] : null;
    if (!d || !d.n) return "";
    var m = S.pluie.meta || {};
    var h = ["<h3>" + T("Pluie et sécheresse") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "Il tombe en moyenne {n} mm par an sur cette commune ({normale}). " +
      "En {a}, il en est tombé {c} mm, soit {ec} % par rapport à la normale.",
      { n: esc(d.n), normale: esc(m.normale || ""), a: esc(d.a),
        c: esc(d.c), ec: esc(d.ec > 0 ? "+" + d.ec : d.ec) }) + "</p>");
    h.push('<p class="x-note">' + TF(
      "{ms} mois sur {mo} observés depuis 1981 ont été très secs, soit {ps} % — " +
      "un mois est dit très sec quand il tombe sous le cinquième le plus sec " +
      "des mois de son propre calendrier.",
      { ms: esc(d.ms), mo: esc(d.mo), ps: esc(d.ps) }) + "</p>");
    if (d.mode === "pixel_du_centroide") {
      h.push('<p class="x-limite">' + T(
        "Cette commune est plus petite que la maille de la mesure (environ " +
        "5,5 km) : la valeur est celle du carré qui contient son centre, et " +
        "non une moyenne sur son territoire.") + "</p>");
    }
    h.push('<p class="x-src"><small>' + esc(m.source || "") + " · " +
           esc(m.avertissement || "") + "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------- occupation du sol (v55)
     ESA WorldCover 2021, 10 m, CC BY 4.0 (passeport PSP-026). Classification
     satellitaire : un pixel « bâti » n'est pas une maison habitée, un pixel
     « cultures » ne dit ni ce qui pousse ni si la parcelle a produit. La
     fiche l'écrit, parce que le mot « cultures » invite à le croire. */
  function blocSol(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-sol" class="x-pyr"><p class="x-note">' +
        T("Occupation du sol — chargement…") + "</p></div>"
      : "";
  }

  function chargerSol() {
    if (S.solPromesse) return S.solPromesse;
    S.solPromesse = charger(DIR + "atmart_occupation_sol.json", 1)
      .then(function (t) { S.sol = JSON.parse(t); return S.sol; })
      .catch(function () { S.sol = null; return null; });
    return S.solPromesse;
  }

  function remplirSol(r) {
    var el = $("#x-sol");
    if (!el) return;
    chargerSol().then(function () {
      var h = htmlSol(r);
      el.innerHTML = h || ('<p class="x-note">' +
        T("L'occupation du sol n'a pas pu être chargée — la fiche reste lisible sans elle.") +
        "</p>");
    });
  }

  function htmlSol(r) {
    var d = S.sol && S.sol.communes ? S.sol.communes[r.pcode] : null;
    if (!d || !d.p) return "";
    var m = S.sol.meta || {}, noms = m.noms || {};
    var cles = Object.keys(d.p).sort(function (a, b) { return d.p[b] - d.p[a]; });
    var h = ["<h3>" + T("Occupation du sol") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "Sur les {km2} km² de la commune, mesurés au satellite en {an} :",
      { km2: esc(d.km2), an: esc(m.millesime || "") }) + "</p>");
    h.push('<ul class="x-liste-sol">');
    cles.forEach(function (c) {
      h.push("<li><b>" + esc(d.p[c]) + " %</b> " + esc(noms[c] || c) +
             '<span class="x-barre" style="width:' + Math.min(100, d.p[c]) +
             '%"></span></li>');
    });
    h.push("</ul>");
    h.push('<p class="x-src"><small>' + esc(m.attribution || "") + " · " +
           esc(m.avertissement || "") + "</small></p>");
    return h.join("");
  }

  /* --------------------------------------- population modélisée (v56)
     WorldPop 2020 ajusté ONU, CC BY 4.0 (passeport PSP-040). Ce bloc ne
     remplace JAMAIS la population officielle affichée plus haut : il donne
     un second avis, et publie l'écart entre les deux. Un écart important ne
     désigne pas un coupable — il signale un endroit où deux méthodes ne
     s'accordent pas, ce qui mérite d'être su. */
  function blocPopMod(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-popmod" class="x-pyr"></div>' : "";
  }

  function chargerPopMod() {
    if (S.popModPromesse) return S.popModPromesse;
    S.popModPromesse = charger(DIR + "atmart_population_modelisee.json", 1)
      .then(function (t) { S.popMod = JSON.parse(t); return S.popMod; })
      .catch(function () { S.popMod = null; return null; });
    return S.popModPromesse;
  }

  function remplirPopMod(r) {
    var el = $("#x-popmod");
    if (!el) return;
    chargerPopMod().then(function () { el.innerHTML = htmlPopMod(r); });
  }

  function htmlPopMod(r) {
    var d = S.popMod && S.popMod.communes ? S.popMod.communes[r.pcode] : null;
    if (!d || !d.m) return "";
    var m = S.popMod.meta || {}, ec = parseFloat(d.e);
    var h = ["<h3>" + T("Un second avis sur la population") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "Le satellite estime {m} habitants en 2020 ; la source officielle en " +
      "compte {o}. Écart : {e} %.",
      { m: esc(d.m), o: esc(d.o || "—"), e: esc(ec > 0 ? "+" + d.e : d.e) }) +
      "</p>");
    if (Math.abs(ec) >= 25) {
      h.push('<p class="x-limite">' + T(
        "Les deux méthodes divergent nettement ici. Ni l'une ni l'autre n'est " +
        "corrigée : l'écart est publié tel quel, pour que la décision se " +
        "prenne en le sachant.") + "</p>");
    }
    h.push('<p class="x-src"><small>' + esc(m.source || "") + " · " +
           esc(m.avertissement || "") + "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- propriétés des sols (SoilGrids)
     SoilGrids 2.0, ISRIC, CC BY 4.0 (passeport PSP-027). PRÉDICTION par
     apprentissage automatique à 250 m, jamais une analyse de sol : elle ne
     fonde aucune recommandation agronomique à la parcelle.

     SoilGrids ne prédit rien sous l'eau ni sous le bâti dense. La couverture
     est donc affichée, et le drapeau passe AVANT les valeurs quand elle est
     faible — à Delmas, la moyenne repose sur 1,5 % du territoire. */
  function blocSols(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-sols" class="x-pyr"><p class="x-note">' +
        T("Propriétés des sols — chargement…") + "</p></div>"
      : "";
  }

  function chargerSols() {
    if (S.solsPromesse) return S.solsPromesse;
    S.solsPromesse = charger(DIR + "atmart_sols_communes.json", 1)
      .then(function (t) { S.sols = JSON.parse(t); return S.sols; })
      .catch(function () { S.sols = null; return null; });
    return S.solsPromesse;
  }

  function remplirSols(r) {
    var el = $("#x-sols");
    if (!el) return;
    chargerSols().then(function () {
      var h = htmlSols(r);
      el.innerHTML = h || ('<p class="x-note">' + T("Les données de sol n'ont pas pu être chargées — la fiche reste lisible sans elles.") + "</p>");
    });
  }

  function htmlSols(r) {
    var d = S.sols && S.sols.communes ? S.sols.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.sols.meta || {};
    var h = ["<h3>" + T("Ce que dit le sol") + "</h3>"];
    if (d.fiab === "faible") {
      h.push('<p class="x-limite">' + TF(
        "Attention : la prédiction ne couvre que {c} % de cette commune — le " +
        "modèle ne décrit ni l'eau ni le bâti dense. Les valeurs ci-dessous " +
        "portent sur les interstices non bâtis, pas sur l'ensemble du territoire.",
        { c: esc(d.couv) }) + "</p>");
    }
    h.push('<p class="x-note">' + TF(
      "pH {ph} — sol {reaction}. Carbone organique {soc} g/kg.",
      { ph: esc(d.ph), reaction: esc(d.reaction), soc: esc(d.soc_g_kg) }) + "</p>");
    h.push('<ul class="x-liste-sol">');
    [["argile", d.argile], ["sable", d.sable], ["limon", d.limon]].forEach(function (p) {
      h.push("<li><b>" + esc(p[1]) + " %</b> " + T(p[0]) +
             '<span class="x-barre" style="width:' + Math.min(100, p[1]) + '%"></span></li>');
    });
    h.push("</ul>");
    h.push('<p class="x-note">' + TF("Texture dominante : {t}.", { t: esc(d.texture) }) + "</p>");
    if (d.fiab === "partielle") {
      h.push('<p class="x-limite">' + TF(
        "La prédiction couvre {c} % de la commune : l'eau et le bâti dense en " +
        "sont exclus.", { c: esc(d.couv) }) + "</p>");
    }
    h.push('<p class="x-src"><small>' + esc(m.attribution || m.source || "") +
           " · " + esc(m.avertissement || "") + "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- cyclones (IBTrACS)
     NOAA IBTrACS v04r01, accès complet et ouvert (passeport PSP-028).
     Un historique de TRAJECTOIRES, pas de dommages : le vent affiché est
     celui mesuré au centre du système, jamais celui subi dans la commune.
     Le statut reste « exposé » — Jeanne est passée à 78 km des Gonaïves en
     2004 et y a fait des milliers de morts : la distance ne dit rien. */
  function blocCyclones(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-cyclones" class="x-pyr"><p class="x-note">' +
        T("Cyclones — chargement…") + "</p></div>"
      : "";
  }

  function chargerCyclones() {
    if (S.cyclonesPromesse) return S.cyclonesPromesse;
    S.cyclonesPromesse = charger(DIR + "atmart_cyclones_communes.json", 1)
      .then(function (t) { S.cyclones = JSON.parse(t); return S.cyclones; })
      .catch(function () { S.cyclones = null; return null; });
    return S.cyclonesPromesse;
  }

  function remplirCyclones(r) {
    var el = $("#x-cyclones");
    if (!el) return;
    chargerCyclones().then(function () {
      var h = htmlCyclones(r);
      el.innerHTML = h || ('<p class="x-note">' + T("L'historique des cyclones n'a pas pu être chargé — la fiche reste lisible sans lui.") + "</p>");
    });
  }

  function htmlCyclones(r) {
    var d = S.cyclones && S.cyclones.communes ? S.cyclones.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.cyclones.meta || {};
    var h = ["<h3>" + T("Cyclones passés à proximité") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "{n25} systèmes sont passés à moins de 25 km, {n50} à moins de 50 km, " +
      "{n100} à moins de 100 km depuis {periode}. Parmi eux, {our} ouragans " +
      "dont {maj} majeurs.",
      { n25: esc(d.n25), n50: esc(d.n50), n100: esc(d.n100),
        periode: esc(m.periode || ""), our: esc(d.our), maj: esc(d.maj) }) + "</p>");
    if (d.vmax) {
      h.push('<p class="x-note">' + TF(
        "Vent le plus fort mesuré au centre d'un système approchant : {v} nœuds " +
        "({kmh} km/h) — {cat}.",
        { v: esc(d.vmax), kmh: esc(d.vmaxkmh), cat: esc(d.cat || "") }) + "</p>");
    }
    if (d.ev && d.ev.length) {
      h.push('<ul class="x-liste-seismes">');
      d.ev.forEach(function (e) {
        h.push("<li><b>" + esc(e.n || "sans nom") + "</b> — " + esc(e.d) +
          " · " + TF("à {km} km", { km: e.km }) +
          (e.v ? " · " + TF("{v} nœuds au centre", { v: e.v }) : "") +
          (e.q ? "<br><small>" + esc(e.q) + "</small>" : "") + "</li>");
      });
      h.push("</ul>");
    }
    h.push('<p class="x-limite">' + T(
      "Un cyclone passé près d'ici ne prouve aucun dommage, et un cyclone " +
      "passé loin n'en exclut aucun : en 2004, Jeanne est restée à 78 km des " +
      "Gonaïves et y a fait des milliers de morts.") + "</p>");
    h.push('<p class="x-src"><small>' + esc(m.source || "") + " · " +
           esc(m.citation || "") + "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- eau de surface (JRC)
     JRC Global Surface Water, Copernicus, sans restriction d'usage
     (passeport PSP-038). Trente-huit ans d'observation Landsat.

     Le JRC cartographie aussi la mer : une commune littorale récupère une
     frange de pixels marins. Sa part d'eau se lit donc comme un MAJORANT,
     et la fiche le dit là où ça compte. */
  function blocEau(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-eau" class="x-pyr"><p class="x-note">' +
        T("Eau de surface — chargement…") + "</p></div>"
      : "";
  }

  function chargerEau() {
    if (S.eauPromesse) return S.eauPromesse;
    S.eauPromesse = charger(DIR + "atmart_eau_surface.json", 1)
      .then(function (t) { S.eau = JSON.parse(t); return S.eau; })
      .catch(function () { S.eau = null; return null; });
    return S.eauPromesse;
  }

  function remplirEau(r) {
    var el = $("#x-eau");
    if (!el) return;
    chargerEau().then(function () {
      var h = htmlEau(r);
      el.innerHTML = h || ('<p class="x-note">' + T("Les données d'eau de surface n'ont pas pu être chargées — la fiche reste lisible sans elles.") + "</p>");
    });
  }

  function htmlEau(r) {
    var d = S.eau && S.eau.communes ? S.eau.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.eau.meta || {};
    var h = ["<h3>" + T("Eau de surface") + "</h3>"];
    if (!d.pt) {
      h.push('<p class="x-note">' + T(
        "Aucune eau de surface détectée sur cette commune entre 1984 et 2021. " +
        "C'est une mesure, pas une absence de donnée.") + "</p>");
    } else {
      h.push('<p class="x-note">' + TF(
        "{pp} % du territoire est en eau permanente et {ps} % en eau " +
        "saisonnière, soit {km2} km² d'eau au total.",
        { pp: esc(d.pp), ps: esc(d.ps),
          km2: esc(Math.round((d.kp + d.ks) * 100) / 100) }) + "</p>");
      h.push('<ul class="x-liste-sol">');
      [["eau permanente", d.pp], ["eau saisonnière", d.ps]].forEach(function (p) {
        if (p[1] > 0) {
          h.push("<li><b>" + esc(p[1]) + " %</b> " + T(p[0]) +
                 '<span class="x-barre" style="width:' + Math.min(100, p[1] * 3) +
                 '%"></span></li>');
        }
      });
      h.push("</ul>");
    }
    h.push('<p class="x-limite">' + T(
      "Le satellite ne distingue pas la mer d'un lac : sur une commune " +
      "littorale, une frange de pixels marins est comptée en eau permanente. " +
      "La part affichée s'y lit comme un maximum.") + "</p>");
    h.push('<p class="x-src"><small>' + esc(m.attribution || m.source || "") +
           " · " + T("période") + " 1984-2021</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- potentiel solaire (Global Solar Atlas)
     Global Solar Atlas 2.0, Banque mondiale / ESMAP / Solargis, CC BY 4.0
     (passeport PSP-036). RÉSULTAT DE MODÈLE, jamais une étude de
     faisabilité : il ne dit rien du raccordement au réseau, du foncier,
     ni de l'ombrage local. La fiche l'écrit sous les chiffres. */
  function blocSolaire(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-solaire" class="x-pyr"><p class="x-note">' +
        T("Potentiel solaire — chargement…") + "</p></div>"
      : "";
  }

  function chargerSolaire() {
    if (S.solairePromesse) return S.solairePromesse;
    S.solairePromesse = charger(DIR + "atmart_solaire_communes.json", 1)
      .then(function (t) { S.solaire = JSON.parse(t); return S.solaire; })
      .catch(function () { S.solaire = null; return null; });
    return S.solairePromesse;
  }

  function remplirSolaire(r) {
    var el = $("#x-solaire");
    if (!el) return;
    chargerSolaire().then(function () {
      var h = htmlSolaire(r);
      el.innerHTML = h || ('<p class="x-note">' + T("Les données solaires n'ont pas pu être chargées — la fiche reste lisible sans elles.") + "</p>");
    });
  }

  function htmlSolaire(r) {
    var d = S.solaire && S.solaire.communes ? S.solaire.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.solaire.meta || {};
    var h = ["<h3>" + T("Potentiel solaire") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "Une installation photovoltaïque produirait en moyenne {pv} kWh par " +
      "kilowatt-crête et par an sur cette commune, entre {min} et {max} selon " +
      "l'endroit.",
      { pv: esc(d.pvout_moyen), min: esc(d.pvout_min), max: esc(d.pvout_max) }) +
      "</p>");
    if (d.ghi_moyen) {
      h.push('<p class="x-note">' + TF(
        "Irradiation globale reçue : {ghi} kWh par m² et par an.",
        { ghi: esc(d.ghi_moyen) }) + "</p>");
    }
    h.push('<p class="x-limite">' + T(
      "Ce chiffre sort d'un modèle météorologique, pas d'une étude de " +
      "faisabilité. Il ne dit rien du raccordement au réseau, du foncier " +
      "disponible, ni de l'ombrage d'un site précis.") + "</p>");
    h.push('<p class="x-src"><small>' + esc(m.source || "") +
           (m.periode_modelisee ? " · " + esc(m.periode_modelisee) : "") +
           "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- bâtiments (Google Open Buildings)
     Google Open Buildings V3, CC BY 4.0 (passeport PSP-025). Un bâtiment
     détecté n'est NI un ménage, NI un commerce, NI un logement habité :
     c'est une empreinte vue du ciel, sur une imagerie d'âge inconnu.

     Le seuil de confiance retenu est publié parce qu'il DÉTERMINE le
     résultat : à 0,75 on garde 57 % des détections, à 0,90 il n'en
     resterait que 1,6 %. Le même territoire, quinze fois moins bâti. */
  function blocBatiments(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-batiments" class="x-pyr"><p class="x-note">' +
        T("Bâtiments — chargement…") + "</p></div>"
      : "";
  }

  function chargerBatiments() {
    if (S.batimentsPromesse) return S.batimentsPromesse;
    S.batimentsPromesse = charger(DIR + "atmart_batiments_communes.json", 1)
      .then(function (t) { S.batiments = JSON.parse(t); return S.batiments; })
      .catch(function () { S.batiments = null; return null; });
    return S.batimentsPromesse;
  }

  function remplirBatiments(r) {
    var el = $("#x-batiments");
    if (!el) return;
    chargerBatiments().then(function () {
      var h = htmlBatiments(r);
      el.innerHTML = h || ('<p class="x-note">' + T("Les données de bâtiments n'ont pas pu être chargées — la fiche reste lisible sans elles.") + "</p>");
    });
  }

  function htmlBatiments(r) {
    var d = S.batiments && S.batiments.communes ? S.batiments.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.batiments.meta || {};
    var h = ["<h3>" + T("Bâtiments détectés") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "{nb} empreintes de bâtiments sont détectées, soit {dens} par km² et " +
      "{part} % du territoire couvert. Surface moyenne : {moy} m².",
      { nb: esc(d.nb), dens: esc(d.dens), part: esc(d.part), moy: esc(d.moy) }) +
      "</p>");
    if (d.sous) {
      h.push('<p class="x-note">' + TF(
        "{sous} détections supplémentaires ont été écartées, sous le seuil de " +
        "confiance de {seuil} retenu.",
        { sous: esc(d.sous), seuil: esc(m.seuil_confiance || "0,75") }) + "</p>");
    }
    h.push('<p class="x-limite">' + T(
      "Une empreinte n'est ni un ménage, ni un commerce, ni un logement " +
      "habité. Le producteur signale des faux positifs sur les roches et la " +
      "végétation, des bâtiments contigus mal séparés, et une imagerie dont " +
      "l'âge n'est pas connu.") + "</p>");
    h.push('<p class="x-src"><small>' + esc(m.attribution || m.source || "") +
           "</small></p>");
    return h.join("");
  }

  /* ---------------------------------------------------------- croissance du bâti (GHSL)
     GHSL R2023A, Commission européenne / JRC, CC BY 4.0 (passeport
     PSP-039). Quatre millésimes — 1990, 2000, 2010, 2020 — mesurés par
     le MÊME instrument et le même algorithme : la croissance qu'ils
     montrent est donc lisible, contrairement à l'écart WorldCover
     2020/2021 qui mêle changement réel et changement de méthode.

     Le producteur exige la citation de l'article de référence en plus du
     site : il écrit qu'une citation du site seul est « insufficient and
     considered inappropriate ». */
  function blocUrbanisation(r) {
    return r.niveau_admin === "3"
      ? '<div id="x-urbanisation" class="x-pyr"><p class="x-note">' +
        T("Croissance du bâti — chargement…") + "</p></div>"
      : "";
  }

  function chargerUrbanisation() {
    if (S.urbanisationPromesse) return S.urbanisationPromesse;
    S.urbanisationPromesse = charger(DIR + "atmart_urbanisation_communes.json", 1)
      .then(function (t) { S.urbanisation = JSON.parse(t); return S.urbanisation; })
      .catch(function () { S.urbanisation = null; return null; });
    return S.urbanisationPromesse;
  }

  function remplirUrbanisation(r) {
    var el = $("#x-urbanisation");
    if (!el) return;
    chargerUrbanisation().then(function () {
      var h = htmlUrbanisation(r);
      el.innerHTML = h || ('<p class="x-note">' + T("Les données d'urbanisation n'ont pas pu être chargées — la fiche reste lisible sans elles.") + "</p>");
    });
  }

  function htmlUrbanisation(r) {
    var d = S.urbanisation && S.urbanisation.communes ? S.urbanisation.communes[r.pcode] : null;
    if (!d) return "";
    var m = S.urbanisation.meta || {};
    var h = ["<h3>" + T("Comment le bâti a grandi") + "</h3>"];
    h.push('<p class="x-note">' + TF(
      "La surface bâtie est passée de {b90} km² en 1990 à {b20} km² en 2020, " +
      "soit {cr} km² de plus — une croissance de {crp} %. La commune est " +
      "aujourd'hui bâtie à {p20} % de son territoire.",
      { b90: esc(arr(d.b90, 2)), b20: esc(arr(d.b20, 2)),
        cr: esc(arr(d.cr, 2)), crp: esc(arr(d.crp, 0)),
        p20: esc(arr(d.p20, 1)) }) + "</p>");
    h.push('<ul class="x-liste-sol">');
    [["1990", d.b90], ["2000", d.b00], ["2010", d.b10], ["2020", d.b20]]
      .forEach(function (p) {
        h.push("<li><b>" + esc(arr(p[1], 2)) + " km²</b> " + esc(p[0]) +
               '<span class="x-barre" style="width:' +
               Math.min(100, (p[1] / (d.b20 || 1)) * 100) + '%"></span></li>');
      });
    h.push("</ul>");
    if (d.sd) {
      h.push('<p class="x-note">' + TF(
        "Degré d'urbanisation dominant : {sd}. Part urbaine du territoire : " +
        "{su} % en 2020, contre {su90} % en 1990.",
        { sd: esc(d.sd), su: esc(arr(d.su, 1)), su90: esc(arr(d.su90, 1)) }) + "</p>");
    }
    h.push('<p class="x-limite">' + T(
      "Le degré d'urbanisation est ici pondéré par la SURFACE, alors que la " +
      "classification officielle se pondère par la population : une commune " +
      "vaste avec un gros bourg ressort « rurale » ici. Et la grille du " +
      "degré d'urbanisation fait 1 km — sur une petite commune, c'est un " +
      "ordre de grandeur, pas une mesure.") + "</p>");
    h.push('<p class="x-src"><small>' + esc(m.attribution || m.source || "") +
           "</small></p>");
    return h.join("");
  }

  /* Afficher une précision qu'on n'a pas est une façon discrète de mentir
     sur la qualité de la donnée : une surface mesurée à 30 mètres de
     résolution n'a pas quatre décimales de kilomètre carré. */
  function arr(v, n) {
    var x = parseFloat(v);
    return isNaN(x) ? v : x.toFixed(n).replace(/\.?0+$/, "").replace(".", ",");
  }

  function blocLacunes(r) {
    var m = S.vals.filter(function (v) { return v.pcode_commune === r.pcode; });
    var absents = m.filter(function (v) { return v.statut_valeur === "N"; });
    /* Même liste que celle comptée par le bouton « Ce qui reste à documenter » :
       deux calculs séparés finiraient par diverger. */
    var bloques = S.indBloques;
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
    var nCom = S.terr.filter(function (x) { return x.niveau_admin === "3"; }).length;
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

  /* ------------------------------------------------- longueur de la fiche
     Une fiche complète fait plusieurs écrans de défilement : c'est trop pour
     qui vient chercher un chiffre, et pas assez pour qui prépare un dossier.
     Trois longueurs, donc, choisies par le lecteur et mémorisées — jamais
     imposées. « Moyen » reste le défaut.

     Aucune donnée n'est cachée : ce qui n'est pas affiché est à un clic, et
     le sélecteur DIT ce que la longueur active montre. Masquer sans le dire
     serait une autre façon de mentir sur ce que le site sait. */
  var VUES = {
    court: { l: "Court", b: { resume: 1, indicateurs: 1, lacunes: 1 },
             d: "l'essentiel : les chiffres et ce qui manque" },
    moyen: { l: "Moyen", b: { resume: 1, carte: 1, objectif: 1, indicateurs: 1,
                              services: 1, comparer: 1, lacunes: 1, enfants: 1 },
             d: "avec la carte, les services et la comparaison" },
    complet: { l: "Complet", b: null,
               d: "tout, y compris pyramide, prix et informations techniques" }
  };

  function vueCourante() {
    var v = S.vue;
    if (!v) { try { v = localStorage.getItem("atmart_vue"); } catch (e) {} }
    return VUES[v] ? v : "moyen";
  }

  function montrer(bloc) {
    var v = VUES[vueCourante()];
    return !v.b || v.b[bloc] === 1;
  }

  function selecteurVue() {
    var a = vueCourante();
    return '<div class="x-vues" role="group" aria-label="' + T("Longueur de la fiche") + '">' +
      Object.keys(VUES).map(function (k) {
        return '<button type="button" class="x-vue' + (k === a ? " actif" : "") +
          '" data-vue="' + k + '" aria-pressed="' + (k === a) + '" title="' +
          T(VUES[k].d) + '">' + T(VUES[k].l) + "</button>";
      }).join("") + "<small>" + T(VUES[a].d) + "</small></div>";
  }

  function fiche(id) {
    var r = parId[id];
    if (!r) return;
    S.courant = r;
    var h = [S.montrerAccueil ? blocAccueil(r) : "", blocResume(r), selecteurVue()];
    if (montrer("carte")) h.push(blocCarte(r));
    if (r.niveau_admin === "3") {
      h.push(montrer("objectif") ? blocObjectif(r) : "", blocIndicateurs(r),
             montrer("pyramide") ? blocPyramide(r) : "",
             montrer("prix") ? blocPrix(r) : "",
             montrer("services") ? blocServices(r) : "",
             montrer("services") ? blocSeismes(r) : "",
             montrer("services") ? blocPluie(r) : "",
             montrer("services") ? blocSol(r) : "",
             montrer("services") ? blocPopMod(r) : "",
             montrer("services") ? blocUrbanisation(r) : "",
             montrer("services") ? blocBatiments(r) : "",
             montrer("services") ? blocSolaire(r) : "",
             montrer("services") ? blocEau(r) : "",
             montrer("services") ? blocCyclones(r) : "",
             montrer("services") ? blocSols(r) : "",
             montrer("comparer") ? blocComparer(r) : "",
             montrer("lacunes") ? blocLacunes(r) : "");
    } else if (r.niveau_admin === "0") {
      /* La fiche du pays : repères nationaux d'abord (ce qui n'existe qu'à ce
         niveau), puis le même agrégat que pour un département. Pas de bloc
         technique : l'entité est synthétique, ses métadonnées sont celles de
         ses sources, affichées repère par repère. */
      h.push(blocNat(), agregat(r), blocPyramide(r));
    } else h.push(agregat(r), blocPyramide(r));
    if (r.niveau_admin !== "0" && montrer("organisations")) h.push(blocOrganisations(r));
    if (montrer("enfants")) h.push(blocEnfants(r));
    if (montrer("verrou")) h.push(blocVerrou(r));
    if (r.niveau_admin !== "0" && montrer("technique")) h.push(blocTechnique(r));
    $("#x-fiche").innerHTML = h.join("");
    $("#x-fiche").hidden = false;
    observerPyramide(r);
    aLApproche("#x-prix", remplirPrix, r);
    aLApproche("#x-nat", remplirNat, r);
    aLApproche("#x-services", remplirServices, r);
    /* Appel DIRECT et non « à l'approche » : le conteneur naissait vide,
       donc haut de zéro pixel, et l'observateur d'intersection ne se
       déclenchait jamais. Le bloc restait blanc indéfiniment. */
    remplirSeismes(r);
    remplirPluie(r);
    remplirSol(r);
    remplirPopMod(r);
    remplirUrbanisation(r);
    remplirBatiments(r);
    remplirSolaire(r);
    remplirEau(r);
    remplirCyclones(r);
    remplirSols(r);
    var t = $("#x-titre-fiche");
    if (t) t.textContent = nomT(r);
    majURL();
    annoncer(TF("Fiche de {nom} affichée.", { nom: nomT(r) }));
  }

  function majURL() {
    if (!S.courant) return;
    var q = "?id=" + S.courant.atmart_geo_id +
            (S.objectif !== "tout" ? "&objectif=" + S.objectif : "") +
            (S.comparees.length ? "&comparer=" + S.comparees.join(",") : "") +
            (S.ongletActif !== "fiche" ? "&onglet=" + S.ongletActif : "") +
            (S.niveauComp !== "3" ? "&niveau=" + S.niveauComp : "") +
            (S.normalisation !== "total" ? "&norm=" + S.normalisation : "") +
            (S.ficheComplete ? "&complet=1" : "") +
            /* Neuvième paramètre d'état. Sans lui, un lien copié depuis une
               fiche en kreyòl se rouvrait en français chez le destinataire :
               tout l'état était partageable sauf la langue dans laquelle on
               avait lu. */
            (S.LANG !== "fr" ? "&lang=" + S.LANG : "");
    var si = $("#x-indicateur");
    if (si && si.value && si.value !== "IND-QUA-001") q += "&ind=" + si.value;
    try { history.replaceState(null, "", q); } catch (e) {}
  }

  Object.assign(A, {OBJECTIFS, fil, situe, synthese, blocResume, chargerPyramide, libTranche, pyramideDe, pct, pasAxe, svgPyramide, tablePyramide, blocPyramide, observerPyramide, aLApproche, remplirPyramide, traitsDistinctifs, lacunesLisibles, avertissements, FENETRE, chargerPrix, pasRond, svgSerie, blocPrix, remplirPrix, chargerNat, blocNat, remplirNat, chargerServices, blocServices, sectionServices, remplirServices, blocSeismes, chargerSeismes, remplirSeismes, htmlSeismes, blocPluie, chargerPluie, remplirPluie, htmlPluie, blocSol, chargerSol, remplirSol, htmlSol, blocPopMod, chargerPopMod, remplirPopMod, htmlPopMod, blocObjectif, blocAccueil, blocIndicateurs, blocSols, chargerSols, remplirSols, htmlSols, blocCyclones, chargerCyclones, remplirCyclones, htmlCyclones, blocEau, chargerEau, remplirEau, htmlEau, blocSolaire, chargerSolaire, remplirSolaire, htmlSolaire, blocBatiments, chargerBatiments, remplirBatiments, htmlBatiments, blocUrbanisation, chargerUrbanisation, remplirUrbanisation, htmlUrbanisation, blocLacunes, blocComparer, blocTechnique, blocOrganisations, blocEnfants, blocVerrou, agregat, fiche, majURL});
}
