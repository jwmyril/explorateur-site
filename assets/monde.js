/* Haïti dans le monde — vignette de l'en-tête, et tableau complet dessous.
   ========================================================================
   UNE SEULE REQUÊTE NOURRIT LES DEUX. Le fichier fait 20 Ko en clair mais
   3,7 Ko sur le réseau — Cloudflare le compresse, et c'est ce chiffre-là qui
   compte pour un lecteur au mégaoctet. Mesuré avant d'être supposé : c'est
   ce qui permet de le charger d'emblée sans retomber dans le défaut PF-3
   (224 Ko téléchargés en silence).

   LES CHIFFRES NE SONT PAS APPELÉS EN DIRECT DEPUIS LE NAVIGATEUR, et c'est
   un choix. Une API tierce demanderait d'ouvrir la CSP, casserait le hors
   connexion, et afficherait des valeurs sans date d'extraction ni empreinte
   de capture. Le fichier lu ici a été scellé par l'atelier, daté, et porte
   sa méthode : « vivant » veut dire qu'il se rafraîchit sans que personne le
   retape, pas qu'il clignote.

   CE QUI CLIGNOTE, EN REVANCHE, C'EST L'AFFICHAGE — et il faut le faire avec
   précaution. Un contenu qui change tout seul est un piège d'accessibilité
   classique : il vole la lecture de quelqu'un qui lit lentement, il perd un
   lecteur d'écran, et il rend fou qui a un trouble de l'attention. Trois
   garde-fous, donc :
     · `aria-live="polite"` annonce le changement sans interrompre ;
     · la rotation s'arrête au survol ET au focus clavier ;
     · `prefers-reduced-motion` la désactive entièrement — la vignette reste
       alors sur le premier indicateur, et les flèches marchent toujours.
   Les deux flèches ne sont pas décoratives : sans elles, l'information
   n'existerait que pour qui peut attendre cinq secondes. */
