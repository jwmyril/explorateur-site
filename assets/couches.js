/* Page Couches — visualisation des couches d'utilité publique.
   INDÉPENDANT du moteur explorateur.js : cette page a son propre cycle de
   vie pour que le chantier carte du moteur et celui-ci n'entrent jamais en
   collision. Mêmes principes produit : une couche à la fois, la légende
   porte source, licence, millésime et limite — jamais un aplat sans dire
   d'où il vient ni ce qu'il ne couvre pas. */
(function () {
  "use strict";
  var DV = "?d=2026-08-14b";
  var $ = function (s) { return document.querySelector(s); };
  var fmtN = function (v) { return (+v).toLocaleString("fr-FR"); };

  /* ------------------------------------------------------------- couches
     type "points"      : un GeoJSON de points, classé par une propriété ;
     type "choroplethe" : un CSV agrégé par commune, teinte par valeur ;
     type "aplat_dep"   : un CSV par département (IPC). */
  var COUCHES = [
    { id: "conflits", nom: "Conflits — 12 derniers mois (ACLED)", type: "choroplethe",
      csv: "data/atmart_conflits_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var mois = rows.map(function (r) { return r.mois; }).sort();
        var dernier = mois[mois.length - 1];
        var seuil = plage12(dernier);
        var m = {};
        rows.forEach(function (r) {
          if (r.mois >= seuil) m[r.pcode_commune] = (m[r.pcode_commune] || 0) + (+r.evenements || 0);
        });
        return { valeurs: m, periode: seuil + " à " + dernier,
                 unite: "événements rapportés" };
      },
      source: "ACLED via HDX — attribution acleddata.com obligatoire",
      limite: "Événements RAPPORTÉS : la couverture médiatique varie selon les zones — un faible chiffre peut refléter un faible signalement." },
    { id: "deplaces", nom: "Personnes déplacées présentes (OIM DTM)", type: "choroplethe",
      csv: "data/atmart_deplaces_HT.csv", pcode: "pcode",
      agreger: function (rows) {
        var m = {}, dates = [];
        rows.forEach(function (r) {
          if (r.niveau_admin !== "2") return;
          m[r.pcode] = +r.personnes_deplacees_presentes || 0;
          dates.push(String(r.date_rapport).slice(0, 10));
        });
        return { valeurs: m, periode: "dernière ronde (" + dates.sort().pop() + ")",
                 unite: "personnes déplacées présentes" };
      },
      source: "OIM — Displacement Tracking Matrix (via HDX)",
      limite: "Recensement des sites accessibles à l'OIM — pas un registre exhaustif des déplacés." },
    { id: "ipc", nom: "Insécurité alimentaire — phase IPC", type: "aplat_dep",
      csv: "data/atmart_ipc_HT.csv",
      source: "IPC — analyse de mars 2026 (CC0)",
      limite: "Classification d'experts par zone d'analyse, pas un comptage direct ; la situation « courante » est affichée, les projections sont dans le CSV." },
    { id: "eau", nom: "Points d'eau (WPdx)", type: "points",
      geojson: "data/atmart_couche_eau_HT.geojson",
      classes: { F: { c: "#2ec4b6", l: "fonctionnel" }, N: { c: "#e63946", l: "non fonctionnel" },
                 "?": { c: "#8d99ae", l: "statut inconnu" } }, prop: "s" },
    { id: "carburant", nom: "Stations-service (OSM)", type: "points",
      geojson: "data/atmart_couche_carburant_HT.geojson",
      classes: { "": { c: "#f4a261", l: "station-service" } }, prop: "" },
    { id: "finance", nom: "Banques et transferts (OSM)", type: "points",
      geojson: "data/atmart_couche_finance_HT.geojson",
      classes: { banque: { c: "#3a86ff", l: "banque" }, guichet: { c: "#7bb5ff", l: "guichet" },
                 transfert: { c: "#ffbe0b", l: "agence de transfert" },
                 change: { c: "#fb5607", l: "bureau de change" },
                 poste: { c: "#8338ec", l: "bureau de poste" } }, prop: "t" },
    { id: "inondation", nom: "Part de la commune en zone inondable (CNIGS)", type: "choroplethe",
      csv: "data/atmart_alea_inondation_communes_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) { m[r.pcode_commune] = +r.pct_zone_inondable || 0; });
        return { valeurs: m, periode: "zones cartographiées CNIGS, calcul Atmart du 14/08/2026",
                 unite: "% de la surface communale" };
      },
      source: "CNIGS via HaitiData — % calculé par Atmart (échantillonnage ~330 m)",
      limite: "Zones inondables CARTOGRAPHIÉES, pas un aléa probabiliste par période de retour — les cartes 5/25/100 ans de la Banque mondiale sont l'amélioration attendue. Ordre de grandeur, pas un cadastre." },
    { id: "inondable", nom: "Zones inondables — polygones (CNIGS)", type: "polygones",
      geojson: "data/atmart_couche_inondable_HT.geojson",
      style: { fill: "#3a86ff", opacity: 0.45 } },
    { id: "bassins", nom: "Bassins versants (SRTM 2014)", type: "polygones",
      geojson: "data/atmart_couche_bassins_HT.geojson",
      style: { fill: "#2a9d8f", opacity: 0.28, etiquette: "nom" } },
    { id: "sol", nom: "Occupation du sol — classe dominante (1998)", type: "choroplethe_classes",
      csv: "data/atmart_occupation_sol_communes_HT.csv",
      source: "CNIGS via HaitiData — millésime 1998, % calculés par Atmart",
      limite: "1998 : un quart de siècle — utile en tendance, jamais en état des lieux. Classe DOMINANTE par commune ; les parts complètes sont dans le CSV." },
    { id: "routes", nom: "Routes — kilomètres cartographiés (OSM)", type: "choroplethe",
      csv: "data/atmart_infrastructures_communes_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          if (r.famille === "routes") m[r.pcode_commune] = (m[r.pcode_commune] || 0) + (+r.valeur || 0);
        });
        Object.keys(m).forEach(function (k) { m[k] = Math.round(m[k]); });
        return { valeurs: m, periode: "extrait HOT du 06/08/2026", unite: "km cartographiés (tous types)" };
      },
      source: "OpenStreetMap via HOT — ODbL",
      limite: "Kilomètres CARTOGRAPHIÉS : mesure aussi la densité de cartographie. Tronçon affecté à la commune de son point médian (~100 m de tolérance)." }
  ];

  /* Couches ANNONCÉES mais pas encore construites : jamais dans le
     sélecteur actif — une section grisée les liste, avec le parrainage
     comme chemin. Le registre des sources dit pourquoi chacune attend. */
  var EN_PREPARATION = [
    { slug: "mobile_reel", nom: "Couverture mobile réelle (opérateurs)" },
    { slug: "sismique", nom: "Aléa sismique probabiliste (USGS)" },
    { slug: "hydro", nom: "Réseau hydrographique et sous-bassins" },
    { slug: "sol_recent", nom: "Occupation du sol récente (post-1998)" }
  ];
  var COUCHE_DEFAUT = "conflits";

  var IPC_COULEURS = { "1": "#cdfacd", "2": "#fae61e", "3": "#e67800", "4": "#c80000", "5": "#640000" };

  function plage12(dernierMois) {
    var a = +dernierMois.slice(0, 4), m = +dernierMois.slice(5, 7) - 11;
    while (m < 1) { m += 12; a -= 1; }
    return a + "-" + (m < 10 ? "0" : "") + m;
  }

  /* ------------------------------------------------- fond de carte partagé */
  var communes = null, departements = null, proj = null;
  var L = 860, H = 520, M = 16;

  function projeter(features) {
    var xs = [], ys = [];
    features.forEach(function (f) {
      anneaux(f.geometry).forEach(function (an) {
        an.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      });
    });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var kx = Math.cos((y0 + y1) / 2 * Math.PI / 180);
    var ech = Math.min((L - 2 * M) / ((x1 - x0) * kx), (H - 2 * M) / (y1 - y0));
    var dx = (L - (x1 - x0) * kx * ech) / 2, dy = (H - (y1 - y0) * ech) / 2;
    return { x: function (lon) { return dx + (lon - x0) * kx * ech; },
             y: function (lat) { return dy + (y1 - lat) * ech; } };
  }

  function anneaux(geom) {
    if (geom.type === "Polygon") return geom.coordinates;
    if (geom.type === "MultiPolygon")
      return geom.coordinates.reduce(function (a, p) { return a.concat(p); }, []);
    return [];
  }

  function chemin(geom) {
    return anneaux(geom).map(function (an) {
      return "M" + an.map(function (p) {
        return proj.x(p[0]).toFixed(1) + " " + proj.y(p[1]).toFixed(1);
      }).join("L") + "Z";
    }).join(" ");
  }

  /* Une connexion instable coupe une requête sur cinq : on retente deux
     fois, en espaçant, avant d'abandonner — même doctrine que le moteur. */
  function charger(u, essais) {
    essais = essais === undefined ? 2 : essais;
    /* 15 s par tentative : sur une 3G instable, mieux vaut un message et un
       bouton Réessayer qu'un « chargement… » éternel. */
    var coupe = new Promise(function (_, ko) {
      setTimeout(function () { ko(new Error("délai dépassé (15 s)")); }, 15000);
    });
    return Promise.race([fetch(u + DV), coupe]).then(function (r) {
      if (!r.ok) throw new Error(u + " : " + r.status);
      return r.text();
    }).catch(function (e) {
      if (essais <= 0) throw e;
      return new Promise(function (ok) { setTimeout(ok, 600); })
        .then(function () { return charger(u, essais - 1); });
    });
  }

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

  /* --------------------------------------------------------------- rendus */
  function fondCommunes(classe) {
    return communes.features.map(function (f) {
      return '<path class="' + classe + '" data-pcode="' + f.properties.pcode +
        '" data-id="' + f.properties.atmart_geo_id + '" d="' + chemin(f.geometry) +
        '"><title>' + f.properties.nom_fr + "</title></path>";
    }).join("");
  }

  function teinte(v, max) {
    if (!v) return "#eef2f6";
    var t = Math.pow(v / max, 0.45);   /* les distributions sont très asymétriques */
    var r = Math.round(254 - t * (254 - 158));
    var g = Math.round(232 - t * (232 - 27));
    var b = Math.round(200 - t * (200 - 49));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function rendreChoroplethe(couche, rows) {
    var agg = couche.agreger(rows);
    var vals = agg.valeurs;
    var max = 0;
    Object.keys(vals).forEach(function (k) { if (vals[k] > max) max = vals[k]; });
    var svg = communes.features.map(function (f) {
      var p = f.properties, v = vals[p.pcode];
      var doc = v !== undefined;
      return '<path class="k-com" data-id="' + p.atmart_geo_id + '" fill="' +
        (doc ? teinte(v, max) : "#eef2f6") + '" d="' + chemin(f.geometry) + '"><title>' + p.nom_fr +
        (doc ? " — " + fmtN(v) + " " + agg.unite : " — non documenté") + "</title></path>";
    }).join("");
    var leg = '<span class="k-grad"></span> 0 → ' + fmtN(max) + " " + agg.unite +
              " · " + agg.periode +
              (agg.couverture ? " · " + agg.couverture : "");
    dessiner(svg + nomsDepartements(), leg, couche);
  }

  function rendreIPC(couche, rows) {
    /* L'analyse publiée ne contient pas toujours de période « current » —
       celle de mars 2026 n'a que des projections. On prend la situation
       courante si elle existe, sinon la première période disponible, et la
       légende DIT laquelle est affichée. */
    var periodes = [];
    rows.forEach(function (r) {
      if (periodes.indexOf(r.periode_validite) < 0) periodes.push(r.periode_validite);
    });
    var periode = periodes.indexOf("current") > -1 ? "current" : periodes[0];
    var courants = rows.filter(function (r) { return r.periode_validite === periode; });
    var libPeriode = { current: "situation courante",
                       "first projection": "première projection",
                       "second projection": "seconde projection" }[periode] || periode;
    var duAu = courants.length ? courants[0].du + " → " + courants[0].au : "";
    /* PIÈGE : l'IPC numérote les départements avec SES codes (Artibonite y est
       « HT03 », il est HT05 au COD-AB). On rattache donc par NOM de
       département, insensible aux accents — les zones composées
       (« Sud+Grand'Anse ») s'appliquent à chaque département reconnu. */
    var sansAcc = function (s) {
      return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z]/g, "");
    };
    /* « Nord-est » contient « nord » : on essaie donc les noms du plus long au
       plus court et on ne garde QUE la première correspondance. Les zones
       urbaines et les plateaux du Centre sont rattachés à leur département
       par table explicite ; les camps de déplacés n'ont pas de département —
       ils restent au CSV, et la légende le dit. */
    var VILLES = { villedescayes: "HT07", villedeouanaminthe: "HT04",
                   villeducaphaitien: "HT03", villedesgonaives: "HT05",
                   basplateau: "HT06", hautplateau: "HT06" };
    var nomsDep = departements.features.map(function (f) {
      return { pc: f.properties.pcode, n: sansAcc(f.properties.nom_fr) };
    }).sort(function (a, b) { return b.n.length - a.n.length; });
    var parDep = {};
    var poser = function (pc, r) {
      /* le CSV porte aussi des lignes « all » (population totale) et « 3+ »
         (cumul) : les compter écraserait toujours la majorité — seules les
         phases 1 à 5 votent. */
      if (!/^[1-5]$/.test(String(r.phase_ipc))) return;
      var d = parDep[pc] || (parDep[pc] = { phases: {}, date: r.date_analyse });
      d.phases[r.phase_ipc] = (d.phases[r.phase_ipc] || 0) + (+r.personnes || 0);
    };
    courants.forEach(function (r) {
      var z = sansAcc(r.zone);
      var ville = Object.keys(VILLES).filter(function (v) { return z.indexOf(v) === 0; })[0];
      if (ville) return poser(VILLES[ville], r);
      if (/^(portauprince|citesoleil|delmas|petion|carrefour|croixdebouquet|tabarre|ouest)/.test(z))
        return poser("HT01", r);
      if (z.indexOf("camp") === 0) return;   /* camps : pas de département */
      for (var i = 0; i < nomsDep.length; i++) {
        if (z.indexOf(nomsDep[i].n) === 0) return poser(nomsDep[i].pc, r);
      }
    });
    /* la classification IPC d'une zone est portée par la ligne « Phase »
       du CSV area_wide ; ici on colore par la phase 3+ si >= 20 % ... trop
       d'interprétation : on colore par la phase MAJORITAIRE en population,
       et la légende le dit. */
    var svg = departements.features.map(function (f) {
      var p = f.properties, d = parDep[p.pcode];
      var phase = "";
      if (d) {
        var maxPop = -1;
        Object.keys(d.phases).forEach(function (ph) {
          if (d.phases[ph] > maxPop) { maxPop = d.phases[ph]; phase = ph; }
        });
      }
      var c = IPC_COULEURS[phase] || "#eef2f6";
      return '<path class="k-dep" fill="' + c + '" d="' + chemin(f.geometry) +
        '"><title>' + p.nom_fr + (phase ? " — phase majoritaire " + phase : " — hors zones publiées") +
        "</title></path>";
    }).join("");
    svg += nomsDepartements();
    var leg = Object.keys(IPC_COULEURS).map(function (ph) {
      return '<span class="k-p" style="background:' + IPC_COULEURS[ph] + '"></span>' + ph;
    }).join(" ") + " — phase MAJORITAIRE en population · " + libPeriode +
      (duAu ? " (" + duAu + ")" : "") + " · zones urbaines et plateaux rattachés à leur département, camps de déplacés au CSV seulement";
    dessiner(svg, leg, couche);
  }

  /* Polygones thématiques (bassins, zones inondables) posés SUR le fond des
     communes — le découpage public s'arrête là : sections communales et
     localités sont livrées avec le Pack Géo. */
  function rendrePolygones(couche, doc) {
    var fond = fondCommunes("k-fond");
    var st = couche.style || {};
    var formes = doc.features.map(function (f) {
      var nom = st.etiquette ? (f.properties[st.etiquette] || "") : "";
      return '<path fill="' + (st.fill || "#3a86ff") + '" fill-opacity="' + (st.opacity || 0.4) +
        '" stroke="' + (st.fill || "#3a86ff") + '" stroke-width="0.7" d="' + chemin(f.geometry) +
        '">' + (nom ? "<title>" + nom + "</title>" : "") + "</path>";
    }).join("");
    var etiquettes = "";
    if (st.etiquette) {
      etiquettes = doc.features.map(function (f) {
        var nom = f.properties[st.etiquette];
        if (!nom || nom === "sans nom") return "";
        var c = centroide(f.geometry);
        return '<text class="k-nom-bv" x="' + proj.x(c[0]).toFixed(1) + '" y="' +
          proj.y(c[1]).toFixed(1) + '">' + nom + "</text>";
      }).join("");
    }
    var leg = fmtN(doc.features.length) + " entités · " + (doc.millesime || "");
    dessiner(fond + formes + etiquettes + nomsDepartements(), leg,
             { source: (doc.source || "") + " — " + (doc.licence || ""),
               limite: doc.limite || couche.limite || "" });
  }

  /* Choroplèthe CATÉGORIELLE : la classe dominante par commune (occupation du sol). */
  var PALETTE_CL = ["#606c38", "#dda15e", "#a3b18a", "#2a9d8f", "#e9c46a", "#8d99ae",
                    "#bc6c25", "#457b9d", "#c1121f", "#9d4edd", "#588157", "#f4a261"];
  function rendreClasses(couche, rows) {
    var meilleur = {};
    rows.forEach(function (r) {
      var pc = r.pcode_commune, v = +r.pct_surface || 0;
      if (!meilleur[pc] || v > meilleur[pc].v) meilleur[pc] = { v: v, cl: r.classe };
    });
    var classes = [];
    Object.keys(meilleur).forEach(function (pc) {
      if (classes.indexOf(meilleur[pc].cl) < 0) classes.push(meilleur[pc].cl);
    });
    classes.sort();
    var couleur = {};
    classes.forEach(function (cl, i) { couleur[cl] = PALETTE_CL[i % PALETTE_CL.length]; });
    var svg = communes.features.map(function (f) {
      var p = f.properties, m = meilleur[p.pcode];
      return '<path class="k-com" data-id="' + p.atmart_geo_id + '" fill="' +
        (m ? couleur[m.cl] : "#eef2f6") + '" d="' + chemin(f.geometry) + '"><title>' +
        p.nom_fr + (m ? " — " + m.cl + " (" + m.v + " %)" : " — non couvert") +
        "</title></path>";
    }).join("");
    var leg = classes.map(function (cl) {
      return '<span class="k-p" style="background:' + couleur[cl] + '"></span>' + cl;
    }).join("  ");
    dessiner(svg + nomsDepartements(), leg, couche);
  }

  function centroide(geom) {
    var an = anneaux(geom)[0] || [[0, 0]];
    var sx = 0, sy = 0;
    an.forEach(function (p) { sx += p[0]; sy += p[1]; });
    return [sx / an.length, sy / an.length];
  }

  /* Les noms des départements s'impriment sur toutes les cartes ; ceux des
     communes s'affichent au survol (lecture sous la carte + infobulle) —
     140 étiquettes simultanées seraient illisibles à cette échelle. */
  function nomsDepartements() {
    if (!departements) return "";
    return departements.features.map(function (f) {
      var c = centroide(f.geometry);
      return '<text class="k-nom-dep" x="' + proj.x(c[0]).toFixed(1) + '" y="' +
        proj.y(c[1]).toFixed(1) + '">' + f.properties.nom_fr + "</text>";
    }).join("");
  }

  function rendrePoints(couche, doc) {
    var fond = fondCommunes("k-fond");
    var pts = doc.features.map(function (f) {
      var cl = couche.classes[couche.prop ? (f.properties[couche.prop] || "?") : ""] ||
               couche.classes["?"] || { c: "#8d99ae" };
      var c = f.geometry.coordinates;
      return '<circle r="2.6" fill="' + cl.c + '" fill-opacity="0.75" cx="' +
        proj.x(c[0]).toFixed(1) + '" cy="' + proj.y(c[1]).toFixed(1) + '"/>';
    }).join("");
    var leg = Object.keys(couche.classes).map(function (k) {
      return '<span class="k-p" style="background:' + couche.classes[k].c + '"></span>' +
             couche.classes[k].l;
    }).join("  ") + " · " + fmtN(doc.features.length) + " points · " + (doc.millesime || "");
    dessiner(fond + pts + nomsDepartements(), leg,
             { source: doc.source + " — " + doc.licence, limite: doc.limite || couche.limite });
  }

  function dessiner(svgCorps, legende, meta) {
    $("#k-carte").innerHTML =
      '<svg viewBox="0 0 ' + L + " " + H + '" role="img" preserveAspectRatio="xMidYMid meet">' +
      svgCorps + "</svg>";
    $("#k-legende").innerHTML = legende;
    $("#k-source").textContent = "Source : " + meta.source;
    $("#k-limite").textContent = "Limite : " + meta.limite;
  }

  /* ------------------------------------------------------------ démarrage */
  var cache = {};
  function afficher(id) {
    var couche = COUCHES.filter(function (c) { return c.id === id; })[0];
    if (!couche) return;
    $("#k-attente").hidden = false;
    var fini = function () { $("#k-attente").hidden = true; };
    try { history.replaceState(null, "", "?couche=" + id); } catch (e) {}
    var u = couche.geojson || couche.csv;
    (cache[u] ? Promise.resolve(cache[u]) : charger(u).then(function (t) {
      cache[u] = couche.geojson ? JSON.parse(t) : parseCSV(t);
      return cache[u];
    })).then(function (d) {
      if (couche.type === "points") rendrePoints(couche, d);
      else if (couche.type === "aplat_dep") rendreIPC(couche, d);
      else if (couche.type === "polygones") rendrePolygones(couche, d);
      else if (couche.type === "choroplethe_classes") rendreClasses(couche, d);
      else rendreChoroplethe(couche, d);
      fini();
    }).catch(function (e) {
      fini();
      $("#k-carte").innerHTML = '<div class="k-erreur"><p>Le fichier n\'a pas pu être chargé (' +
        String(e.message).replace(/[<>&]/g, "") +
        "). Vérifiez votre connexion.</p>" +
        '<button type="button" class="btn btn-outline" id="k-reessayer">Réessayer</button></div>';
      var bt = $("#k-reessayer");
      if (bt) bt.addEventListener("click", function () { delete cache[u]; afficher(id); });
    });
  }

  Promise.all([charger("data/haiti_communes_simplifie.geojson"),
               charger("data/haiti_departements_simplifie.geojson")])
    .then(function (t) {
      communes = JSON.parse(t[0]);
      departements = JSON.parse(t[1]);
      proj = projeter(communes.features);
      var sel = $("#k-choix");
      var GROUPES = [["Aléas, eau et territoire", ["inondation", "inondable", "bassins", "sol"]],
                     ["Conjoncturel", ["conflits", "deplaces", "ipc"]],
                     ["Services et infrastructures", ["eau", "carburant", "finance", "routes"]]];
      GROUPES.forEach(function (g) {
        var og = document.createElement("optgroup");
        og.label = g[0];
        g[1].forEach(function (id) {
          var c = COUCHES.filter(function (x) { return x.id === id; })[0];
          if (!c) return;
          var o = document.createElement("option");
          o.value = c.id; o.textContent = c.nom;
          og.appendChild(o);
        });
        sel.appendChild(og);
      });
      var ogPrep = document.createElement("optgroup");
      ogPrep.label = "En préparation — parrainables";
      EN_PREPARATION.forEach(function (c) {
        var o = document.createElement("option");
        o.value = "prep_" + c.slug; o.textContent = c.nom; o.disabled = true;
        ogPrep.appendChild(o);
      });
      sel.appendChild(ogPrep);
      sel.addEventListener("change", function () { afficher(sel.value); });
      /* un clic sur une commune ouvre sa fiche ; le survol affiche son nom
         et sa valeur sous la carte — les 140 étiquettes simultanées seraient
         illisibles, le nom apparaît donc là où le regard est. */
      var tactile = window.matchMedia && matchMedia("(pointer: coarse)").matches;
      var dernierTap = { id: null, t: 0 };
      $("#k-carte").addEventListener("click", function (e) {
        var cid = e.target && e.target.getAttribute && e.target.getAttribute("data-id");
        if (!cid) return;
        if (tactile) {
          /* au doigt, le survol n'existe pas : le premier toucher LIT le nom
             et la valeur, le second (même commune, moins de 5 s) ouvre la
             fiche — jamais de navigation avant d'avoir pu lire. */
          var t = Date.now();
          if (dernierTap.id === cid && t - dernierTap.t < 5000) {
            location.href = "/?id=" + cid;
            return;
          }
          dernierTap = { id: cid, t: t };
          var titre = e.target.querySelector && e.target.querySelector("title");
          $("#k-lecture").textContent = (titre ? titre.textContent : "") +
            " — touchez encore pour ouvrir la fiche";
          return;
        }
        location.href = "/?id=" + cid;
      });
      if (tactile) $("#k-lecture").textContent =
        "Touchez une commune pour lire son nom et sa valeur ; touchez-la encore pour ouvrir sa fiche.";
      $("#k-carte").addEventListener("mouseover", function (e) {
        var t = e.target;
        if (t && t.tagName === "path") {
          var titre = t.querySelector("title");
          if (titre) $("#k-lecture").textContent = titre.textContent;
        }
      });

      /* -------- indicateurs Atmart : chaque indicateur documenté devient une
         couche, avec sa couverture réelle en légende. Le dictionnaire fournit
         noms et unités ; les valeurs sont celles des fiches. */
      Promise.all([charger("data/atmart_referentiel_indicateurs.csv"),
                   charger("data/atmart_indicateurs_communes_HT.csv")])
        .then(function (t) {
          var dico = {};
          parseCSV(t[0]).forEach(function (d) { dico[d.indicateur_id] = d; });
          var vals = parseCSV(t[1]);
          var parInd = {};
          vals.forEach(function (v) {
            if (v.statut_valeur === "N" || v.valeur === "") return;
            (parInd[v.indicateur_id] = parInd[v.indicateur_id] || []).push(v);
          });
          var og = document.createElement("optgroup");
          og.label = "Indicateurs Atmart (par commune)";
          Object.keys(parInd).sort().forEach(function (indId) {
            var d = dico[indId] || {};
            if ((d.categorie || "") === "Qualité") return;
            var lignes = parInd[indId];
            COUCHES.push({
              id: "ind_" + indId, nom: (d.nom || indId), type: "choroplethe",
              csv: "data/atmart_indicateurs_communes_HT.csv", deja: lignes,
              agreger: function (rows) {
                var m = {}, annees = {};
                lignes.forEach(function (v) {
                  m[v.pcode_commune] = +String(v.valeur).replace(",", ".") || 0;
                  if (v.annee_reference) annees[v.annee_reference] = 1;
                });
                return { valeurs: m,
                         periode: "millésime " + Object.keys(annees).sort().join("/"),
                         unite: d.unite || "",
                         couverture: lignes.length + " communes documentées sur 140 — le gris est « non documenté », jamais zéro" };
              },
              source: "Atmart Data — " + (d.source_primaire || "voir la fiche de l'indicateur"),
              limite: d.limites_connues || "Voir la fiche de l'indicateur dans l'Explorateur."
            });
            var o = document.createElement("option");
            o.value = "ind_" + indId;
            o.textContent = (d.nom || indId);
            og.appendChild(o);
          });
          sel.appendChild(og);
          var demande2 = (location.search.match(/[?&]couche=([a-zA-Z0-9_\-]+)/) || [])[1];
          if (demande2 && demande2.indexOf("ind_") === 0 &&
              COUCHES.some(function (c) { return c.id === demande2; })) {
            sel.value = demande2;
            afficher(demande2);
          }
        }).catch(function () {});   /* sans le dictionnaire, la page vit sans ce groupe */

      var demande = (location.search.match(/[?&]couche=([a-zA-Z0-9_\-]+)/) || [])[1];
      if (demande && COUCHES.some(function (c) { return c.id === demande; })) {
        sel.value = demande;
      } else if (demande && demande.indexOf("ind_") !== 0) {
        /* couche annoncée mais pas construite, ou lien erroné : on le DIT,
           on offre le parrainage, et on montre une couche qui existe. */
        var prep = EN_PREPARATION.filter(function (c) {
          return "prep_" + c.slug === demande || c.slug === demande; })[0];
        var nomD = prep ? prep.nom : "« " + demande.replace(/[<>&"]/g, "") + " »";
        var info = document.createElement("p");
        info.id = "k-info";
        info.innerHTML = "La couche <b>" + nomD + "</b> " +
          (prep ? "est en préparation" : "n'existe pas (lien périmé ou erroné)") +
          ' — <a href="donnees-parrainage.html">la parrainer accélère sa construction</a>. ' +
          "En attendant, voici la couche des conflits.";
        var carte = $("#k-carte");
        carte.parentNode.insertBefore(info, carte);
        sel.value = COUCHE_DEFAUT;
      }
      afficher(sel.value);
    })
    .catch(function (e) {
      $("#k-carte").innerHTML = '<p class="x-note">Le fond de carte n\'a pas pu être chargé (' +
        String(e.message).replace(/[<>&]/g, "") + ").</p>";
    });
})();
