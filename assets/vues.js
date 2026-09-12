/* Lecture par vues — une longue page devient quatre courtes. 19/08/2026.

   POURQUOI CE FICHIER EXISTE. « Solutions & licences » fait onze sections et
   trente mille caractères. Tout y est utile, et c'est le problème : un lecteur
   qui cherche les licences fait défiler sept sections qui ne le concernent pas,
   et un lecteur venu comprendre l'offre se perd dans les licences.

   CE QUI N'EST PAS FAIT, ET POURQUOI :

   · On ne SUPPRIME rien. La page longue reste accessible d'un clic sur
     « Tout afficher », et quiconque connaissait la page la retrouve entière.
   · On ne masque PAS avant que le script ait tourné. Les sections sont
     visibles dans le HTML ; c'est le script qui replie. Si ce fichier ne se
     charge pas, le lecteur voit tout — c'est la bonne façon d'échouer. Un
     `hidden` posé dans le HTML aurait rendu la page vide sans JavaScript.
   · On ne touche pas à l'ADRESSE quand le lecteur choisit un onglet dans la
     page, sauf par le fragment : #licences reste partageable, et un lien reçu
     ouvre directement la bonne vue.

   L'IMPRESSION IGNORE LES VUES : une page imprimée doit être complète, sinon
   on imprime un tiers d'un contrat sans s'en apercevoir. Voir data.css. */
(function () {
  "use strict";
  var CLE = "atmart_vue_page";

  function T(fr) {
    return (window.ATM_I18N && window.ATM_I18N.texte)
      ? window.ATM_I18N.texte(fr) : fr;
  }

  var barre = document.querySelector("[data-vues]");
  if (!barre) return;
  var sections = [].slice.call(document.querySelectorAll("[data-vue]"));
  if (!sections.length) return;

  /* L'ordre des onglets suit celui des sections dans la page : un sommaire
     qui réordonne ce qu'il résume désoriente au lieu d'aider. */
  var vues = [];
  sections.forEach(function (s) {
    var v = s.getAttribute("data-vue");
    if (v && vues.indexOf(v) < 0) vues.push(v);
  });

  /* CE FICHIER PARLAIT TROP TÔT, ET PERSONNE NE POUVAIT LE VOIR.
     ===========================================================
     `i18n.js` charge son dictionnaire par le réseau. Ce script-ci, lui, est
     synchrone : il fabriquait ses boutons pendant que le dictionnaire était
     encore en route, `T()` rendait donc le français — et comme les boutons
     naissaient sans attribut de traduction, `apply()` ne les reprenait pas
     ensuite. Mesuré le 12/09/2026 sur `/ht/conditions.html` : cinq onglets
     français au milieu d'une page kreyòl, sur la page JURIDIQUE, alors que
     les six traductions existaient depuis toujours.
     Deux corrections, parce qu'il fallait les deux : le bouton porte
     maintenant sa clef, donc `apply()` le voit et le contrôle aussi ; et on
     repeint à l'événement de langue, pour le cas où le lecteur change de
     langue sans recharger. */
  var boutons = {};
  function poser(v, cle, tout) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "vue-btn" + (tout ? " vue-tout" : "");
    b.textContent = T(cle);
    b.setAttribute("data-i18n", cle);
    b.setAttribute("data-va", v);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { montrer(v, true); });
    barre.appendChild(b);
    boutons[v] = b;
  }

  vues.forEach(function (v) {
    var s = document.querySelector('[data-vue="' + v + '"]');
    poser(v, s.getAttribute("data-vue-nom") || v, false);
  });
  poser("*", "Tout afficher", true);

  /* La langue arrive, ou change : on relit le dictionnaire. `apply()` traite
     déjà `[data-i18n]`, mais un onglet dont la clef manquerait resterait
     français sans que ce fichier le sache — on repasse donc par `T()`, qui
     compte ce qui retombe. */
  document.addEventListener("atmart:lang", function () {
    Object.keys(boutons).forEach(function (k) {
      var cle = boutons[k].getAttribute("data-i18n");
      if (cle) boutons[k].textContent = T(cle);
    });
  });

  function montrer(v, retenir) {
    sections.forEach(function (s) {
      s.hidden = (v !== "*" && s.getAttribute("data-vue") !== v);
    });
    Object.keys(boutons).forEach(function (k) {
      var actif = k === v;
      boutons[k].classList.toggle("actif", actif);
      boutons[k].setAttribute("aria-pressed", actif ? "true" : "false");
    });
    if (retenir) {
      try { localStorage.setItem(CLE, v); } catch (e) {}
      /* On remonte en haut de la zone, pas de la page : le lecteur vient de
         cliquer sur la barre, la faire disparaître de son champ de vision
         serait le punir de son choix. */
      var y = barre.getBoundingClientRect().top + window.pageYOffset - 12;
      if (window.pageYOffset > y) window.scrollTo(0, y);
    }
  }

  /* Priorité : le fragment de l'adresse, puis le dernier choix, puis la
     première vue. Un lien partagé l'emporte toujours sur une préférence
     locale — celui qui envoie le lien sait ce qu'il veut montrer. */
  var depart = vues[0];
  var frag = (location.hash || "").replace("#", "");
  var cible = frag && document.getElementById(frag);
  if (cible) {
    var sec = cible.closest ? cible.closest("[data-vue]") : null;
    if (sec) depart = sec.getAttribute("data-vue");
  } else {
    try {
      var v = localStorage.getItem(CLE);
      if (v && (v === "*" || vues.indexOf(v) >= 0)) depart = v;
    } catch (e) {}
  }
  montrer(depart, false);

  /* Un lien interne vers une section masquée ne mènerait nulle part : on
     ouvre la vue qui la contient avant de laisser le navigateur sauter. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    var el = id && document.getElementById(id);
    if (!el) return;
    var sec = el.closest("[data-vue]");
    if (sec && sec.hidden) montrer(sec.getAttribute("data-vue"), true);
  });
})();
