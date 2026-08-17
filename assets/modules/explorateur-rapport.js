/* Module « rapport » du moteur — 17/08/2026.

   CE QUE C'EST : le rapport de territoire imprimable, décidé le 16/08.
   Un document qu'un maire, une ONG ou un étudiant pose sur une table de
   réunion. Pas une capture d'écran du site.

   ------------------------------------------------------------------
   POURQUOI LA FEUILLE D'IMPRESSION, ET PAS UNE BIBLIOTHÈQUE PDF
   ------------------------------------------------------------------
   L'Explorateur est statique : GitHub Pages, aucun serveur, aucun compte,
   aucun traceur. Une bibliothèque de génération PDF pèse plusieurs
   centaines de kilooctets — plus que l'édition légère entière — devrait
   être embarquée pour passer la CSP (`script-src 'self'` + empreintes),
   et produirait un PDF dont les polices et la pagination seraient à
   reconstruire à la main.

   Le navigateur, lui, SAIT déjà faire un PDF. Ce qui manquait n'était pas
   un moteur de rendu : c'était un DOCUMENT à lui donner. `window.print()`
   sur la fiche telle qu'elle s'affiche imprime un site web amputé de ses
   menus — l'ordre est celui de l'écran, l'en-tête n'existe pas, et la page
   des sources n'existe nulle part.

   Ce module construit donc le document, dans le navigateur du lecteur, à
   partir des données DÉJÀ chargées. Zéro octet de dépendance, zéro appel
   réseau vers un service de génération, rien qui sorte de l'appareil.

   ------------------------------------------------------------------
   POURQUOI RÉEMPLOYER LES CONSTRUCTEURS DE LA FICHE
   ------------------------------------------------------------------
   Chaque couche a déjà sa fonction `htmlXxx(r)` dans explorateur-fiche.js,
   et cette fonction porte SES avertissements et SA source. Réécrire ces
   textes ici en produirait une seconde version, qui divergerait au premier
   correctif — et un rapport imprimé qui circule sans son contexte, sourcé
   sur une copie périmée, est exactement la rumeur avec un logo qu'on veut
   éviter. On appelle donc les mêmes fonctions ; ce module ne décide que de
   l'ORDRE, de l'en-tête et de la page des sources.

   ------------------------------------------------------------------
   POURQUOI L'ORDRE EST CELUI-CI
   ------------------------------------------------------------------
   L'écran laisse défiler ; le papier, non. Un lecteur qui pose ce document
   sur une table lit dans l'ordre : où suis-je, combien sommes-nous, sur
   quoi vivons-nous, qu'est-ce qui nous menace, qu'avons-nous, et d'où tout
   cela vient. La fiche à l'écran suit un autre ordre — celui de l'arrivée
   des couches dans le produit — qui n'a aucune raison d'être imposé au
   papier. */
