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
    bouton.setAttribute("aria-label", "Menu principal");
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
  /* Les sous-menus au clavier : ouvrir un groupe au focus d'un de ses liens. */
  document.querySelectorAll(".nav-grp").forEach(function (g) {
    g.addEventListener("focusin", function () { g.classList.add("nav-ouvert"); });
    g.addEventListener("focusout", function () {
      setTimeout(function () {
        if (!g.contains(document.activeElement)) g.classList.remove("nav-ouvert");
      }, 0);
    });
  });
})();
