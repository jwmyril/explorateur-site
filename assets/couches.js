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
    /* PORTÉE DE LA REDISTRIBUTION : CLARIFICATION DEMANDÉE À L'OIM (18/08/2026).
       Cette couche a été retirée le matin du 18/08, puis rétablie le soir même
       sur décision d'Atmart. Le motif du retrait — « create derivative works
       therefrom » — ne résiste pas à l'examen aussi bien qu'il en avait l'air :

       · une œuvre DÉRIVÉE reprend l'EXPRESSION d'une œuvre. Un décompte de
         personnes déplacées dans une commune est un FAIT, et un fait n'a pas
         d'auteur (décret haïtien du 12/10/2005, art. 5) ;
       · l'OIM écrit elle-même, sur la page HDX de ce jeu, que son API existe
         pour que « the humanitarian community, academia, media, government,
         and non-governmental organizations » puissent UTILISER ces données ;
       · la mention de droits qui l'accompagne date de 2018 et se retrouve,
         identique, sur les huit jeux DTM d'Haïti — c'est un texte par défaut,
         pas une décision prise pour celui-ci.

       Ce qui joue en sens inverse, et qu'il faut garder en tête : la clause
       dit « without, INTER ALIA, any right to… » — la liste n'est pas
       limitative, elle s'élargit.

       Nous publions donc un agrégat recalculé, avec attribution complète, sans
       fichier brut et sans usage commercial — et nous avons écrit à l'OIM pour
       faire trancher. Si la réponse est négative, `rendreManqueJuridique` est
       prêt : il suffit de repasser `type` à "manque_juridique". */
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
      source: "International Organization for Migration (IOM), Displacement Tracking Matrix (DTM) — via HDX",
      limite: "Recensement des sites accessibles à l'OIM — pas un registre exhaustif des déplacés. Agrégat recalculé par Atmart ; la portée exacte de la redistribution autorisée fait l'objet d'une demande de clarification auprès de l'OIM depuis le 18/08/2026." },
    { id: "ipc", nom: "Insécurité alimentaire — phase IPC", type: "aplat_dep",
      csv: "data/atmart_ipc_HT.csv",
      /* Le sigle est écrit en entier depuis le 21/08/2026 : « IPC » désigne
         aussi l'Indice des Prix à la Consommation, qui entre sur le site le
         même jour. Deux IPC sur une même page, c'est un lecteur qui croit
         lire des prix sur une carte de faim. */
      source: "IPC — Cadre intégré de classification de la sécurité alimentaire, analyse de mars 2026 (CC0)",
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
    /* TOURISME. Deux cartes du meme relevé, et elles ne disent pas la meme
       chose : les points montrent OU l'offre est cartographiée, l'aplat
       montre COMBIEN d'hébergements une commune porte. La seconde se lit
       plus vite, la première se vérifie mieux.

       CE QUE NOUS NE POUVONS PAS CARTOGRAPHIER : la capacité. Sur 643
       hébergements retenus, AUCUN ne déclare son nombre de lits et treize
       leur nombre de chambres. « Combien de personnes Haiti peut-il héberger ? »
       — la première question de tout investisseur et de tout bailleur — reste
       sans réponse, et aucune coloration ne doit laisser croire le contraire. */
    { id: "tourisme", nom: "Offre touristique cartographiée (OSM)", type: "points",
      geojson: "data/atmart_couche_tourisme_HT.geojson",
      classes: { hebergement: { c: "#3a86ff", l: "hébergement" },
                 sites: { c: "#c97900", l: "site ou attraction" },
                 plein_air: { c: "#2a9d8f", l: "plein air" },
                 information: { c: "#8338ec", l: "information touristique" },
                 restauration: { c: "#e63946", l: "restauration et sorties" },
                 patrimoine: { c: "#8d6e63", l: "patrimoine bâti" },
                 culture: { c: "#00897b", l: "lieu de culture" },
                 littoral: { c: "#0091ea", l: "littoral et balnéaire" },
                 nature: { c: "#558b2f", l: "curiosité naturelle" } }, prop: "f",
      limite: "Compte ce qui est CARTOGRAPHIÉ dans OpenStreetMap, pas ce qui existe, pas ce qui est ouvert, pas ce qui est agréé par le ministère. Un hôtel jamais cartographié n'apparait pas ; un hôtel fermé depuis 2019 apparait encore. La cartographie contributive suit les contributeurs, donc les villes : 115 communes sur 140 portent au moins un objet, les 25 autres sont VIDES et non à zéro. Aucun établissement ne déclare sa capacité en lits. Les plages et les marinas, posées sur le sable ou sur l'eau, tombent du côté mer de la limite administrative : elles sont recollées au rivage le plus proche sous 100 mètres, et 21 objets plus lointains restent hors du socle communal." },
    { id: "hebergement_nb", nom: "Hébergements cartographiés par commune (OSM)", type: "choroplethe",
      csv: "data/atmart_tourisme_communes_HT.csv", pcode: "pcode_commune",
      rampe: "urbain",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une commune ABSENTE du fichier reste hors de la table, donc grise,
             donc comptée dans « non documenté ». Lui donner zéro affirmerait
             qu'elle n'a pas d'hôtel ; la vérité est que personne n'en a
             cartographié. */
          if (r.famille === "hebergement")
            m[r.pcode_commune] = (m[r.pcode_commune] || 0) + (+r.objets_cartographies || 0);
        });
        /* La borne basse est le plus PETIT compte relevé, pas zéro. La
           légende affichait « 0 → 61 » alors qu'aucune commune de la table
           ne porte zéro hébergement : celles-là sont absentes, donc grises.
           Annoncer zéro contredisait la carte elle-même. */
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "extrait OSM du 14/08/2026",
                 unite: "établissements cartographiés (hôtels, auberges, locations)" };
      },
      source: "OpenStreetMap via HOT — © contributeurs OSM (ODbL) — passeport PSP-024",
      limite: "Un nombre d'ÉTABLISSEMENTS, jamais une capacité : zéro des 643 hébergements ne déclare ses lits. Une commune sombre est une commune bien cartographiée autant qu'une commune bien dotée, et rien ici ne permet de trancher entre les deux. 81 communes sur 140 portent au moins un hébergement ; les autres sont grises, pas à zéro." },
    /* LE CLASSÉ, À CÔTÉ DU CARTOGRAPHIÉ. Cette carte ne compte pas les
       hôtels : elle compte ceux que le ministère a VISITÉS ET NOTÉS entre
       2013 et 2015. Cent quatre-vingt-dix établissements, trente-neuf
       communes — contre six cent quarante-trois hébergements relevés par
       OpenStreetMap dans quatre-vingt-une. L'écart entre les deux cartes est
       l'information : il sépare ce qui existe de ce qui est reconnu.

       DEUX RÉSERVES QUI PÈSENT AUTANT QUE LE CHIFFRE. Le millésime d'abord :
       dix ans, et rien n'a succédé à cette classification — un établissement
       noté alors peut avoir fermé. Le rattachement ensuite : dix-huit
       établissements se trouvent dans des localités infra-communales
       (Labadee, Cormier, Cyvadier, Kabic…) que nous refusons d'attribuer à
       une commune par ressemblance. Ils sont publiés à part, jamais fondus
       dans une voisine. */
    { id: "hibiscus", nom: "Établissements classés par le ministère (Hibiscus 2013-2015)", type: "choroplethe",
      csv: "data/atmart_hibiscus_communes_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          /* Une commune ABSENTE du fichier n'a pas zéro établissement
             classé : elle n'apparaît pas dans le document du ministère, ce
             qui n'est pas la même chose. Elle reste grise. */
          m[r.pcode_commune] = +r.etablissements_classes || 0;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "classification 2013-2015",
                 unite: "établissements classés par le ministère" };
      },
      source: "Ministère du Tourisme et des Industries créatives (MTIC) — agrégat communal recalculé par Atmart, passeport PSP-062",
      limite: "Ce que le ministère a CLASSÉ, pas ce qui existe : un hôtel jamais inspecté n'y figure pas, et un hôtel classé en 2015 peut avoir fermé depuis. Aucune classification n'a été publiée après 2015. 39 communes sur 140 portent un établissement classé ; les autres sont grises, pas à zéro. 18 établissements situés dans des localités infra-communales — Labadee, Cormier, Furcy, Cyvadier, Kabic, Ti mouillage et sept autres — ne sont attribués à aucune commune et sont publiés à part : Kabic relève de Cayes-Jacmel et non de Jacmel, et c'est exactement le genre d'erreur qu'un rattachement de proximité aurait produit." },
    /* PRIX DES DENRÉES. Neuf communes sur 140 portent un marché relevé :
       cette carte est grise presque partout, et elle doit l'être. Le suivi
       des prix alimentaires en Haïti ne couvre que neuf chefs-lieux, et une
       carte qui le cacherait mentirait plus qu'elle n'informerait.

       CE N'EST PAS UN INDICE DES PRIX À LA CONSOMMATION. Deux denrées
       seulement tiennent sur la durée dans les neuf marchés ; ni le logement,
       ni le transport, ni l'énergie n'entrent ici. C'est le prix d'une
       marmite de maïs moulu, et rien d'autre. */
    { id: "prix_mais", nom: "Prix de la marmite de maïs moulu (PAM, moyenne 2024)", type: "choroplethe",
      csv: "data/atmart_prix_denrees_marches_HT.csv", pcode: "pcode_commune",
      rampe: "urbain",
      agreger: function (rows) {
        var m = {};
        rows.forEach(function (r) {
          if (r.denree === "Maïs moulu local" && r.annee === "2024")
            m[r.pcode_commune] = Math.round(+r.prix_moyen_htg);
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "moyenne des mois relevés en 2024",
                 unite: "gourdes la marmite" };
      },
      source: "PAM (WFP) via OCHA HDX — moyennes annuelles calculées par Atmart, passeport PSP-051",
      limite: "CE N'EST PAS UN INDICE DES PRIX À LA CONSOMMATION : c'est le prix d'une seule denrée, dans une seule unité. Neuf communes sur 140 portent un marché relevé — les autres sont grises, jamais à zéro. L'écart entre marchés est réel et considérable : 291 gourdes la marmite à Jérémie contre 700 à Ouanaminthe en moyenne 2024, soit un rapport de 2,4 pour le même produit la même année. La collecte s'arrête fin 2024 ; 2025 ne compte qu'un mois, sur trois marchés." },
    { id: "prix_hausse_usd", nom: "Hausse du maïs en dollars, 2005-2024 (hors dépréciation)", type: "choroplethe",
      csv: "data/atmart_prix_denrees_marches_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var d = {}, f = {};
        rows.forEach(function (r) {
          if (r.denree !== "Maïs moulu local") return;
          if (r.annee === "2005") d[r.pcode_commune] = +r.prix_moyen_usd;
          if (r.annee === "2024") f[r.pcode_commune] = +r.prix_moyen_usd;
        });
        var m = {};
        Object.keys(f).forEach(function (k) {
          /* Sans les DEUX bornes, aucun multiplicateur : une commune qui
             n'a pas de relevé en 2005 reste grise plutôt que de recevoir un
             rapport calculé sur une base absente. */
          if (d[k]) m[k] = Math.round(f[k] / d[k] * 100) / 100;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: "2005 à 2024, prix convertis en dollars",
                 unite: "fois plus cher qu'en 2005" };
      },
      source: "PAM (WFP) via OCHA HDX — calcul Atmart sur les prix convertis en dollars",
      limite: "LA HAUSSE EN GOURDES SERAIT TROIS FOIS PLUS FORTE : la marmite de maïs est multipliée par 10,8 en gourdes et par 3,5 en dollars entre 2005 et 2024. L'écart est la dépréciation de la monnaie ; ce qui reste sur cette carte est la hausse qui subsiste une fois la monnaie mise de côté. Le prix en dollars est une conversion appliquée par le PAM à un taux de référence mensuel, pas un taux obtenu au marché. Neuf communes documentées sur 140." },
    /* L'IPC RÉGIONAL DE L'IHSI. Cinq valeurs pour 140 communes : la carte
       montre cinq blocs, et elle le doit. C'est la seule ventilation
       territoriale que l'indice des prix haïtien possède — aucune source
       internationale ne descend sous le pays, et les indices départementaux,
       que l'IHSI calcule, ne sont pas publiés.

       NE PAS CONFONDRE AVEC L'AUTRE IPC de ce sélecteur : celui-ci mesure
       des PRIX, l'autre — le Cadre intégré de classification — mesure la
       FAIM. Les deux portent le même sigle et rien d'autre en commun. */
    { id: "ipc_prix", nom: "Indice des prix à la consommation, par région (IHSI)", type: "choroplethe",
      courbe: "lineaire",
      csv: "data/atmart_ipc_regions_communes_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {}, mois = "";
        rows.forEach(function (r) {
          m[r.pcode_commune] = +r.indice;
          mois = r.mois_reference || mois;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: TF("bulletin de {m}, base 100 en 2017-2018",
                             { m: moisT(mois) }),
                 unite: "points d'indice" };
      },
      source: "IHSI — Indice des prix à la consommation ; rattachement des régions aux communes par Atmart, passeport PSP-063",
      limite: "INDICE RÉGIONAL PORTÉ SUR LES COMMUNES, PAS UN INDICE COMMUNAL. Les 140 communes ne portent que CINQ valeurs, celles des cinq régions de l'IHSI : toutes les communes d'une même région affichent le même chiffre, et il serait faux d'en conclure qu'une commune est plus chère qu'une autre à l'intérieur d'une région. Les prix ne sont relevés QU'EN ZONE URBAINE alors que les pondérations couvrent villes et campagnes. Ces pondérations viennent de l'enquête ECVMAS de 2011-2012 et n'ont pas été actualisées depuis, pour un indice de base 2017-2018. Le découpage en régions ne recoupe pas les dix départements : « Reste Ouest » réunit l'Ouest hors métropole et le Sud-Est." },
    { id: "ipc_hausse", nom: "Hausse des prix sur douze mois, par région (IHSI)", type: "choroplethe",
      courbe: "lineaire",
      csv: "data/atmart_ipc_regions_communes_HT.csv", pcode: "pcode_commune",
      agreger: function (rows) {
        var m = {}, mois = "";
        rows.forEach(function (r) {
          m[r.pcode_commune] = +r.variation_annuelle_pct;
          mois = r.mois_reference || mois;
        });
        var vs = Object.keys(m).map(function (k) { return m[k]; });
        return { valeurs: m, min: vs.length ? Math.min.apply(null, vs) : 0,
                 periode: TF("glissement annuel au bulletin de {m}",
                             { m: moisT(mois) }),
                 unite: "% sur douze mois" };
      },
      source: "IHSI — Indice des prix à la consommation ; rattachement des régions aux communes par Atmart, passeport PSP-063",
      limite: "LE NIVEAU ET LA HAUSSE NE SE LISENT PAS ENSEMBLE : le Reste Ouest porte l'indice le plus élevé mais l'Aire Métropolitaine la hausse la plus forte. Un territoire peut être durablement cher sans se renchérir vite. Comme pour l'indice lui-même, les 140 communes ne portent que cinq valeurs — celles des régions — et l'écart entre la région la plus touchée et la moins touchée n'est que de 2,9 points, ce qui est peu au regard d'une inflation de 17 à 20 % partout." },
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

  COUCHES_17.push(
    { id: "a_verifier", nom: "Où notre information est la plus faible", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "familles_a_verifier",
      unite: "familles à vérifier sur 3", periode: "calcul Atmart du 18/08/2026",
      source: "Atmart Data — concordance entre MSPP/OSM (santé), MENFP/OSM (écoles), IHSI/UNFPA/WorldPop (population)",
      limite: "CETTE CARTE NE NOTE PAS LES TERRITOIRES. Une commune foncée n'est pas une commune mal équipée : c'est une commune sur laquelle nos sources se contredisent, ou sur laquelle une seule source existe. Elle mesure l'état de NOTRE information, jamais celui du terrain — et c'est ce qui la rend utile : elle désigne où envoyer des cartographes ou demander un registre." },
    { id: "ecart_sante", nom: "Santé — écart entre le déclaré et le vu", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecart_sante",
      unite: "rapport entre le plus haut et le plus bas", periode: "MSPP 2024 contre OSM du 06/08/2026",
      source: "Atmart Data — rapport entre le registre MSPP et l'extrait OpenStreetMap",
      limite: "Un rapport de 3 dit que l'une des deux sources se trompe lourdement — il ne dit PAS laquelle. Le registre garde une institution fermée non radiée ; la carte ignore ce qu'aucun contributeur n'a relevé. Les deux erreurs sont possibles et vont en sens inverse." },
    { id: "ecart_ecoles", nom: "Écoles — écart entre le déclaré et le vu", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecart_ecoles",
      unite: "rapport entre le plus haut et le plus bas", periode: "MENFP 2024-2025 contre OSM du 06/08/2026",
      source: "Atmart Data — rapport entre les registres MENFP et l'extrait OpenStreetMap",
      limite: "C'est la famille la plus discordante du pays : 80 communes sur 140 dépassent un facteur trois. L'écart mesure surtout l'état de la cartographie scolaire, pas le nombre d'écoles — à l'échelle nationale la carte ne montre que 41 % du registre." },
    { id: "ecart_population", nom: "Population — désaccord entre les trois sources", type: "choroplethe",
      csv: "data/atmart_couches_carte_HT.csv", pcode: "pcode_commune", colonne: "ecart_population",
      unite: "rapport entre le plus haut et le plus bas", periode: "IHSI 2024, projection UNFPA 2024, WorldPop 2020",
      source: "Atmart Data — rapport entre les trois estimations de population",
      limite: "La famille la plus solide : seules quatre communes dépassent un facteur trois. Un désaccord ne désigne pas la source fautive — sur Gressier, c'est la projection officielle qui est aberrante et le satellite qui s'accorde avec l'IHSI, l'inverse de ce qu'on supposerait." });

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
  /* Les <option> sont construits une fois, avant que le dictionnaire d'i18n
     ne soit chargé : ils restaient donc en français sur une page basculée.
     On réétiquette à l'événement de langue — la VALEUR ne bouge jamais, seul
     le texte change, sinon un lien partagé cesserait de fonctionner. */
  document.addEventListener("atmart:lang", function () {
    var sel = document.getElementById("k-choix");
    if (!sel) return;
    var opts = sel.querySelectorAll("option");
    for (var i = 0; i < opts.length; i++) {
      var c2 = COUCHES.filter(function (x) { return x.id === opts[i].value; })[0];
      if (c2 && c2.nom) opts[i].textContent = T(c2.nom);
    }
    var grs = sel.querySelectorAll("optgroup");
    for (var j = 0; j < grs.length; j++) {
      if (grs[j].dataset.fr) grs[j].label = T(grs[j].dataset.fr);
    }
    if (sel.value) afficher(sel.value);
  });

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

  /* Le bas de la rampe pour la valeur la plus faible. Zéro le rendrait
     presque indistinct du fond — qui est la teinte du « non documenté ». Une
     commune documentée ne doit jamais pouvoir se lire comme une commune sans
     donnée. */
  var PLANCHER = 0.18;

  function teinte(v, bas, max, nom, courbe) {
    /* `v == null` et non `!v` : un zéro documenté est une observation, pas un
       trou. Il prend le bas de la rampe ; seul l'inconnu prend la teinte du
       « non documenté ». */
    if (v == null) return nonDocumente();
    var R = RAMPES[nom] || RAMPES.alerte;
    var d = departTheme(R);
    /* LA RAMPE PART DE LA BORNE QUE LA LÉGENDE ANNONCE, et non de zéro.
       Elle partait de zéro jusqu'au 21/08/2026, ce qui écrasait toute carte
       dont les valeurs ne commencent pas près de zéro : l'indice des prix,
       entre 577 et 655, tenait dans les six derniers pour cent de la rampe
       et sortait d'une seule couleur. La légende, elle, affichait déjà
       « min → max » — les deux se contredisaient. */
    var etendue = max - bas;
    var p = etendue > 0 ? (v - bas) / etendue : 1;
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    /* L'exposant 0,45 comprime le haut de l'échelle, et c'est ce qu'il faut
       pour un COMPTAGE : sans lui, une commune très peuplée écraserait
       visuellement toutes les autres. Un INDICE, lui, a des valeurs presque
       régulièrement espacées — la compression y rendrait indiscernables deux
       régions que six points séparent. La couche choisit donc sa courbe ;
       sans déclaration, la racine, comme depuis toujours. */
    var t = PLANCHER + (1 - PLANCHER) *
            (courbe === "lineaire" ? p : Math.pow(p, 0.45));
    var m = function (i) { return Math.round(d[i] - t * (d[i] - R.arrivee[i])); };
    return "rgb(" + m(0) + "," + m(1) + "," + m(2) + ")";
  }

  /* Cette page est indépendante du moteur : elle n'a ni `T` ni `TF`. On les
     redéfinit ici, adossés au dictionnaire d'i18n quand il est chargé, et
     repliés sur le français sinon. La lecture guidée est la seule chose de
     cette page qui DOIT parler kreyòl : c'est elle qui décide si quelqu'un
     comprend la carte ou ferme la page. */
  function T(fr) {
    return (window.ATM_I18N && window.ATM_I18N.texte)
      ? window.ATM_I18N.texte(fr) : fr;
  }

  /* « Juin 26 » vient du tableau de l'IHSI : c'est une donnée, et une
     donnée ne traverse aucun T(). On ne traduit pas la chaîne entière —
     l'année change et il faudrait une clé neuve chaque mois — mais le seul
     mot qui soit du français : le mois. Douze clés, stables pour toujours. */
  function moisT(s) {
    var p = String(s || "").trim().split(/\s+/);
    return p.length === 2 ? T(p[0]) + " " + p[1] : T(s || "");
  }

  function TF(fr, vars) {
    var s = T(fr);
    Object.keys(vars || {}).forEach(function (k) {
      s = s.split("{" + k + "}").join(vars[k]);
    });
    return s;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  /* Le nom d'une commune depuis son p-code — une carte qui dit « HT0121 »
     n'explique rien à personne. */
  function nomDe(pcode) {
    var f = communes && communes.features.filter(function (x) {
      return x.properties.pcode === pcode; })[0];
    return f ? f.properties.nom_fr : pcode;
  }

  function mediane(liste) {
    var t = liste.slice().sort(function (a, b) { return a - b; });
    if (!t.length) return null;
    var m = Math.floor(t.length / 2);
    return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
  }

  function lectureGuidee(couche, agg, nonDoc) {
    var e = $("#k-lecture-guidee");
    if (!e) return;
    var vals = agg.valeurs, codes = Object.keys(vals);
    if (!codes.length) { e.innerHTML = ""; return; }

    var paires = codes.map(function (p) { return [p, vals[p]]; })
                      .sort(function (a, b) { return b[1] - a[1]; });
    var med = mediane(codes.map(function (p) { return vals[p]; }));
    var uFr = agg.unite || "";
    var u = T(uFr), nom = T(couche.nom || "");
    /* L'unité COURTE pour les listes : « minutes de route (médiane des
       habitants) » répété six fois noie les trois noms de communes, qui sont
       la seule chose que l'œil doit retenir. La forme longue reste dans la
       phrase d'introduction, où elle est utile une fois. */
    var uc = u.split("(")[0].trim();
    /* Le nom sans sa parenthèse méthodologique, et sans mise en minuscules
       brutale : « calcul Atmart » y perdait sa majuscule. */
    var nomCourt = nom.split("(")[0].trim();
    nomCourt = nomCourt.charAt(0).toLowerCase() + nomCourt.slice(1);
    /* Une échelle de TEMPS se lit à l'envers d'une échelle de quantité : le
       « plus » de minutes est le plus MAL desservi. Sans cette phrase, la
       carte se lit exactement de travers — et c'est la carte la plus utile
       du site. */
    /* Sur l'unité d'ORIGINE, jamais sur la traduite : « minutes de route »
       contient « minute », « minit sou wout » ne le contient pas. Tester la
       chaîne traduite faisait perdre l'inversion de sens — beaucoup de
       minutes = mal desservi — précisément pour les lecteurs kreyòl. */
    var temps = /minute/.test(uFr);

    var h = ['<details class="k-guide" open><summary>' +
             T("Comment lire cette carte") + "</summary><div>"];
    h.push("<p>" + TF(
      "Chaque commune est colorée selon {quoi}, mesuré en {unite}. Plus la " +
      "couleur est foncée, plus la valeur est élevée.",
      { quoi: "<b>" + esc(nomCourt) + "</b>", unite: "<b>" + esc(uc) + "</b>" }) +
      (temps ? " " + T("Ici une couleur foncée signale un territoire ÉLOIGNÉ des services : c'est l'inverse d'une bonne nouvelle.") : "") +
      "</p>");
    h.push("<p>" + TF(
      "La valeur la plus courante est d'environ {med} {unite} — c'est le repère " +
      "auquel comparer une commune avant de la dire élevée ou basse.",
      { med: "<b>" + fmtN(Math.round(med * 10) / 10) + "</b>", unite: esc(uc) }) + "</p>");

    var liste = function (t) {
      return t.map(function (x) {
        return "<li><b>" + esc(nomDe(x[0])) + "</b> — " +
               fmtN(Math.round(x[1] * 10) / 10) + " " + esc(uc) + "</li>";
      }).join("");
    };
    h.push('<div class="k-guide-cols"><div><p>' +
      (temps ? T("Les plus éloignées") : T("Les plus élevées")) + "</p><ul>" +
      liste(paires.slice(0, 3)) + "</ul></div><div><p>" +
      (temps ? T("Les mieux desservies") : T("Les plus basses")) + "</p><ul>" +
      liste(paires.slice(-3).reverse()) + "</ul></div></div>");

    if (nonDoc) {
      h.push('<p class="k-guide-att">' + TF(
        "{n} commune(s) restent en gris, avec un contour tireté. Elles ne " +
        "valent PAS zéro : la source ne les couvre pas. Ne les lisez pas " +
        "comme des communes où il n'y a rien.", { n: "<b>" + nonDoc + "</b>" }) + "</p>");
    }
    if (couche.limite) {
      var lim = T(couche.limite);
      /* Le paragraphe de limite porte l'essentiel de la prudence. Le masquer
         faute de traduction reviendrait à publier une carte SANS son
         avertissement — pire que de le publier en français. On l'affiche, et
         on nomme la situation : le lecteur sait que c'est un chantier en
         cours, pas une panne ni un oubli. */
      h.push('<p class="k-guide-att"><b>' + T("Ce que cette carte ne dit pas") +
             "</b> — " + esc(lim) +
             (lim === couche.limite && T("Limite") !== "Limite"
               ? ' <i class="k-guide-fr">' + T("Ce paragraphe n'est pas encore " +
                 "traduit — il reste en français pour ne pas être perdu.") + "</i>"
               : "") + "</p>");
    }
    h.push('<p class="k-guide-sui">' + T(
      "Touchez une commune pour lire sa valeur ; touchez-la encore pour ouvrir sa fiche.") +
      "</p></div></details>");
    e.innerHTML = h.join("");
  }

  function rendreChoroplethe(couche, rows) {
    var agg = couche.agreger(rows);
    var vals = agg.valeurs;
    var max = 0, nonDoc = 0;
    Object.keys(vals).forEach(function (k) { if (vals[k] > max) max = vals[k]; });
    /* La borne basse est celle que la couche déclare — la même que la légende
       affiche. Sans déclaration, zéro : le comportement d'avant, pour les
       couches dont le zéro est un vrai plancher. */
    var bas = agg.min !== undefined ? agg.min : 0;
    var svg = communes.features.map(function (f) {
      var p = f.properties, v = vals[p.pcode];
      var doc = v !== undefined;
      if (!doc) nonDoc++;
      return '<path class="k-com' + (doc ? "" : " k-vide") + '" data-id="' + p.atmart_geo_id + '" fill="' +
        (doc ? teinte(v, bas, max, couche.rampe, couche.courbe) : nonDocumente()) + '" d="' + chemin(f.geometry) + '"><title>' + p.nom_fr +
        (doc ? " — " + fmtN(v) + " " + T(agg.unite)
             : " — " + T("non documenté")) + "</title></path>";
    }).join("");
    var leg = '<span class="k-grad k-grad-' + (couche.rampe || "alerte") + '"></span> ' +
              (agg.min !== undefined ? fmtN(agg.min) : "0") + " → " + fmtN(max) + " " + T(agg.unite) +
              " · " + T(agg.periode) +
              (agg.couverture ? " · " + agg.couverture : "");
    /* Le gris des communes sans valeur ne se distingue pas d'un minimum pâle
       à l'œil : tant qu'il n'est pas COMPTÉ dans la légende, une carte
       incomplète se lit comme une carte complète où tout va bien. */
    if (nonDoc) {
      leg += ' · <b class="k-manque">' +
        TF("{n} commune(s) en gris : non documenté, jamais zéro", { n: nonDoc }) +
        "</b>";
    }
    dessiner(svg + nomsDepartements(), leg, couche);
    lectureGuidee(couche, agg, nonDoc);
    memoriserFaits(couche, agg, nonDoc);
  }

  /* Ce que l'assistant a le droit de savoir sur cette page : la couche
     affichée, sa source, sa limite, et TOUTES ses valeurs commune par
     commune. Rien d'autre — ni les autres couches, ni le reste du site.

     Les valeurs sont données en entier plutôt qu'en extrait : 140 lignes
     tiennent largement dans le contexte, et un extrait obligerait à choisir
     d'avance quelles communes méritent une réponse. */
  var derniereCarte = null;

  function memoriserFaits(couche, agg, nonDoc) {
    var vals = agg.valeurs, codes = Object.keys(vals);
    var paires = codes.map(function (p) { return [nomDe(p), vals[p]]; })
                      .sort(function (a, b) { return b[1] - a[1]; });
    var med = mediane(codes.map(function (p) { return vals[p]; }));
    var l = [];
    l.push("PAGE : cartes thématiques de l'Explorateur Haïti (140 communes).");
    l.push("CARTE AFFICHÉE : " + couche.nom);
    l.push("UNITÉ : " + (agg.unite || "—"));
    l.push("PÉRIODE : " + (agg.periode || "—"));
    l.push("SOURCE : " + (couche.source || "—"));
    l.push("LIMITE DE CETTE CARTE : " + (couche.limite || "—"));
    l.push("COUVERTURE : " + codes.length + " communes documentées sur 140 ; " +
           nonDoc + " en gris, non documentées — une absence n'est jamais un zéro.");
    if (med !== null) l.push("VALEUR MÉDIANE : " + (Math.round(med * 10) / 10));
    if (paires.length) {
      l.push("VALEUR LA PLUS HAUTE : " + paires[0][0] + " = " + (Math.round(paires[0][1] * 10) / 10));
      l.push("VALEUR LA PLUS BASSE : " + paires[paires.length - 1][0] + " = " +
             (Math.round(paires[paires.length - 1][1] * 10) / 10));
    }
    l.push("");
    l.push("VALEURS PAR COMMUNE (nom = valeur) :");
    paires.forEach(function (x) {
      l.push(x[0] + " = " + (Math.round(x[1] * 10) / 10));
    });
    derniereCarte = l.join(String.fromCharCode(10));
  }

  /* Publié pour assistant.js, qui ne va jamais chercher les données lui-même :
     une seule source de vérité par page. */
  window.ATM_FAITS = function () { return derniereCarte || ""; };
  window.ATM_FAITS_SUGGESTIONS = function () {
    return ["Que montre cette carte, en clair ?",
            "Quelles communes sont les plus concernées, et pourquoi ?",
            "Qu'est-ce que cette carte ne permet PAS de conclure ?"];
  };

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
    /* Les phases sont par DÉPARTEMENT, jamais par commune : l'assistant doit
       le savoir avant qu'on lui pose une question communale. */
    var parPhase = {};
    Object.keys(parDep).forEach(function (pc) {
      var d = parDep[pc], mieux = -1, ph = "";
      Object.keys(d.phases).forEach(function (p) {
        if (d.phases[p] > mieux) { mieux = d.phases[p]; ph = p; }
      });
      if (ph) parPhase[ph] = (parPhase[ph] || 0) + 1;
    });
    dessiner(svg, leg, couche, [
      { visible: T("Chaque département porte la phase majoritaire en "
                 + "population. Il n'existe pas de phase par commune."),
        fait: "GRANULARITÉ : par DÉPARTEMENT (" + Object.keys(parDep).length +
              " documentés sur 10), jamais par commune. Répartition des " +
              "phases majoritaires : " +
              Object.keys(parPhase).sort().map(function (p) {
                return p + " = " + parPhase[p] + " département(s)";
              }).join(", ") + ". Période affichée : " + libPeriode + "." }
    ]);
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
             { source: T(doc.source || "") + " — " + T(doc.licence || ""),
               limite: doc.limite || couche.limite || "" },
             [{ visible: T("Cette carte pose des formes sur le fond des "
                         + "communes : elle n'attribue aucune valeur à une "
                         + "commune."),
                fait: "AUCUNE VALEUR PAR COMMUNE : cette carte est un tracé de "
                    + doc.features.length + " entité(s) posé sur le fond "
                    + "communal. Ne pas répondre commune par commune." }]);
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
    /* La valeur d'une commune est ici une CLASSE, pas un nombre : on publie
       la répartition, et on interdit toute arithmétique dessus. */
    var parCl = {};
    Object.keys(meilleur).forEach(function (pc) {
      parCl[meilleur[pc].cl] = (parCl[meilleur[pc].cl] || 0) + 1;
    });
    dessiner(svg + nomsDepartements(), leg, couche, [
      { visible: TF("Chaque commune porte sa classe DOMINANTE, pas une "
                  + "valeur : {n} classes distinctes sur la carte.",
                    { n: classes.length }),
        fait: "VALEURS QUALITATIVES, PAS NUMÉRIQUES : chaque commune porte sa "
            + "classe dominante. Aucune moyenne, aucun classement n'a de sens "
            + "ici. Répartition : " +
            Object.keys(parCl).sort(function (a, b) { return parCl[b] - parCl[a]; })
              .map(function (cl) { return cl + " = " + parCl[cl] + " commune(s)"; })
              .join(", ") + ". " + (140 - Object.keys(meilleur).length) +
            " commune(s) non couverte(s)." }
    ]);
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
      /* LE NOM DE L'OBJET, QUAND LA SOURCE LE PORTE. Les couches financière
         et touristique le portent depuis toujours ; la carte le jetait. Le
         lecteur voyait qu'il y a une banque quelque part, jamais laquelle,
         alors que la réponse était dans le fichier qu'il venait de
         télécharger. Un nom d'enseigne ne se traduit pas — c'est un nom
         propre — mais son TYPE, lui, passe par T(). */
      var nom = f.properties.e || f.properties.n || "";
      var titre = (nom ? esc(nom) + " — " : "") + esc(T(cl.l || ""));
      return '<circle r="2.6" fill="' + cl.c + '" fill-opacity="0.75" cx="' +
        proj.x(c[0]).toFixed(1) + '" cy="' + proj.y(c[1]).toFixed(1) + '">' +
        (titre.trim() ? "<title>" + titre + "</title>" : "") + "</circle>";
    }).join("");
    /* LA LÉGENDE PASSE PAR T(), depuis le 20/08/2026. Elle ne le faisait
       pas : « fonctionnel », « banque », « agence de transfert » restaient
       en français sous une interface kreyol ou espagnole. C'est la
       quatrième voie d'échappement du même défaut — une chaîne lue depuis
       une structure de données ne traverse aucun attribut data-i18n, donc
       aucun contrôle ne la voyait manquer. Les noms propres (Digicel,
       Natcom) retombent en français par T(), et c'est exactement ce qu'il
       faut : ils n'ont pas d'autre forme. */
    var leg = Object.keys(couche.classes).map(function (k) {
      return '<span class="k-p" style="background:' + couche.classes[k].c + '"></span>' +
             T(couche.classes[k].l);
    /* « points » et le millésime restaient en français : le premier était
       écrit en dur dans la concaténation, le second lu depuis le fichier de
       données. Ni l'un ni l'autre ne traversait T(), et ni l'un ni l'autre
       n'était visible dans le HTML — donc aucun contrôle ne les voyait. */
    }).join("  ") + " · " + fmtN(doc.features.length) + " " + T("points") +
      " · " + T(doc.millesime || "");
    /* UNE COUCHE DE POINTS N'A PAS DE VALEUR PAR COMMUNE. C'est la carte qui
       a déclenché le signalement du 21/08 : le lecteur voyait la lecture
       guidée des conflits sous les points d'eau, et l'assistant répondait
       avec les chiffres des conflits. */
    var parCl = {}, parNom = {}, sansNom = 0;
    doc.features.forEach(function (f) {
      var p = f.properties || {};
      var k = p[couche.prop] || "";
      parCl[k] = (parCl[k] || 0) + 1;
      var nom = p.e || p.n || "";
      if (nom) parNom[nom] = (parNom[nom] || 0) + 1;
      else sansNom++;
    });
    /* Les enseignes les plus fréquentes, jamais la liste entière : deux
       cents lignes de faits noieraient la source, la limite et la consigne —
       c'est-à-dire tout ce qui empêche une réponse fausse. */
    var noms = Object.keys(parNom)
      .sort(function (a, b) { return parNom[b] - parNom[a]; });
    var faitsNoms = noms.length
      ? ("ENSEIGNES RELEVÉES : " + noms.length + " distinctes sur " +
         (doc.features.length - sansNom) + " objet(s) nommés ; " + sansNom +
         " sans enseigne. Les plus fréquentes : " +
         noms.slice(0, 12).map(function (n) { return n + " (" + parNom[n] + ")"; })
             .join(", ") + ". Cette liste vient de la cartographie "
       + "contributive : une enseigne absente ici n'est pas absente du pays.")
      : "";
    dessiner(fond + pts + nomsDepartements(), leg,
             { source: T(doc.source) + " — " + T(doc.licence),
               limite: doc.limite || couche.limite },
             [{ visible: T("Chaque point est un objet relevé à sa position, "
                         + "pas une valeur attribuée à une commune."),
                fait: "AUCUNE VALEUR PAR COMMUNE : " + doc.features.length +
                      " point(s) posés à leur position. Répartition par "
                    + "classe : " +
                    Object.keys(parCl).map(function (k) {
                      var cl = couche.classes && couche.classes[k];
                      return (cl && cl.l ? cl.l : (k || "sans classe")) +
                             " = " + parCl[k];
                    }).join(", ") +
                    ". Ne pas répondre commune par commune, et ne compter "
                  + "aucun point pour une commune : ce décompte n'existe pas "
                  + "sur cette carte." },
               { visible: noms.length
                   ? TF("{n} enseignes différentes sont relevées ; survolez un "
                      + "point pour lire la sienne.", { n: noms.length })
                   : "",
                 fait: faitsNoms }]);
  }

  /* RENDU D'UN MANQUE JURIDIQUE.
     Ce n'est ni une carte vide, ni une erreur : c'est une page qui dit ce
     qu'on sait, pourquoi on ne le montre pas, et où le lire. On n'y écrit
     AUCUN chiffre — pas même un ordre de grandeur « pour situer » : citer
     une valeur qu'on s'interdit de publier serait publier quand même, en
     plus petit. */
  function rendreManqueJuridique(couche) {
    var liens = (couche.lire || []).map(function (x) {
      return '<li><a href="' + esc(x[1]) + '" rel="noopener noreferrer" ' +
             'target="_blank">' + esc(T(x[0])) + "</a></li>";
    }).join("");
    $("#k-carte").innerHTML =
      '<div class="k-interdit" role="note">' +
      "<h3>" + esc(T("Donnée non republiable")) + "</h3>" +
      "<p>" + esc(T(couche.motif || "")) + "</p>" +
      (liens ? "<p>" + esc(T("Où la consulter directement")) +
               " :</p><ul>" + liens + "</ul>" : "") +
      "<p>" + esc(T("Si l'Organisation internationale pour les migrations " +
                    "autorise un jour cette republication par écrit, la couche " +
                    "reviendra telle quelle.")) + "</p></div>";
    $("#k-legende").innerHTML = "";
    $("#k-source").textContent = T("Source : ") + T(couche.source);
    $("#k-limite").textContent = T("Limite : ") + T(couche.limite);
    /* Ce rendu n'appelle pas dessiner() — il n'y a pas de carte à dessiner.
       Il doit donc vider lui-même les deux blocs que dessiner() remet à zéro,
       sans quoi la lecture guidée et le relevé tactile de la carte
       précédente resteraient sous une page qui dit « aucune donnée ». */
    var g = $("#k-lecture-guidee");
    if (g) g.innerHTML = "";
    var lec = $("#k-lecture");
    if (lec) lec.textContent = "";
    /* L'assistant doit savoir qu'il n'a AUCUNE valeur ici. Sans cette
       publication il garderait les faits de la carte précédente et
       répondrait sur des déplacés avec les chiffres d'une autre couche —
       la pire forme d'hallucination, celle qui est arithmétiquement juste. */
    derniereCarte = [
      "PAGE : cartes thématiques de l'Explorateur Haïti (140 communes).",
      "CARTE AFFICHÉE : " + couche.nom,
      "AUCUNE VALEUR N'EST DISPONIBLE SUR CETTE PAGE.",
      "MOTIF : " + (couche.motif || ""),
      "SOURCE : " + (couche.source || "—"),
      "LIMITE DE CETTE CARTE : " + (couche.limite || "—"),
      "CONSIGNE : ne citer aucun nombre de personnes déplacées ; renvoyer le " +
      "lecteur vers dtm.iom.int."
    ].join(String.fromCharCode(10));
  }

  /* CE QUE TOUTE CARTE REMET À ZÉRO EN S'AFFICHANT.

     Trois blocs portent l'état de la carte : la lecture guidée, le relevé
     tactile, et les faits publiés à l'assistant. Jusqu'au 21/08/2026 seul le
     rendu des choroplèthes les écrivait — les cinq autres laissaient ceux de
     la carte précédente. Un lecteur ouvrant les points d'eau lisait la
     lecture guidée des conflits, et l'assistant lui répondait avec les
     chiffres des conflits.

     Les faits posés ici sont MINIMAUX mais justes ; le rendu des choroplèthes
     les remplace ensuite par sa version détaillée. Mieux vaut un assistant
     qui dit « je n'ai pas cette information » qu'un assistant juste sur la
     mauvaise carte. */
  function remettreAZero(meta, faits) {
    var lec = $("#k-lecture");
    if (lec) lec.textContent = "";

    var nom = (COURANTE && COURANTE.nom) || "";
    var src = meta.source || (COURANTE && COURANTE.source) || "";
    var lim = meta.limite || (COURANTE && COURANTE.limite) || "";

    var g = $("#k-lecture-guidee");
    if (g) {
      var h = ['<details class="k-guide" open><summary>' +
               T("Comment lire cette carte") + "</summary><div>"];
      h.push("<p>" + TF("Cette carte affiche {c}.", { c: esc(T(nom)) }) + "</p>");
      (faits || []).forEach(function (f) {
        if (f && f.visible) h.push("<p>" + esc(f.visible) + "</p>");
      });
      if (lim) {
        h.push('<p class="k-guide-att"><b>' + T("Ce que cette carte ne dit pas") +
               "</b> — " + esc(T(lim)) + "</p>");
      }
      h.push("</div></details>");
      g.innerHTML = h.join("");
    }

    var l = ["PAGE : cartes thématiques de l'Explorateur Haïti (140 communes).",
             "CARTE AFFICHÉE : " + nom,
             "SOURCE : " + (src || "—"),
             "LIMITE DE CETTE CARTE : " + (lim || "—")];
    (faits || []).forEach(function (f) { if (f && f.fait) l.push(f.fait); });
    l.push("CONSIGNE : ne répondre QUE sur la carte ci-dessus. Si la question "
         + "porte sur une valeur qui n'y figure pas, le dire — ne jamais "
         + "reprendre les chiffres d'une autre carte.");
    derniereCarte = l.join(String.fromCharCode(10));
  }

  function dessiner(svgCorps, legende, meta, faits) {
    $("#k-carte").innerHTML =
      '<svg viewBox="0 0 ' + L + " " + H + '" role="img" preserveAspectRatio="xMidYMid meet">' +
      svgCorps + "</svg>";
    $("#k-legende").innerHTML = legende;
    $("#k-source").textContent = T("Source : ") + T(meta.source);
    $("#k-limite").textContent = T("Limite : ") + T(meta.limite);
    remettreAZero(meta, faits);
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
    /* CETTE PHRASE ÉTAIT ASSEMBLÉE PAR CONCATÉNATION, donc invisible au
       moteur de traduction ET au contrôle qui cherche les appels à T(). Un
       lecteur anglophone lisait « Les 140 communes sont documentées » sous
       une carte par ailleurs traduite. Signalé le 19/08/2026.

       Le morceau à retenir : ce n'est pas la traduction qui manquait, c'est
       le POINT DE PASSAGE. Une chaîne qui ne traverse jamais T() ne manque à
       personne — ni au traducteur, ni au contrôle. On assemble donc des
       phrases entières avec des variables, jamais des fragments cousus. */
    if (!gris) {
      e.className = "";
      e.textContent = TF("Les {n} communes sont documentées.", { n: tous.length });
      return;
    }
    /* Sous la moitié du pays, ce n'est plus une précision : c'est ce qu'il
       faut savoir avant de regarder la carte. */
    e.className = part < 50 ? "k-creuse" : "";
    /* L'accord se fait, y compris au singulier : « Les 1 communes en gris »
       sur une carte qui se veut soignée décrédibilise tout ce qui l'entoure.
       Chaque forme est une phrase COMPLÈTE dans le dictionnaire : une langue
       qui accorde autrement — ou qui ne distingue pas le singulier, comme le
       kreyòl — peut alors écrire ce qui lui convient au lieu de subir la
       grammaire française par morceaux. */
    var un = gris === 1;
    e.textContent =
      (doc > 1 ? TF("{d} communes documentées sur {t} ({p} %).",
                    { d: doc, t: tous.length, p: part })
               : TF("{d} commune documentée sur {t} ({p} %).",
                    { d: doc, t: tous.length, p: part })) + " " +
      (un ? T("La commune en gris n'est pas une commune à zéro : la source ne la couvre pas.")
          : TF("Les {g} communes en gris ne sont pas des communes à zéro : la source ne les couvre pas.",
               { g: gris })) +
      (part < 50
        ? " " + T("Cette carte montre l'étendue d'une source, pas celle du phénomène.")
        : "");
  }

  /* ------------------------------------------------------------ démarrage */
  var cache = {};
  /* La couche affichée, retenue au niveau du module : `dessiner()` reçoit
     parfois un `meta` bâti depuis le fichier de données, qui ne porte pas le
     nom de la couche. Sans cette variable, le bloc de remise à zéro ne
     saurait pas de quelle carte il parle. */
  var COURANTE = null;

  function afficher(id) {
    var couche = COUCHES.filter(function (c) { return c.id === id; })[0];
    if (!couche) return;
    COURANTE = couche;
    $("#k-attente").hidden = false;
    var fini = function () { $("#k-attente").hidden = true; };
    try { history.replaceState(null, "", "?couche=" + id); } catch (e) {}
    /* Le manque juridique se rend AVANT tout chargement : il n'y a pas de
       fichier à charger, et il ne doit pas y en avoir. Placer ce test après
       aurait appelé charger(undefined) et affiché « le fichier n'a pas pu
       être chargé » — c'est-à-dire une panne, là où il y a une décision. */
    if (couche.type === "manque_juridique") {
      rendreManqueJuridique(couche);
      fini();
      return;
    }
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
                     /* Les prix ont leur groupe et ne rejoignent pas
                        « Conjoncturel » : la faim et le prix du maïs se
                        ressemblent assez pour qu'on les confonde, et l'une
                        est une classification d'experts quand l'autre est un
                        relevé de marché. */
                     /* L'indice officiel d'abord, le relevé de marché
                        ensuite : le premier couvre les 140 communes par ses
                        régions, le second neuf communes mais avec des prix
                        réels. Ils ne se remplacent pas. */
                     ["Prix — indice officiel et relevés de marché",
                      ["ipc_prix", "ipc_hausse", "prix_mais", "prix_hausse_usd"]],
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
                     /* Le tourisme a son groupe et non une place dans
                        « Services » : ce n'est pas un service rendu aux
                        habitants, c'est une activité économique, et les deux
                        questions ne se posent pas dans le même sens. */
                     ["Tourisme — ce qui est cartographié et ce qui est classé",
                      ["tourisme", "hebergement_nb", "hibiscus"]],
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
                     /* Ce groupe existait déjà pour deux cartes ; il en
                        accueille quatre de plus. Les mettre ailleurs aurait
                        été la faute la plus grave que ce site puisse
                        commettre : confondre « où l'école manque » et « où
                        notre information sur l'école est faible ». */
                     ["Ce que l'on sait — qualité de l'information",
                      ["a_verifier", "ecart_sante", "ecart_ecoles",
                       "ecart_population", "ecoles_absentes", "pop_desaccord"]],
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
        og.label = T(g[0]);
        og.dataset.fr = g[0];
        g[1].forEach(function (id) {
          var c = COUCHES.filter(function (x) { return x.id === id; })[0];
          if (!c) return;
          var o = document.createElement("option");
          o.value = c.id; o.textContent = T(c.nom);
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