import { S } from "./etat.js?v=25";
export default function (A) {
  /* Du noyau et d'i18n uniquement : ces deux-là sont chargés avant ce
     module. Tout ce qui vient de la fiche est appelé par `A.` au moment
     du clic, jamais capturé à l'initialisation — sans quoi un changement
     d'ordre dans la liste des modules casserait le rapport en silence. */
  const { $, NIVEAU, SITE, T, TF, esc, fmt, jour, nb, parId } = A;

  /* --------------------------------------------------------------------
     Les treize couches, déclarées une seule fois.
     `cle`     : où la couche vit dans l'état partagé
     `charger` : la fonction de chargement, idempotente et mise en cache
     `html`    : le constructeur de bloc de la fiche
     `titre`   : le nom du jeu dans le tableau des sources

     Le rapport peut être demandé depuis une fiche en longueur « Court »,
     où aucun de ces blocs n'a été rendu et où aucune de ces couches n'a
     donc été chargée. On les charge toutes avant de construire : c'est le
     seul moyen qu'un rapport soit le même quelle que soit la longueur de
     fiche affichée à l'écran au moment du clic. */
  var COUCHES = [
    { cle: "sol",          charger: "chargerSol",          html: "htmlSol",          titre: "Occupation du sol" },
    { cle: "urbanisation", charger: "chargerUrbanisation", html: "htmlUrbanisation", titre: "Croissance du bâti" },
    { cle: "batiments",    charger: "chargerBatiments",    html: "htmlBatiments",    titre: "Bâtiments détectés" },
    { cle: "eau",          charger: "chargerEau",          html: "htmlEau",          titre: "Eau de surface" },
    { cle: "bassins",      charger: "chargerBassins",      html: "htmlBassins",      titre: "Bassins versants" },
    { cle: "sols",         charger: "chargerSols",         html: "htmlSols",         titre: "Propriétés des sols" },
    { cle: "solaire",      charger: "chargerSolaire",      html: "htmlSolaire",      titre: "Potentiel solaire" },
    { cle: "seismes",      charger: "chargerSeismes",      html: "htmlSeismes",      titre: "Histoire sismique" },
    { cle: "cyclones",     charger: "chargerCyclones",     html: "htmlCyclones",     titre: "Cyclones" },
    { cle: "pluie",        charger: "chargerPluie",        html: "htmlPluie",        titre: "Pluie et sécheresse" },
    { cle: "equipements",  charger: "chargerEquipements",  html: "htmlEquipements",  titre: "Santé et écoles cartographiées" },
    { cle: "projets",      charger: "chargerProjets",      html: "htmlProjets",      titre: "Projets citant le territoire" },
    { cle: "popMod",       charger: "chargerPopMod",       html: "htmlPopMod",       titre: "Population modélisée" }
  ];

  /* Les sections du rapport, dans l'ordre du papier.

     CE QUI EST DEHORS EST UN CHOIX, PAS UN OUBLI. Les treize couches sont
     chargées ; deux ne sont pas imprimées — bâtiments détectés et propriétés
     des sols — parce qu'un rapport de cinq pages qu'on lit en entier vaut
     mieux qu'un de huit qu'on feuillette, et que ces deux-là répondent à des
     questions qu'on se pose devant un écran, pas autour d'une table.
     Le rapport le DIT (voir `renvoiFiche`) au lieu de laisser croire que
     l'Explorateur n'en sait pas davantage.

     Le potentiel solaire, lui, RESTE : son avertissement — un résultat de
     modèle n'est pas une étude de faisabilité — est précisément le genre de
     phrase qui doit voyager avec le chiffre quand la feuille circule sans
     son site. Le retirer aurait fait gagner une demi-colonne et perdre la
     seule chose qui empêche ce chiffre d'être cité de travers. */
  var TERRITOIRE = ["sol", "urbanisation", "eau", "bassins", "solaire"];
  var RISQUES = ["seismes", "cyclones", "pluie"];
  var EQUIPEMENTS = ["equipements", "projets"];
  var HORS_RAPPORT = ["batiments", "sols"];

  function couche(cle) {
    for (var i = 0; i < COUCHES.length; i++) if (COUCHES[i].cle === cle) return COUCHES[i];
    return null;
  }

  /* Le millésime d'une couche n'a pas le même nom d'un producteur à
     l'autre — période observée, version du produit, date d'extraction.
     On prend le premier qui existe plutôt que d'imposer un champ unique
     que les treize passeports n'ont jamais eu. */
  function millesime(m) {
    var v = m.millesime || m.periode || m.periode_modelisee || m.millesimes ||
            m.version || m.extrait_le || m.date_extraction || "";
    return Array.isArray(v) ? v.join(", ") : String(v || "");
  }

  /* -------------------------------------------------------------- en-tête */

  /* Le nom du département et de l'arrondissement, en clair : `fil()` de la
     fiche produit des boutons, qui n'ont aucun sens sur du papier. */
  function ascendants(r) {
    var ch = [], cur = parId[r.parent_atmart_geo_id], g = 0;
    while (cur && g++ < 6) { ch.unshift(cur); cur = parId[cur.parent_atmart_geo_id]; }
    return {
      dep: ch.filter(function (x) { return x.niveau_admin === "1"; })[0],
      arr: ch.filter(function (x) { return x.niveau_admin === "2"; })[0]
    };
  }

  /* L'adresse imprimée est CANONIQUE, pas celle de la barre du navigateur :
     `location.href` traîne l'onglet actif, la comparaison en cours et la
     longueur de fiche choisie. Un lecteur qui retape l'adresse d'un rapport
     doit tomber sur la fiche, pas sur l'état d'un inconnu. */
  function adresseFiche(r) {
    return location.origin + location.pathname + "?id=" + r.atmart_geo_id +
           (S.LANG !== "fr" ? "&lang=" + S.LANG : "");
  }

  /* La date d'édition est celle du CLIC, pas celle de la donnée : c'est ce
     qui permet, six mois plus tard, de savoir si la feuille posée sur la
     table est encore celle du site. */
  function aujourdhui() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return jour(d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()));
  }

  function ligne(cle, valeur) {
    return "<tr><th scope=\"row\">" + esc(cle) + "</th><td>" + valeur + "</td></tr>";
  }

  function entete(r) {
    var a = ascendants(r);
    var sup = A.valeurBrute(r, "IND-GEO-001");
    var url = adresseFiche(r);
    var h = ['<header class="r-tete">'];
    h.push('<p class="r-marque">Explorateur Haïti <span>·</span> Atmart Data</p>');
    h.push('<p class="r-genre">' + T("Rapport de territoire") + "</p>");
    h.push("<h1>" + esc(A.nomT(r)) +
      (A.nomSecond(r) ? ' <span class="r-nom2" lang="' +
        (S.LANG === "ht" ? "fr" : "ht") + '">' + esc(A.nomSecond(r)) + "</span>" : "") +
      "</h1>");
    h.push('<p class="r-situe">' + esc(A.situe(r)) + "</p>");
    h.push('<table class="r-id">');
    if (a.dep) h.push(ligne(T("Département"), esc(A.nomT(a.dep))));
    if (a.arr) h.push(ligne(T("Arrondissement"), esc(A.nomT(a.arr))));
    if (sup && sup.valeur !== null) {
      h.push(ligne(T("Superficie"), fmt(sup.valeur, sup.unite) +
        ' <small>' + TF("millésime {a} · {src}",
          { a: esc(sup.annee || "—"), src: esc(sup.source || "—") }) + "</small>"));
    }
    h.push(ligne(T("Code officiel (p-code OCHA)"), esc(r.pcode || "—")));
    h.push(ligne(T("Identifiant Atmart"), esc(r.atmart_geo_id)));
    h.push(ligne(T("Découpage retenu"),
      esc(r.source || "—") + (r.date_validite_debut
        ? ' <small>' + TF("en vigueur depuis le {date}", { date: jour(r.date_validite_debut) }) + "</small>"
        : "")));
    h.push(ligne(T("Rapport édité le"), esc(aujourdhui())));
    h.push(ligne(T("Fiche en ligne"), '<span class="r-url">' + esc(url) + "</span>"));
    h.push("</table>");
    /* L'avertissement de tête est la première chose lue, et c'est voulu :
       un document imprimé circule séparé de son site. S'il ne dit pas
       lui-même ce qu'il est, quelqu'un le lira comme un recensement. */
    h.push('<p class="r-garde">' + T(
      "Ce document est une extraction datée de l'Explorateur Haïti. Chaque " +
      "chiffre y porte sa source et son millésime ; la page « Sources et " +
      "limites » en fin de rapport les récapitule toutes. Une absence de " +
      "donnée n'est jamais un zéro, et aucune valeur n'a été estimée, " +
      "corrigée ou complétée par Atmart pour combler un trou.") + "</p>");
    h.push("</header>");
    return h.join("");
  }

  /* --------------------------------------------- 1. ce qu'on sait */

  /* Population officielle ET modélisée côte à côte, avec leur écart : ce
     n'est pas une redondance, c'est le sujet. Les deux méthodes ne
     s'accordent pas partout, et le rapport publie le désaccord au lieu de
     choisir un chiffre en silence. */
  function ceQuOnSait(r) {
    var pop = A.valeurBrute(r, "IND-POP-001");
    var dens = A.valeurBrute(r, "IND-POP-002");
    var pm = S.popMod && S.popMod.communes ? S.popMod.communes[r.pcode] : null;
    var mpm = (S.popMod && S.popMod.meta) || {};
    var h = ['<section class="r-sec">'];
    h.push(titreSection(1, T("Ce qu'on sait")));
    h.push('<table class="r-tab"><thead><tr>' +
      "<th scope=\"col\">" + T("Grandeur") + "</th>" +
      "<th scope=\"col\">" + T("Valeur") + "</th>" +
      "<th scope=\"col\">" + T("Millésime") + "</th>" +
      "<th scope=\"col\">" + T("Source") + "</th></tr></thead><tbody>");
    var l = function (nom, val, an, src) {
      h.push("<tr><th scope=\"row\">" + esc(nom) + "</th><td class=\"r-num\">" + val +
        "</td><td>" + esc(an || "—") + "</td><td>" + esc(src || "—") + "</td></tr>");
    };
    if (pop && pop.valeur !== null) {
      l(T("Population officielle"), fmt(pop.valeur, pop.unite), pop.annee, pop.source);
    } else {
      l(T("Population officielle"), '<span class="r-nd">' + T("non documenté") + "</span>", "", "");
    }
    if (pm && pm.m) {
      /* Les couches JSON stockent leurs nombres en CHAÎNES ("251114") : la
         fiche les affiche telles quelles, ce qui passe inaperçu au milieu
         d'un paragraphe. Dans une colonne de chiffres, à côté de valeurs
         mises en forme par fmt(), un nombre sans séparateur de milliers
         saute aux yeux — et un rapport imprimé n'a pas droit à ce genre de
         négligence. On repasse donc par le même formateur que le reste. */
      l(T("Population modélisée (satellite)"), fmt(nb(pm.m), "habitants"),
        "2020", mpm.source || "");
      /* Le signe est porté à la main (fmt ne le met pas) mais la virgule
         décimale vient de fmt : « +7.5 % » à côté de « 613,7 » trahirait
         que les deux chiffres n'ont pas été écrits par la même main. */
      var ec = nb(pm.e);
      l(T("Écart entre les deux méthodes"),
        "<b>" + (ec > 0 ? "+" : "") + fmt(ec, "%") + "</b>", "",
        T("Calcul Atmart sur les deux sources"));
    }
    if (dens && dens.valeur !== null) {
      l(T("Densité de population"), fmt(dens.valeur, dens.unite), dens.annee, dens.source);
    } else if (pm && pm.d) {
      l(T("Densité (population modélisée)"), fmt(nb(pm.d), "habitants / km²"),
        "2020", mpm.source || "");
    }
    h.push("</tbody></table>");
    if (pm && pm.m && Math.abs(nb(pm.e)) >= 25) {
      h.push('<p class="r-limite">' + T(
        "Les deux méthodes divergent nettement ici. Ni l'une ni l'autre n'est " +
        "corrigée : l'écart est publié tel quel, pour que la décision se " +
        "prenne en le sachant.") + "</p>");
    }
    if (mpm.avertissement) {
      h.push('<p class="r-src">' + esc(mpm.avertissement) + "</p>");
    }
    h.push("</section>");
    return h.join("");
  }

  /* --------------------------------------------- sections de couches */

  function titreSection(n, texte) {
    return '<h2 class="r-h2"><span class="r-chiffre">' + n + "</span>" + esc(texte) + "</h2>";
  }

  /* Une couche muette ne laisse pas un titre orphelin au milieu du papier :
     on ne pose le bloc que s'il a produit quelque chose. Et une couche
     absente est DITE en fin de section, pas passée sous silence — sinon le
     lecteur croit que le rapport n'a rien à dire là où c'est la donnée qui
     manque. */
  /* `r-sec-couches` déclenche les DEUX COLONNES à l'impression. Ces blocs
     sont courts, denses et indépendants les uns des autres : sur 180 mm de
     large, une ligne de texte à pleine largeur fait 110 caractères, ce que
     l'œil ne suit plus. En deux colonnes elle en fait 45, et le rapport
     passe de sept pages à cinq — la même donnée, mieux posée. Les tableaux
     de la section 1 et de la page des sources, eux, restent pleine largeur :
     une colonne de chiffres coupée en deux ne se compare plus. */
  /* `rendues` est rempli au passage : la page des sources ne doit créditer
     QUE ce que le document contient. Une source listée pour une donnée
     absente du rapport est une fausse piste — le lecteur cherche le chiffre
     et ne le trouve pas. */
  function sectionCouches(n, titre, cles, r, rendues) {
    var h = ['<section class="r-sec r-sec-couches">', titreSection(n, titre)], vides = [];
    cles.forEach(function (cle) {
      var c = couche(cle);
      var f = c && A[c.html];
      var corps = "";
      try { corps = f ? f(r) : ""; } catch (e) { corps = ""; }
      if (corps) { h.push('<div class="r-bloc">' + corps + "</div>"); rendues.push(cle); }
      else vides.push(T(c ? c.titre : cle));
    });
    if (vides.length) {
      h.push('<p class="r-absent">' + TF(
        "Non documenté sur cette commune dans cette édition : {liste}. " +
        "Une absence ici signale une donnée qui manque, pas un territoire " +
        "où il n'y a rien.", { liste: esc(vides.join(", ")) }) + "</p>");
    }
    h.push("</section>");
    return h.join("");
  }

  /* --------------------------------------------- 5. sources et limites */

  /* LA PAGE QUI DISTINGUE CE RAPPORT D'UN DÉPLIANT.
     Elle n'est pas écrite à la main : elle est LUE dans les métadonnées des
     fichiers eux-mêmes. Une couche qui change de licence ou de millésime
     change ici sans que personne n'y pense — c'est la seule façon qu'un
     document imprimé ne mente pas six mois plus tard. */
  function sourcesEtLimites(r, utilisees) {
    var h = ['<section class="r-sec r-sec-sources">'];
    h.push(titreSection(5, T("Sources et limites")));
    h.push('<p class="r-intro">' + T(
      "Aucune des valeurs de ce rapport n'appartient à Atmart. Elles viennent " +
      "des producteurs listés ci-dessous, sous les licences indiquées, et " +
      "chacune garde ici le millésime de sa source — pas la date du jour.") +
      "</p>");

    /* ---- le socle d'indicateurs : ses sources sont dans les valeurs */
    var vals = S.vals.filter(function (v) {
      return v.pcode_commune === r.pcode && v.statut_valeur !== "N"; });
    var srcInd = {}, anInd = {};
    vals.forEach(function (v) {
      if (!v.source) return;
      srcInd[v.source] = (srcInd[v.source] || 0) + 1;
      if (v.annee_reference) {
        anInd[v.source] = anInd[v.source] || [];
        if (anInd[v.source].indexOf(v.annee_reference) < 0) anInd[v.source].push(v.annee_reference);
      }
    });

    /* Le tableau porte le NOM COURT de la source, pas le crédit légal
       complet : les attributions exigées par CC BY font jusqu'à deux cents
       caractères, et les loger dans une cellule gonflait cette seule table
       à 233 mm — presque une page pour douze lignes. Elles sont donc
       reprises intégralement juste dessous, en petits caractères, là où
       c'est leur place. Rien n'est perdu ; la table redevient lisible. */
    h.push('<h3 class="r-h3">' + T("Les jeux de données mobilisés") + "</h3>");
    h.push('<div class="r-tabwrap"><table class="r-tab r-sources"><thead><tr>' +
      "<th scope=\"col\">" + T("Jeu") + "</th>" +
      "<th scope=\"col\">" + T("Source") + "</th>" +
      "<th scope=\"col\">" + T("Millésime") + "</th>" +
      "<th scope=\"col\">" + T("Licence") + "</th>" +
      "<th scope=\"col\">" + T("Passeport") + "</th></tr></thead><tbody>");

    var limites = [], credits = [];
    utilisees.forEach(function (c) {
      var jeu = S[c.cle];
      var m = (jeu && jeu.meta) || null;
      if (!m) return;
      h.push("<tr><th scope=\"row\">" + esc(T(c.titre)) + "</th><td>" +
        esc(m.source || "—") + "</td><td>" +
        esc(millesime(m) || "—") + "</td><td>" +
        esc(m.licence || "—") + "</td><td>" +
        esc(m.passeport || m.passeport_id || "—") + "</td></tr>");
      if (m.avertissement) limites.push([T(c.titre), m.avertissement]);
      if (m.attribution || m.citation) {
        credits.push([T(c.titre),
          [m.attribution, m.citation].filter(Boolean).join(" · ")]);
      }
    });
    h.push("</tbody></table></div>");

    /* Le socle d'indicateurs n'a pas de licence par ligne dans le fichier :
       la prétendre dans une colonne serait inventer une métadonnée. Il a
       donc son propre encadré, qui dit ce que la donnée dit — la source et
       les millésimes — et rien de plus. */
    var clesInd = Object.keys(srcInd).sort();
    if (clesInd.length) {
      h.push('<h3 class="r-h3">' + T("Socle d'indicateurs communaux") + "</h3>");
      h.push('<table class="r-tab r-sources"><thead><tr>' +
        "<th scope=\"col\">" + T("Source") + "</th>" +
        "<th scope=\"col\">" + T("Millésimes") + "</th>" +
        "<th scope=\"col\">" + T("Valeurs") + "</th></tr></thead><tbody>");
      clesInd.forEach(function (s) {
        h.push("<tr><th scope=\"row\">" + esc(s) + "</th><td>" +
          esc((anInd[s] || []).sort().join(", ") || "—") +
          "</td><td class=\"r-num\">" + srcInd[s] + "</td></tr>");
      });
      h.push("</tbody></table>");
    }

    if (credits.length) {
      h.push('<h3 class="r-h3">' + T("Attributions exigées par les licences") + "</h3>");
      h.push('<ul class="r-credits">');
      credits.forEach(function (p) {
        h.push("<li><b>" + esc(p[0]) + "</b> — " + esc(p[1]) + "</li>");
      });
      h.push("</ul>");
    }

    /* ---- ce que ces chiffres ne disent pas */
    h.push('<h3 class="r-h3">' + T("Ce que ces chiffres ne disent pas") + "</h3>");
    /* Les avertissements calculés sur CETTE commune (millésimes mêlés,
       couverture partielle, aucune valeur observée) passent avant ceux des
       producteurs : ils portent sur le document que le lecteur a en main. */
    var calc = [];
    try { calc = A.avertissements(r) || []; } catch (e) { calc = []; }
    if (calc.length) {
      h.push('<ul class="r-limites r-limites-ici">');
      calc.forEach(function (t) { h.push("<li>" + esc(t) + "</li>"); });
      h.push("</ul>");
    }
    if (limites.length) {
      h.push('<dl class="r-limites">');
      limites.forEach(function (p) {
        h.push("<dt>" + esc(p[0]) + "</dt><dd>" + esc(p[1]) + "</dd>");
      });
      h.push("</dl>");
    }

    /* ---- la clause de lecture */
    h.push('<h3 class="r-h3">' + T("Comment lire ce rapport") + "</h3>");
    h.push('<ul class="r-lecture">');
    [
      "Une case vide n'est pas un zéro. Elle dit qu'aucune source documentée " +
        "ne porte cette valeur pour cette commune.",
      "Les millésimes ne sont pas alignés : ce rapport n'est pas un " +
        "instantané, il assemble des sources produites à des dates " +
        "différentes, et chacune porte la sienne.",
      "Aucune valeur n'est interpolée, lissée ni redressée. Ce qui est " +
        "affiché est ce que la source publie.",
      "Les couches satellitaires décrivent des surfaces vues du ciel, pas " +
        "des usages : un bâtiment détecté n'est ni un logement habité ni un " +
        "commerce, et un pixel « cultures » ne dit ni ce qui pousse ni si la " +
        "parcelle a produit.",
      "La commune est le niveau le plus fin de l'édition publique. Les " +
        "sections communales et les localités existent au référentiel mais " +
        "ne sont pas publiées ici."
    ].forEach(function (t) { h.push("<li>" + T(t) + "</li>"); });
    h.push("</ul>");

    h.push('<p class="r-citer"><b>' + T("Citer ce rapport") + "</b><br>" +
      TF("Atmart Data, Explorateur Haïti — {nom}, rapport de territoire édité " +
         "le {date}. {url}",
        { nom: esc(A.nomT(r)), date: esc(aujourdhui()),
          url: '<span class="r-url">' + esc(adresseFiche(r)) + "</span>" }) +
      "</p>");
    h.push('<p class="r-src">' + TF(
      "La version en ligne fait foi et peut avoir changé depuis l'édition de " +
      "ce document. Méthodes, définitions et statuts de qualité : {lien}",
      { lien: '<span class="r-url">' + esc(SITE + "donnees-backbone.html") + "</span>" }) +
      "</p>");
    h.push("</section>");
    return h.join("");
  }

  /* --------------------------------------------------------- assemblage */

  function conteneur() {
    var el = $("#x-rapport");
    if (el) return el;
    el = document.createElement("div");
    el.id = "x-rapport";
    /* `hidden` et non une classe : hors impression, ce document ne doit
       exister ni à l'écran ni dans l'arbre d'accessibilité. Un lecteur
       d'écran qui trouverait deux fois les mêmes chiffres, une fois en
       fiche et une fois en rapport, ne saurait pas lequel il lit. */
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  }

  /* Ce que le rapport laisse à l'écran, nommé. Un document qui s'arrête
     sans dire où il s'arrête laisse croire qu'il a tout dit. */
  function renvoiFiche(r) {
    var restes = HORS_RAPPORT.filter(function (cle) {
      var jeu = S[cle];
      return jeu && jeu.communes && jeu.communes[r.pcode];
    }).map(function (cle) { return T(couche(cle).titre); });
    if (!restes.length) return "";
    return '<p class="r-renvoi">' + TF(
      "L'Explorateur documente aussi {liste} pour cette commune. Ces couches " +
      "ne sont pas reprises ici : elles se consultent sur la fiche en ligne, " +
      "à l'adresse donnée en tête de ce rapport.",
      { liste: esc(restes.join(", ")) }) + "</p>";
  }

  function construire(r) {
    /* Seules les couches RÉELLEMENT imprimées ; voir sectionCouches. */
    var rendues = [];
    var s2 = sectionCouches(2, T("Le territoire"), TERRITOIRE, r, rendues);
    var s3 = sectionCouches(3, T("Les risques"), RISQUES, r, rendues);
    var s4 = sectionCouches(4, T("Les équipements"), EQUIPEMENTS, r, rendues);
    /* La population modélisée est imprimée en section 1, hors sectionCouches :
       sa source doit tout de même figurer au tableau. */
    if (S.popMod && S.popMod.communes && S.popMod.communes[r.pcode]) rendues.push("popMod");
    var utilisees = COUCHES.filter(function (c) { return rendues.indexOf(c.cle) > -1; });
    var h = [entete(r), ceQuOnSait(r), s2, s3, s4,
             sourcesEtLimites(r, utilisees), renvoiFiche(r)];
    /* Le pied revient sur chaque page imprimée (position fixe) : une feuille
       détachée d'un rapport agrafé doit encore dire de quelle commune elle
       parle et d'où elle vient. */
    h.push('<div class="r-pied"><span>' + esc(A.nomT(r)) +
      " · " + T("Explorateur Haïti — Atmart Data") + "</span><span>" +
      esc(adresseFiche(r)) + "</span></div>");
    return h.join("");
  }

  /* Le nettoyage passe par `afterprint` ET par un délai de sûreté : sur
     certains navigateurs mobiles, « Enregistrer en PDF » quitte la page
     sans jamais émettre l'événement, et la classe resterait collée au
     document — invisible, mais elle casserait l'impression suivante. */
  function nettoyer() {
    document.body.classList.remove("atm-rapport");
  }

  function rapport(r) {
    r = r || S.courant;
    if (!r || r.niveau_admin !== "3") return Promise.resolve(false);
    var chargements = COUCHES.map(function (c) {
      var f = A[c.charger];
      /* Une couche qui ne se charge pas ne fait pas échouer le rapport :
         elle apparaîtra en « non documenté » dans sa section. Un rapport
         partiel qui le dit vaut mieux qu'un bouton qui ne répond pas. */
      return f ? f().catch(function () { return null; }) : Promise.resolve(null);
    });
    return Promise.all(chargements).then(function () {
      conteneur().innerHTML = construire(r);
      document.body.classList.add("atm-rapport");
      window.addEventListener("afterprint", nettoyer, { once: true });
      setTimeout(nettoyer, 60000);
      window.print();
      return true;
    });
  }

  Object.assign(A, { rapport, adresseFiche });
}
