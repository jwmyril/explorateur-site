/* Page Couches — visualisation des couches d'utilité publique.
   INDÉPENDANT du moteur explorateur.js : cette page a son propre cycle de
   vie pour que le chantier carte du moteur et celui-ci n'entrent jamais en
   collision. Mêmes principes produit : une couche à la fois, la légende
   porte source, licence, millésime et limite — jamais un aplat sans dire
   d'où il vient ni ce qu'il ne couvre pas. */
(function () {
  "use strict";
  var DV = "?d=2026-08-17a";
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
    /* Télécom : la couleur porte l'OPÉRATEUR, parce que c'est la question
       posée — où sont Digicel, Natcom et les autres. Voilà a été absorbé par
       Digicel en 2012 : les objets qui portent encore ce nom ne sont pas
       réaffectés, réécrire la source serait une interprétation. */
    { id: "telecom", nom: "Équipements télécom par opérateur (OSM)", type: "points",
      geojson: "data/atmart_couche_telecom_HT.geojson",
      classes: { D: { c: "#e63946", l: "Digicel" }, N: { c: "#3a86ff", l: "Natcom" },
                 V: { c: "#8338ec", l: "Voilà (absorbé par Digicel en 2012)" },
                 A: { c: "#2ec4b6", l: "Access Haiti" },
                 "?": { c: "#8d99ae", l: "opérateur non précisé" } }, prop: "o",
      limite: "Équipements présents dans OpenStreetMap — pylônes et mâts de communication, boutiques, bureaux d'opérateur, accès internet. Ce n'est pas le parc des opérateurs : ni Digicel, ni Natcom, ni le CONATEL ne publient le leur. Une commune sans point n'est pas une commune sans couverture." },
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
  ,
    { id: "acces_sante", nom: "Temps d'accès à un point de santé (calcul Atmart)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.sante_min !== "") m[r.pcode_commune] = Math.round(+r.sante_min * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "réseau OSM du 06/08/2026 — calcul Atmart du 17/08/2026",
                 unite: "minutes de route (médiane des habitants)" };
      },
      source: "OpenStreetMap via HOT (ODbL) — trajets calculés par Atmart, aucune API de routage commerciale",
      limite: "Médiane PONDÉRÉE par la population des sections, pas le temps depuis le bourg : depuis le chef-lieu tout est proche, puisque c'est là que les établissements sont installés. Conditions normales — ni l'état de la chaussée, ni les pluies, ni les barrages, ni l'insécurité n'entrent dans le calcul : c'est un plancher optimiste. Et un établissement cartographié n'est pas un établissement ouvert." },
    { id: "acces_hopital", nom: "Temps d'accès à un hôpital (calcul Atmart)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.hopital_min !== "") m[r.pcode_commune] = Math.round(+r.hopital_min * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "réseau OSM du 06/08/2026 — calcul Atmart du 17/08/2026",
                 unite: "minutes de route (médiane des habitants)" };
      },
      source: "OpenStreetMap via HOT (ODbL) — trajets calculés par Atmart",
      limite: "Même méthode et mêmes réserves que l'accès à un point de santé, mais la destination change tout : un dispensaire n'opère pas. 38 sections communales ne sont reliées à aucune route cartographiée — leur accès est INCONNU, pas mauvais, et elles ne pèsent dans aucune médiane." },
    { id: "ecoles_absentes", nom: "Part des écoles déclarées que la carte montre", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      rampe: "urbain",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.ecoles_part_vue_pct !== "") m[r.pcode_commune] = Math.round(+r.ecoles_part_vue_pct * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "registres MENFP 2024-2025 · extrait OSM du 06/08/2026", unite: "% du registre visible sur OpenStreetMap" };
      },
      source: "MENFP/DPCE (décret du 12/10/2005, art. 5) et OpenStreetMap via HOT (ODbL)",
      limite: "Cette carte ne mesure PAS le nombre d'écoles : elle mesure ce que la carte en montre. PLUS LA TEINTE EST SOMBRE, MIEUX LA COMMUNE EST CARTOGRAPHIÉE — les communes pâles sont celles où le registre annonce des écoles que personne n'a relevées. Au-delà de 100 %, OSM voit plus d'établissements que le registre n'en déclare : soit ils existent sans y figurer, soit la carte compte séparément des annexes qu'un seul code CIE regroupe. 17 827 déclarées contre 7 251 vues à l'échelle du pays. Le registre garde une école fermée non radiée ; la carte ignore ce qu'aucun contributeur n'a saisi." },
    { id: "pop_desaccord", nom: "Désaccord entre les trois sources de population", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.pop_ecart_ratio !== "") m[r.pcode_commune] = Math.round(+r.pop_ecart_ratio * 100) / 100;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "IHSI 2024 · projection UNFPA/OCHA 2024 · WorldPop 2020", unite: "rapport entre le chiffre le plus haut et le plus bas" };
      },
      source: "IHSI/DSDS, UNFPA/OCHA COD-PS, WorldPop — passeport PSP-044",
      limite: "Aucune des trois n'est corrigée et aucune n'est moyennée : la carte montre où elles ne s'accordent pas. Un rapport de 1,2 est ordinaire ; Gressier, seul cas aberrant du pays, atteint 10,5 — l'IHSI et le satellite s'y accordent CONTRE la projection." },
    { id: "couvert_arbre", nom: "Couvert arboré (ESA WorldCover 2021, 10 m)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      rampe: "vegetal",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.part_arbres_pct !== "") m[r.pcode_commune] = Math.round(+r.part_arbres_pct * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "ESA WorldCover v200, millésime 2021 — parts calculées par Atmart", unite: "% de la surface communale" };
      },
      source: "ESA WorldCover v200 (CC BY 4.0) — passeport PSP-026",
      limite: "Remplace enfin l'occupation du sol de 1998 pour la question du couvert : 10 m de résolution, millésime 2021. « Arbres » au sens de la classification WorldCover — couvert arboré, ce qui inclut des vergers et des plantations, et ne dit rien de l'état ni de la propriété du peuplement." },
    { id: "solaire", nom: "Potentiel solaire (Global Solar Atlas)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      rampe: "soleil",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.pvout_moyen !== "") m[r.pcode_commune] = Math.round(+r.pvout_moyen * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "Global Solar Atlas 2.0 — période modélisée 1999-2018", unite: "kWh par kWc installé et par an" };
      },
      source: "Global Solar Atlas 2.0, ESMAP / Banque mondiale (CC BY 4.0) — passeport PSP-036",
      limite: "Résultat d'un MODÈLE climatique moyenné sur vingt ans, pas une mesure au sol et pas une étude de faisabilité. Il ignore l'ombre portée du relief à l'échelle d'une parcelle, la poussière, la température des modules et l'état du réseau." },
    { id: "croissance_bati", nom: "Croissance du bâti 1990 → 2020 (GHSL)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune",
      rampe: "urbain",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une cellule vide n'est PAS un zéro : la commune reste hors de la
             table, donc grise, donc comptée dans « non documenté ». */
          if (r.croissance_bati_pct !== "") m[r.pcode_commune] = Math.round(+r.croissance_bati_pct * 10) / 10;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "GHSL R2023A — quatre millésimes du même instrument", unite: "% de surface bâtie gagnée depuis 1990" };
      },
      source: "Global Human Settlement Layer R2023A, Commission européenne (CC BY 4.0) — passeport PSP-039",
      limite: "Quatre millésimes du MÊME instrument, donc comparables entre eux — ce qui est rare et ce qui fait la valeur de cette couche. Une croissance forte en pourcentage part souvent d'une base minuscule : lire avec la part bâtie en 2020, dans le produit détaillé." }
  ];

  /* ------------------------------------------------ ajoutées le 17/08/2026
     Neuf sources produites, publiées, et qu'aucune carte ne lisait — dont la
     santé déclarée au MSPP, qui couvre 139 communes quand la couche OCHA du
     socle n'en couvre que 14. Un lecteur tombé sur la seconde en concluait
     que le site n'était pas à jour. Règle posée ce jour : toute source captée
     et produite devient une carte quand la donnée est communale. */
  var COUCHES_17 = [
    { id: "sante_declaree", nom: "Établissements de santé déclarés (MSPP)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "sante_declaree",
      unite: "établissements déclarés", periode: "registre MSPP 2024",
      source: "MSPP — registre des institutions sanitaires (décret du 12/10/2005, art. 5)",
      limite: "DÉCLARÉ au ministère, pas constaté sur le terrain : une institution fermée mais non radiée y figure encore. À lire avec la couche « santé vue sur OpenStreetMap », qui a le défaut inverse." },
    { id: "sante_publique", nom: "Dont établissements publics (MSPP)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "sante_publique_declaree",
      unite: "établissements publics déclarés", periode: "registre MSPP 2024",
      source: "MSPP — registre des institutions sanitaires",
      limite: "Le secteur vient du registre. Une commune à zéro établissement PUBLIC peut compter des institutions privées ou mixtes : c'est une observation, pas une absence de soins." },
    { id: "sante_vue", nom: "Établissements de santé cartographiés (OSM)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "sante_vue_osm",
      unite: "établissements cartographiés", periode: "extrait HOT du 06/08/2026",
      source: "OpenStreetMap via HOT — ODbL 1.0 (passeport PSP-024)",
      limite: "OpenStreetMap est CONTRIBUTIF : sa couverture suit les cartographes, pas le terrain. Une commune peu cartographiée paraît sous-équipée — c'est un défaut de la carte, pas du territoire." },
    { id: "seismes", nom: "Séismes ressentis à moins de 100 km depuis 1911", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "seismes_100km",
      unite: "séismes depuis 1911", periode: "USGS ComCat, 1911-2026",
      source: "USGS ComCat — domaine public (passeport PSP-029)",
      limite: "Un COMPTAGE, pas un aléa : dix secousses faibles ne valent pas une forte. La magnitude maximale est dans le produit détaillé, et la détection s'améliore avec le temps — les décennies récentes comptent plus d'événements parce qu'on mesure mieux." },
    { id: "cyclones", nom: "Cyclones passés à moins de 100 km depuis 1851", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "cyclones_100km",
      unite: "systèmes depuis 1851", periode: "NOAA IBTrACS, 1851-2026",
      source: "NOAA NCEI IBTrACS v04r01 — accès ouvert (passeport PSP-028)",
      limite: "PASSÉS À PROXIMITÉ, ce qui ne dit rien des dégâts : un système intense qui longe la côte peut épargner l'intérieur. Avant l'ère satellitaire, beaucoup de trajectoires sont reconstituées." },
    { id: "pluie", nom: "Pluie annuelle normale (1991-2020)", type: "choroplethe", rampe: "vegetal",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "pluie_normale_mm",
      unite: "mm par an", periode: "normale CHIRPS 1991-2020",
      source: "CHIRPS 2.0, Climate Hazards Center — domaine public (passeport PSP-030)",
      limite: "Une NORMALE sur trente ans, donc ni l'année en cours ni la saisonnalité. Beaucoup de pluie ne veut pas dire assez d'eau : la répartition dans l'année et la capacité de stockage décident, pas le total." },
    { id: "eau_surface", nom: "Eau de surface permanente", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "eau_permanente_km2",
      unite: "km² d'eau permanente", periode: "JRC 1984-2021",
      source: "JRC Global Surface Water v1.4, Copernicus (passeport PSP-038)",
      limite: "Eau VISIBLE DU CIEL : lacs, étangs, larges rivières. Ni les nappes, ni les sources, ni les petits cours d'eau sous couvert. Zéro n'est pas une commune sans eau." },
    { id: "batiments", nom: "Bâtiments détectés (Open Buildings)", type: "choroplethe", rampe: "urbain",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "batiments_nb",
      unite: "empreintes détectées", periode: "Open Buildings V3",
      source: "Google Open Buildings V3 — CC BY 4.0",
      limite: "Détections d'un modèle au seuil de confiance 0,75, qui retient 57 % des empreintes ; à 0,90 il n'en resterait que 1,6 %. Le même pays, quinze fois moins bâti — le seuil est un choix, publié dans le produit." },
    { id: "cyclone_vent", nom: "Vent maximal d'un cyclone passé à proximité", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "cyclone_vent_max_kmh",
      unite: "km/h au plus fort", periode: "NOAA IBTrACS, 1851-2026",
      source: "NOAA NCEI IBTrACS v04r01 — accès ouvert",
      limite: "Le vent MESURÉ AU CENTRE du système, pas au sol dans la commune : le relief, la distance et la durée changent tout. Un maximum historique ne prédit pas la prochaine saison." }
  ];

  /* Couches ANNONCÉES mais pas encore construites : jamais dans le
     sélecteur actif — une section grisée les liste, avec le parrainage
     comme chemin. Le registre des sources dit pourquoi chacune attend. */
  var EN_PREPARATION = [
    { slug: "mobile_reel", nom: "Couverture mobile réelle (opérateurs)" },
    { slug: "sismique", nom: "Aléa sismique probabiliste (USGS)" },
    { slug: "hydro", nom: "Réseau hydrographique et sous-bassins" }
  ];
  COUCHES_17.push(
    { id: "acces_ecole", nom: "Temps d'accès à une école (calcul Atmart)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecole_min",
      unite: "minutes de route (médiane des habitants)",
      periode: "réseau OSM du 06/08/2026 — calcul Atmart",
      source: "OpenStreetMap via HOT — ODbL 1.0 ; calcul Dijkstra chez Atmart",
      limite: "Temps en CONDITIONS NORMALES : ni l'état de la chaussée, ni la saison des pluies, ni les barrages n'entrent dans le calcul. Un plancher optimiste, jamais une prévision de trajet — et une école cartographiée n'est pas une école ouverte." },
    { id: "acces_marche", nom: "Temps d'accès à un marché (calcul Atmart)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "marche_min",
      unite: "minutes de route (médiane des habitants)",
      periode: "marchés PAM via OCHA, relevé du 13/08/2026",
      source: "PAM via OCHA HDX (marchés) ; OpenStreetMap via HOT (routes) — calcul Atmart",
      limite: "Seuls les marchés SUIVIS par le PAM sont pris en compte : un marché local non suivi n'entre pas dans le calcul, et la commune paraît plus éloignée qu'elle ne l'est." },
    { id: "ecoles_nb", nom: "Écoles déclarées au ministère (MENFP)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecoles_declarees",
      unite: "écoles déclarées", periode: "registres MENFP 2024-2025",
      source: "MENFP/DPCE — registres 2024-2025 (décret du 12/10/2005, art. 5)",
      limite: "DÉCLARÉ au ministère : une école fermée mais non radiée y figure encore, une école jamais recensée n'y figure pas. 643 lignes matériellement répétées dans les PDF ont été écartées ; le comptage porte sur des codes CIE distincts." },
    { id: "ecoles_vues_nb", nom: "Écoles cartographiées (OSM)", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecoles_vues",
      unite: "écoles cartographiées", periode: "extrait HOT du 06/08/2026",
      source: "OpenStreetMap via HOT — ODbL 1.0 (passeport PSP-024)",
      limite: "Contributif : la couverture suit les cartographes, pas le terrain. À l'échelle du pays, la carte ne montre que 41 % des écoles déclarées — l'écart mesure l'état de la cartographie, pas le nombre d'écoles." },
    { id: "cultures", nom: "Part du territoire en cultures (WorldCover 2021)", type: "choroplethe", rampe: "vegetal",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "part_cultures_pct",
      unite: "% de la surface communale", periode: "ESA WorldCover v200, 2021",
      source: "ESA WorldCover 2021 à 10 m — CC BY 4.0 (passeport PSP-026)",
      limite: "Classification satellite : « cultures » désigne un couvert détecté, pas une exploitation active ni un rendement. Une jachère et un champ productif s'y ressemblent." },
    { id: "part_bati", nom: "Part du territoire bâti en 2020 (GHSL)", type: "choroplethe", rampe: "urbain",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "part_bati_2020_pct",
      unite: "% de la surface communale", periode: "GHSL R2023A, millésime 2020",
      source: "Global Human Settlement Layer R2023A, Commission européenne — CC BY 4.0",
      limite: "Surface BÂTIE, pas population : une commune très bâtie peut être peu peuplée, et l'inverse. À lire avec la croissance du bâti, qui dit le mouvement plutôt que l'état." },
    { id: "seisme_max", nom: "Séisme le plus fort ressenti à moins de 100 km", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "seisme_max_mag",
      unite: "magnitude maximale", periode: "USGS ComCat, 1911-2026",
      source: "USGS ComCat — domaine public (passeport PSP-029)",
      limite: "La magnitude est celle du SÉISME, pas de sa secousse ici : la distance, la profondeur et le sol décident de ce qui a été ressenti. Un maximum historique ne prédit pas le prochain." });

  /* Les neuf couches déclarées par colonne rejoignent les autres, chacune
     dotée du même agrégateur : une seule boucle, donc un seul endroit où le
     test « une cellule vide n'est pas un zéro » peut être juste ou faux. */
  COUCHES_17.forEach(function (d) {
    d.agreger = function (rows) {
      var m = {};
      rows.forEach(function (r) {
        var v = r[d.colonne];
        /* Vide = la source ne couvre pas cette commune. On la laisse hors de
           la table : elle sera grise, tiretée, et comptée comme non
           documentée. Un « 0 » écrit, lui, entre normalement — c'est une
           observation. */
        if (v === undefined || v === "") return;
        var n = +String(v).replace(",", ".");
        if (!isNaN(n)) m[r.pcode_commune] = Math.round(n * 10) / 10;
      });
      return { valeurs: m, periode: d.periode, unite: d.unite };
    };
    COUCHES.push(d);
  });

  var COUCHE_DEFAUT = "conflits";

  /* Les aplats de la carte sont peints dans le SVG, pas en CSS : un
     changement d'apparence ne les touche donc pas tout seul. On redessine la
     couche affichée quand `theme.js` annonce la bascule — sinon la carte
     garderait ses teintes claires au milieu d'une page devenue sombre. */
  document.addEventListener("atmart:apparence", function () {
    /* « k-choix », l'identifiant réel du sélecteur — j'avais écrit « k-couche »,
       qui n'existe nulle part : le listener se posait, ne trouvait rien et
       échouait en silence. Un getElementById qui rend null ne lève pas. */
    var sel = document.getElementById("k-choix");
    if (sel && sel.value) afficher(sel.value);
  });

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

  /* Les rampes. Le rouge n'est pas une couleur neutre : sur une carte il se
     lit « attention », et l'employer pour une forêt dense ou un bon
     ensoleillement ferait dire à la teinte le contraire de la donnée. Chaque
     couche déclare donc la sienne, et une couche qui n'en déclare pas garde
     la rampe historique — c'est la valeur par défaut, pas un oubli.
     `depart` est la teinte du minimum, `arrivee` celle du maximum. */
  var RAMPES = {
    alerte:   { depart: [254, 232, 200], arrivee: [158,  27,  49] },
    vegetal:  { depart: [240, 247, 238], arrivee: [ 27,  94,  56] },
    soleil:   { depart: [255, 248, 225], arrivee: [201, 121,   0] },
    urbain:   { depart: [240, 241, 245], arrivee: [ 60,  60,  75] }
  };

  /* Le point de départ des rampes, et la teinte du « non documenté ».
     Relu à chaque rendu plutôt que figé au chargement : un changement
     d'apparence sans rechargement doit redessiner juste. */
  function departTheme(R) {
    var f = getComputedStyle(document.documentElement)
              .getPropertyValue("--fond").trim().toLowerCase();
    /* Sur fond sombre, on part de la surface secondaire au lieu du blanc
       cassé : la rampe monte alors de l'ombre vers la couleur, dans le sens
       où l'œil lit « peu » puis « beaucoup ». */
    return f === "#080c12" ? [22, 34, 52] : R.depart;
  }

  function nonDocumente() {
    var f = getComputedStyle(document.documentElement)
              .getPropertyValue("--fond").trim().toLowerCase();
    return f === "#080c12" ? "#111827" : "#eef2f6";
  }

  function teinte(v, max, nom) {
    /* `v == null` et non `!v` : un zéro documenté est une observation, pas un
       trou. Il prend le bas de la rampe ; seul l'inconnu prend la teinte du
       « non documenté ». */
    if (v == null) return nonDocumente();
    var R = RAMPES[nom] || RAMPES.alerte;
    var d = departTheme(R);
    var t = Math.pow(v / max, 0.45);   /* les distributions sont très asymétriques */
    var m = function (i) { return Math.round(d[i] - t * (d[i] - R.arrivee[i])); };
    return "rgb(" + m(0) + "," + m(1) + "," + m(2) + ")";
  }

  function rendreChoroplethe(couche, rows) {
    var agg = couche.agreger(rows);
    var vals = agg.valeurs;
    var max = 0, nonDoc = 0;
    Object.keys(vals).forEach(function (k) { if (vals[k] > max) max = vals[k]; });
    var svg = communes.features.map(function (f) {
      var p = f.properties, v = vals[p.pcode];
      var doc = v !== undefined;
      if (!doc) nonDoc++;
      return '<path class="k-com' + (doc ? "" : " k-vide") + '" data-id="' + p.atmart_geo_id + '" fill="' +
        (doc ? teinte(v, max, couche.rampe) : nonDocumente()) + '" d="' + chemin(f.geometry) + '"><title>' + p.nom_fr +
        (doc ? " — " + fmtN(v) + " " + agg.unite : " — non documenté") + "</title></path>";
    }).join("");
    var leg = '<span class="k-grad k-grad-' + (couche.rampe || "alerte") + '"></span> ' +
              (agg.min !== undefined ? fmtN(agg.min) : "0") + " → " + fmtN(max) + " " + agg.unite +
              " · " + agg.periode +
              (agg.couverture ? " · " + agg.couverture : "");
    /* Le gris des communes sans valeur ne se distingue pas d'un minimum pâle
       à l'œil : tant qu'il n'est pas COMPTÉ dans la légende, une carte
       incomplète se lit comme une carte complète où tout va bien. */
    if (nonDoc) {
      leg += ' · <b class="k-manque">' + nonDoc + " commune(s) en gris : non documenté, jamais zéro</b>";
    }
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
      var c = IPC_COULEURS[phase] || nonDocumente();
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
        (m ? couleur[m.cl] : nonDocumente()) + '" d="' + chemin(f.geometry) + '"><title>' +
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
    couverture();
  }

  /* LA COUVERTURE SE LIT AVANT LA CARTE.
     Signalé le 17/08 par un lecteur : la couche des établissements de santé
     publics colore 14 communes et en laisse 126 en gris. La légende le disait
     exactement — mais sous une carte de 520 px, donc hors de l'écran. Le
     lecteur voyait un pays presque entièrement gris et en concluait que la
     donnée n'était pas à jour. Il avait raison de s'interroger ; c'est la
     mise en page qui l'a induit en erreur.

     On COMPTE ce que le rendu a réellement laissé sans valeur, au lieu de
     recopier ce que la couche annonce : une couche qui se tromperait sur sa
     propre couverture serait ainsi prise en défaut. */
  function couverture() {
    var e = $("#k-couverture");
    if (!e) return;
    var tous = document.querySelectorAll("#k-carte .k-com");
    if (!tous.length) { e.textContent = ""; e.className = ""; return; }
    /* On compte la CLASSE, pas la teinte. Comparer des couleurs est ce qui
       avait fait annoncer 13 communes documentées au lieu de 14 : un zéro
       documenté partageait la teinte du non-documenté. */
    var gris = document.querySelectorAll("#k-carte .k-com.k-vide").length;
    var doc = tous.length - gris;
    var part = Math.round(doc / tous.length * 100);
    if (!gris) {
      e.className = "";
      e.textContent = "Les " + tous.length + " communes sont documentées.";
      return;
    }
    /* Sous la moitié du pays, ce n'est plus une précision : c'est ce qu'il
       faut savoir avant de regarder la carte. */
    e.className = part < 50 ? "k-creuse" : "";
    /* L'accord se fait, y compris au singulier : « Les 1 communes en gris »
       sur une carte qui se veut soignée décrédibilise tout ce qui l'entoure. */
    var un = gris === 1;
    e.textContent = doc + (doc > 1 ? " communes documentées" : " commune documentée") +
      " sur " + tous.length + " (" + part + " %). " +
      (un ? "La commune en gris n'est pas une commune à zéro : la source ne la couvre pas."
          : "Les " + gris + " communes en gris ne sont pas des communes à zéro : " +
            "la source ne les couvre pas.") +
      (part < 50 ? " Cette carte montre l'étendue d'une source, pas celle du phénomène."
                 : "");
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
      var GROUPES = [["Aléas, eau et territoire",
                      ["inondation", "inondable", "seismes", "seisme_max", "cyclones",
                       "cyclone_vent", "pluie", "eau_surface", "bassins", "sol"]],
                     ["Conjoncturel", ["conflits", "deplaces", "ipc"]],
                     /* « telecom » compte les équipements cartographiés dans OSM ;
                        « Couverture mobile réelle » reste en préparation juste
                        en dessous, et les deux ne se remplacent pas — l'un dit
                        ce qui est cartographié, l'autre dirait ce qui est
                        couvert. Les confondre serait la faute la plus facile
                        à commettre sur cette couche. */
                     /* Le DÉCLARÉ et le VU, côte à côte et jamais séparés :
                        deux comptages du même objet par deux méthodes qui ne
                        peuvent pas se tromper de la même façon. Le registre
                        garde une porte fermée mais non radiée ; la carte
                        ignore ce qu'aucun contributeur n'a relevé. Les
                        éloigner l'un de l'autre aurait laissé croire que
                        l'un remplace l'autre. */
                     ["Santé — déclaré au ministère et vu sur la carte",
                      ["sante_declaree", "sante_publique", "sante_vue"]],
                     ["Écoles — déclaré au ministère et vu sur la carte",
                      ["ecoles_nb", "ecoles_vues_nb"]],
                     ["Services et infrastructures",
                      ["eau", "carburant", "finance", "telecom", "routes"]],
                     /* L'ACCÈS EN PREMIER DANS SON GROUPE. Compter les
                        établissements d'une commune répond à « qu'y a-t-il ? » ;
                        les temps de trajet répondent à « qui peut y aller ? ».
                        Sur une carte nationale, c'est la seconde question qui
                        se voit — les communes sombres ne sont pas celles qui
                        manquent d'établissements, ce sont celles dont les
                        habitants vivent loin de ceux qui existent. */
                     ["Accès aux services — calcul Atmart",
                      ["acces_sante", "acces_hopital", "acces_ecole", "acces_marche"]],
                     /* Deux cartes qui ne parlent pas du territoire mais de
                        ce qu'on SAIT de lui. Elles ont leur groupe parce que
                        les confondre avec les précédentes serait la faute
                        grave : « écoles absentes de la carte » ne dit rien
                        du nombre d'écoles, et « désaccord des sources » ne
                        dit rien du nombre d'habitants. */
                     ["Ce que l'on sait — qualité de l'information",
                      ["ecoles_absentes", "pop_desaccord"]],
                     ["Observation satellite",
                      ["couvert_arbre", "cultures", "part_bati", "croissance_bati",
                       "batiments", "solaire"]]];
      /* Une couche déclarée mais absente des groupes serait chargeable et
         invisible — la panne la plus silencieuse possible sur cette page.
         Sept l'ont été le 17/08, le temps d'un aller-retour. */
      var orphelines = COUCHES.filter(function (x) {
        return !GROUPES.some(function (g) { return g[1].indexOf(x.id) > -1; });
      }).map(function (x) { return x.id; });
      if (orphelines.length && window.console) {
        console.warn("couches déclarées mais absentes du sélecteur : " +
                     orphelines.join(", "));
      }
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
          /* De la mieux documentée à la moins : une liste alphabétique met
             au même rang une couche complète et une couche à 10 %, et laisse
             le lecteur les découvrir au hasard. */
          Object.keys(parInd).sort(function (a, b) {
            return parInd[b].length - parInd[a].length || a.localeCompare(b);
          }).forEach(function (indId) {
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
            /* La couverture DANS l'étiquette : c'est la seule information qui
               permette de choisir sans avoir déjà tracé la carte. */
            var part = Math.round(lignes.length / 140 * 100);
            o.textContent = (d.nom || indId) + " — " + lignes.length + "/140 communes" +
                            (part < 50 ? " ⚠" : "");
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
