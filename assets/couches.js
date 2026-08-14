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
    return fetch(u + DV).then(function (r) {
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
      var p = f.properties, v = vals[p.pcode] || 0;
      return '<path class="k-com" data-id="' + p.atmart_geo_id + '" fill="' +
        teinte(v, max) + '" d="' + chemin(f.geometry) + '"><title>' + p.nom_fr +
        " — " + fmtN(v) + " " + agg.unite + "</title></path>";
    }).join("");
    var leg = '<span class="k-grad"></span> 0 → ' + fmtN(max) + " " + agg.unite +
              " · " + agg.periode;
    dessiner(svg, leg, couche);
  }

  function rendreIPC(couche, rows) {
    /* situation courante la plus récente, par p-code départemental */
    var courants = rows.filter(function (r) { return r.periode_validite === "current"; });
    var parDep = {};
    courants.forEach(function (r) {
      var pc = r.pcode_zone;
      if (!/^HT\d\d$/.test(pc)) return;
      /* phase dominante = phase de classification la plus élevée avec population */
      var d = parDep[pc] || (parDep[pc] = { phases: {}, date: r.date_analyse });
      d.phases[r.phase_ipc] = (+r.personnes || 0);
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
    var leg = Object.keys(IPC_COULEURS).map(function (ph) {
      return '<span class="k-p" style="background:' + IPC_COULEURS[ph] + '"></span>' + ph;
    }).join(" ") + " — phase MAJORITAIRE en population (l'IPC classe les zones par phase dominante ; le détail complet est dans le CSV)";
    dessiner(svg, leg, couche);
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
    dessiner(fond + pts, leg,
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
      else rendreChoroplethe(couche, d);
      fini();
    }).catch(function (e) {
      fini();
      $("#k-carte").innerHTML = '<p class="x-note">La couche n\'a pas pu être chargée (' +
        String(e.message).replace(/[<>&]/g, "") + "). Réessayez — les fichiers restent téléchargeables plus bas.</p>";
    });
  }

  Promise.all([charger("data/haiti_communes_simplifie.geojson"),
               charger("data/haiti_departements_simplifie.geojson")])
    .then(function (t) {
      communes = JSON.parse(t[0]);
      departements = JSON.parse(t[1]);
      proj = projeter(communes.features);
      var sel = $("#k-choix");
      COUCHES.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id; o.textContent = c.nom;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { afficher(sel.value); });
      /* un clic sur une commune ouvre sa fiche */
      $("#k-carte").addEventListener("click", function (e) {
        var id = e.target && e.target.getAttribute && e.target.getAttribute("data-id");
        if (id) location.href = "/?id=" + id;
      });
      var demande = (location.search.match(/[?&]couche=([a-z]+)/) || [])[1];
      if (demande && COUCHES.some(function (c) { return c.id === demande; })) sel.value = demande;
      afficher(sel.value);
    })
    .catch(function (e) {
      $("#k-carte").innerHTML = '<p class="x-note">Le fond de carte n\'a pas pu être chargé (' +
        String(e.message).replace(/[<>&]/g, "") + ").</p>";
    });
})();