(function () {
  "use strict";
  var vign = document.getElementById("mo-vignette");
  var boite = document.getElementById("mo-boite");
  if (!vign && !boite) return;
  var corps = document.getElementById("mo-corps");
  var scene = vign && vign.querySelector(".mo-scene");
  var doc = null, i = 0, minuteur = null, arrete = false;

  /* LA RACINE, VUE DEPUIS CETTE PAGE. `/ht/index.html` demanderait sinon
     `/ht/data/…`, qui n'existe pas — c'est le défaut PF-1. */
  var RACINE = /^\/(ht|en|es)\//.test(location.pathname) ? "../" : "";
  var DV = "?d=2026-09-04a";
  var FICHIER = RACINE + "data/atmart_comparaison_monde.json" + DV;
  var PAUSE = 6000;
  var LENT = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function T(fr) {
    return (window.ATM_I18N && window.ATM_I18N.texte)
      ? window.ATM_I18N.texte(fr) : fr;
  }

  function lang() { return document.documentElement.lang || "fr"; }

  /* « 9 605 » en français, kreyòl et espagnol ; « 9,605 » en anglais. */
  function nb(v) {
    if (v === null || v === undefined || v === "") return "—";
    return Number(v).toLocaleString(lang() === "en" ? "en-US" : "fr-FR",
      { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
  }

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function txt(o) { return (o && (o[lang()] || o.fr)) || ""; }

  function voisinRD(x) {
    var d = null;
    (x.voisins || []).forEach(function (v) { if (v.iso === "DOM") d = v; });
    return d;
  }

  /* ───────────────────────── la seule donnée vraiment vivante ───────────── */
  /* LA TEMPÉRATURE EST LE SEUL CHIFFRE DE CE SITE QUI CHANGE D'HEURE EN
     HEURE. Tout le reste est scellé, daté et rejouable ; celui-ci ne peut
     pas l'être, et c'est pour ça qu'il est traité à part.

     Il passe par le Worker d'Atmart, pas par un service tiers appelé depuis
     la page. Ce n'est pas la CSP qui l'impose — `connect-src` ne laisse pas
     exécuter de code — c'est `conditions.html`, qui nomme quatre
     sous-traitants et promet au lecteur que sa visite ne dit rien de lui.
     Un cinquième destinataire de son adresse IP ferait mentir cette page.

     SI LA ROUTE N'EST PAS DÉPLOYÉE, LA CARTE N'APPARAÎT PAS. Pas de tiret,
     pas de « — » qu'on prendrait pour une mesure : elle n'existe simplement
     pas dans la rotation. */
  var METEO = "https://atmart-chat.atmartllc.workers.dev/meteo";
  var meteo = null;

  function carteMeteo() {
    if (!meteo || !meteo.points) return null;
    var ht = meteo.points.HTI, rd = meteo.points.DOM;
    if (!ht || ht.t === null || ht.t === undefined) return null;
    var h = [];
    h.push('<p class="mo-quoi">' + esc(T("Température à Port-au-Prince")) +
           "</p>");
    h.push('<p class="mo-chiffre">' + nb(ht.t) +
           '<span class="mo-unite">°C</span></p>');
    if (ht.h !== null && ht.h !== undefined) {
      h.push('<p class="mo-rang">' + esc(T("Humidité")) + " · " +
             nb(ht.h) + " %</p>");
    }
    if (rd && rd.t !== null && rd.t !== undefined) {
      h.push('<p class="mo-rd">' + esc(rd.nom) + " · " + nb(rd.t) +
             " °C</p>");
    }
    h.push('<p class="mo-an">' + esc(T("en direct")) + "</p>");
    return h.join("");
  }

  /* Le nombre de cartes : les indicateurs, plus la météo si elle répond. */
  function combien() {
    return (doc ? doc.indicateurs.length : 0) + (carteMeteo() ? 1 : 0);
  }

  /* ───────────────────────────────── la vignette ───────────────────────── */
  function peindre() {
    if (!scene || !doc) return;
    var m = carteMeteo();
    if (m && i === 0) {
      scene.innerHTML = m;
      var pts0 = vign.querySelector(".mo-points");
      if (pts0) {
        pts0.innerHTML = Array.apply(null, { length: combien() })
          .map(function (_, k) {
            return '<i' + (k === 0 ? ' class="on"' : "") + "></i>";
          }).join("");
      }
      return;
    }
    var x = doc.indicateurs[i - (m ? 1 : 0)], rd = voisinRD(x), h = [];
    h.push('<p class="mo-quoi">' + esc(txt(x.libelle)) + "</p>");
    h.push('<p class="mo-chiffre">' + nb(x.haiti.v) +
           '<span class="mo-unite">' + esc(txt(x.unite)) + "</span></p>");
    if (x.monde && x.monde.rang) {
      h.push('<p class="mo-rang">' + esc(T("Rang mondial")) + " · " +
             esc(T("{r} sur {n}").replace("{r}", nb(x.monde.rang))
                                 .replace("{n}", nb(x.monde.pays))) + "</p>");
    }
    if (rd) {
      h.push('<p class="mo-rd">' + esc(T("République dominicaine")) + " · " +
             nb(rd.v) + "</p>");
    }
    h.push('<p class="mo-an">' + esc(T("données de")) + " " + x.haiti.an +
           "</p>");
    scene.innerHTML = h.join("");
    var pts = vign.querySelector(".mo-points");
    if (pts) {
      pts.innerHTML = Array.apply(null, { length: combien() })
        .map(function (_, k) {
          return '<i' + (k === i ? ' class="on"' : "") + "></i>";
        }).join("");
    }
  }

  function aller(pas) {
    if (!doc) return;
    var n = combien();
    i = (i + pas + n) % n;
    peindre();
  }

  function relancer() {
    clearInterval(minuteur);
    /* On ne fait pas tourner ce que le lecteur n'a pas demandé à voir
       tourner : mouvement réduit, ou survol, ou focus dans la vignette. */
    if (LENT || arrete) return;
    minuteur = setInterval(function () { aller(1); }, PAUSE);
  }

  /* ───────────────────────────── le tableau complet ────────────────────── */
  function tableau() {
    if (!corps || !doc) return;
    var m = doc.meta || {}, h = [];
    var titre = T("Haïti comparée au monde et aux Caraïbes");
    h.push('<div class="x-tableau" tabindex="0" role="region" aria-label="' +
           esc(titre) + '">');
    h.push("<table><caption>" + esc(titre) + "</caption><thead><tr>");
    /* LA MÉDIANE MONDIALE A ÉTÉ RETIRÉE le 04/09/2026 : quatre colonnes de
       chiffres pour un lecteur, c'était une de trop, et celle-là servait le
       moins — la médiane ne nomme personne, alors que le rang situe et que
       le voisin explique. Elle reste dans le fichier téléchargeable, où
       elle ne coûte rien à personne. */
    ["Indicateur", "Haïti", "Rang mondial", "République dominicaine"]
      .forEach(function (t, k) {
        h.push('<th scope="col"' + (k ? ' class="r"' : "") + ">" +
               esc(T(t)) + "</th>");
      });
    h.push("</tr></thead><tbody>");
    doc.indicateurs.forEach(function (x) {
      var rd = voisinRD(x);
      h.push("<tr>");
      h.push('<th scope="row">' + esc(txt(x.libelle)) +
             '<small class="mo-u"> · ' + esc(txt(x.unite)) + "</small></th>");
      h.push('<td class="num"><b>' + nb(x.haiti.v) + "</b>" +
             '<small class="mo-u"> ' + x.haiti.an + "</small></td>");
      /* UN RANG SANS SON EFFECTIF NE VEUT RIEN DIRE : un pays qui ne déclare
         rien n'est pas dernier, il est absent. Le nombre de pays comparés
         change d'un indicateur à l'autre, il est donc écrit à chaque fois. */
      h.push('<td class="num">' + (x.monde && x.monde.rang
             ? esc(T("{r} sur {n}").replace("{r}", nb(x.monde.rang))
                                    .replace("{n}", nb(x.monde.pays)))
             : "—") + "</td>");
      h.push('<td class="num">' + (rd ? nb(rd.v) +
             '<small class="mo-u"> ' + rd.an + "</small>" : "—") + "</td>");
      h.push("</tr>");
    });
    h.push("</tbody></table></div>");
    h.push('<p class="x-note">' + esc(T("Source")) + " : " +
           esc(m.source || "") + " — " + esc(T("relevé le")) + " " +
           esc(m.date_extraction || "") + ", " +
           esc(T("valeur la plus récente de chaque pays sur")) + " " +
           esc(m.fenetre || "") + ".</p>");
    h.push('<p class="x-note">' + esc(T("Un rang mondial dépend de qui "
           + "déclare : un pays qui ne publie rien n'est pas dernier, il est "
           + "absent du classement. Les quinze voisins des Caraïbes et la "
           + "médiane mondiale sont dans le fichier.")) +
           ' <a href="' + RACINE + 'data/atmart_comparaison_monde.json"' +
           " download>" + esc(T("Télécharger le fichier (JSON)")) +
           "</a></p>");
    corps.innerHTML = h.join("");
  }

  /* ──────────────────────────────── câblage ────────────────────────────── */
  function echec() {
    var mot = T("La comparaison n'a pas pu être chargée.");
    if (scene) scene.innerHTML = '<p class="mo-quoi">' + esc(mot) + "</p>";
    if (corps) corps.innerHTML = '<p class="x-note">' + esc(mot) + "</p>";
  }

  /* La météo se demande à part et n'empêche rien : si elle ne répond pas —
     route non déployée, réseau coupé, source en panne — la vignette montre
     les douze indicateurs et personne ne voit de trou. On la rafraîchit
     toutes les dix minutes, le Worker gardant sa réponse un quart d'heure. */
  function chercherMeteo() {
    fetch(METEO)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.points) return;
        var neuf = !meteo;
        meteo = j;
        if (neuf && i > 0) i += 1;   // la météo s'insère devant : on suit
        peindre();
      })
      .catch(function () { /* elle n'existe pas encore, et c'est prévu */ });
  }
  chercherMeteo();
  setInterval(chercherMeteo, 600000);

  fetch(FICHIER)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (j) {
      if (!j.indicateurs || !j.indicateurs.length) throw new Error("vide");
      doc = j;
      peindre();
      relancer();
      if (boite && boite.open) tableau();
      if (vign) vign.hidden = false;
    })
    .catch(echec);

  if (vign) {
    vign.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-pas]");
      if (!b) return;
      aller(parseInt(b.getAttribute("data-pas"), 10));
      relancer();
    });
    ["mouseenter", "focusin"].forEach(function (ev) {
      vign.addEventListener(ev, function () { arrete = true; relancer(); });
    });
    ["mouseleave", "focusout"].forEach(function (ev) {
      vign.addEventListener(ev, function () { arrete = false; relancer(); });
    });
  }
  if (boite) {
    boite.addEventListener("toggle", function () {
      if (boite.open) tableau();
    });
  }
  /* Changer de langue redessine les deux, sans retélécharger. */
  document.addEventListener("atmart:lang", function () {
    if (!doc) return;
    peindre();
    if (boite && boite.open) tableau();
  });
})();
