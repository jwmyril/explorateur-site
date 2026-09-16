/* Accessibilité du menu et finitions clavier — externe (la CSP du site
   n'autorise aucun nouveau script en ligne). Complète le petit script de
   bascule existant sans le remplacer : ici vivent les états ARIA, la
   fermeture à Échap et le retour du focus. Supprimable sans rien casser. */
(function () {
  "use strict";
  var bouton = document.querySelector(".nav-toggle");
  var liste = document.querySelector(".nav-links");
  if (bouton && liste) {
    if (!liste.id) liste.id = "nav-liste";
    bouton.setAttribute("aria-expanded", "false");
    bouton.setAttribute("aria-controls", liste.id);
    /* EN DUR, ce libellé restait français sur les pages ht/en/es :
       ux.js est `defer`, donc il passe APRÈS i18n.js et l'écrase.
       On pose le repère et on redemande la traduction de ce seul
       bouton — `traduire()` existe pour les fragments tardifs. */
    bouton.setAttribute("aria-label", "Menu principal");
    bouton.setAttribute("data-i18n-aria", "nv.menu");
    try { window.ATM_I18N && window.ATM_I18N.traduire
          && window.ATM_I18N.traduire(bouton.parentNode || bouton); }
    catch (e) { /* le français reste, c'est le repli correct */ }
    var maj = function () {
      bouton.setAttribute("aria-expanded",
        liste.classList.contains("open") ? "true" : "false");
    };
    bouton.addEventListener("click", function () { setTimeout(maj, 0); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && liste.classList.contains("open")) {
        liste.classList.remove("open");
        maj();
        bouton.focus();
      }
    });
  }
  /* Les sous-menus au clavier (AC-4, 14/09/2026). L'ancienne version ouvrait
     le groupe au focus d'un de ses liens — or ces liens étaient dans un
     display:none, donc jamais focalisables : le déclencheur ne se produisait
     jamais sur grand écran. Le déclencheur est désormais un <button> ; il
     ouvre et ferme, dit son état, et Échap referme en rendant le focus. */
  document.querySelectorAll(".nav-grp").forEach(function (g) {
    var btn = g.querySelector(".nav-grp-btn");
    var sous = g.querySelector(".nav-sub");
    var etat = function (ouvert) {
      g.classList.toggle("nav-ouvert", ouvert);
      if (btn) btn.setAttribute("aria-expanded", ouvert ? "true" : "false");
    };
    if (btn && sous) {
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        etat(!g.classList.contains("nav-ouvert"));
      });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && g.classList.contains("nav-ouvert")) {
          etat(false);
          btn.focus();
          e.stopPropagation();
        }
      });
    }
    g.addEventListener("focusout", function () {
      setTimeout(function () {
        if (!g.contains(document.activeElement)) etat(false);
      }, 0);
    });
  });
})();
