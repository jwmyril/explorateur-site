/* Module « carte » du moteur — découpé le 16/08/2026.
   Le code est celui d'explorateur.js, déplacé verbatim : seules les
   variables réassignées ont pris le préfixe S. de l'état partagé.
   A porte les fonctions des autres modules. */
import { S } from "./etat.js";
export default function (A) {
  /* Ce que ce module reçoit des autres — calculé, jamais listé à la main. */
  const { SITE, T, TF, TN, aggEntite, communesDe, enfantsDe, esc, nb, nomT, parId, rang } = A;
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
    if (!S.contour) return "";
    var L = 760, H = 420, M = 14;

    /* Cadrage. À l'échelle du pays, une commune de la zone métropolitaine
       mesure treize pixels de côté : Port-au-Prince s'y confondait avec le
       département de l'Ouest, alors que son contour était bien tracé et bien
       mis en évidence. Il était trop petit pour se voir.

       Quand la fiche est une commune, on cadre donc sur son département. Les
       communes voisines restent visibles et cliquables ; la bascule
       « Départements » ramène à la vue du pays. */
    var cadreSur = null;
    if (r.niveau_admin === "3" && S.polyDep && (S.carteNiveau || "3") === "3") {
      var dep = departementDe(r);
      if (dep) {
        var fd = S.polyDep.filter(function (f) {
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
      S.contour.forEach(function (poly) {
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

    var chemins = S.contour.map(function (poly) {
      return "M" + poly[0].map(function (p) {
        return px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1); }).join("L") + "Z";
    }).join(" ");

    /* quelles communes mettre en avant : celles du même parent */
    var famille = {};
    if (r.niveau_admin === "3") {
      (enfantsDe[r.parent_atmart_geo_id] || []).forEach(function (x) { famille[x.atmart_geo_id] = 1; });
    } else {
      S.terr.forEach(function (x) {
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
    var niv = S.carteNiveau || auto;
    var couche = niv === "3" ? S.polyCom : S.polyDep;
    var fond = niv === "3" ? S.polyDep : S.polyCom;

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
    var pts = S.terr.filter(function (x) {
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

    var bascule = (S.polyDep && S.polyCom) ?
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
    S.vals.forEach(function (v) {
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
      h.push("<td><b>" + tot + "/" + S.nCommunes + "</b></td></tr>");
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
    return S.terr.filter(function (e) { return e.niveau_admin === niv; });
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
      var v = S.vals.filter(function (x) {
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

  Object.assign(A, {anneauxDe, departementDe, blocCarte, matriceCouverture, entitesDuNiveau, populationDe, valeurBrute, totalNational});
}
