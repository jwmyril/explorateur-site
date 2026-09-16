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

  /* Les tableaux qui défilent (AC-10, 14/09/2026). Un conteneur à
     overflow-x ne se défile pas au clavier s'il ne peut pas recevoir le
     focus — c'est le cas des WebView Android anciennes et de Firefox, le parc
     visé. Seuls les conteneurs qui DÉBORDENT deviennent focalisables : un
     arrêt de tabulation sur un tableau qui tient dans l'écran ne sert à rien.
     Le nom vient du tableau lui-même (légende, sinon titre qui le précède),
     déjà traduit par la page. Un <summary> de <details> vaut titre. Les tableaux du moteur arrivent après le
     chargement : on réexamine à chaque ajout et à chaque redimensionnement. */
  var CONTENEURS = ".x-tabwrap, .r-tabwrap, .d-tab-wrap, .d-preview, .x-tableau";
  var nomDe = function (c) {
    var cap = c.querySelector("caption");
    if (cap && cap.textContent.trim()) return cap.textContent.trim();
    var n = c;
    while (n) {
      var p = n.previousElementSibling;
      while (p) {
        if (/^(H[2-5]|SUMMARY)$/.test(p.tagName)) return p.textContent.trim();
        var h = p.querySelector && p.querySelector("h2, h3, h4, h5");
        if (h && !p.contains(c)) return h.textContent.trim();
        p = p.previousElementSibling;
      }
      n = n.parentElement;
      if (!n || n === document.body) break;
    }
    return "";
  };
  var examiner = function () {
    document.querySelectorAll(CONTENEURS).forEach(function (c) {
      var deborde = c.scrollWidth > c.clientWidth + 1;
      if (deborde) {
        if (!c.hasAttribute("tabindex")) { c.setAttribute("tabindex", "0"); c.dataset.uxFocus = "1"; }
        if (!c.hasAttribute("role")) c.setAttribute("role", "region");
        if (!c.hasAttribute("aria-label") && !c.hasAttribute("aria-labelledby")) {
          var nom = nomDe(c);
          if (nom) c.setAttribute("aria-label", nom);
        }
      } else if (c.dataset.uxFocus === "1") {
        c.removeAttribute("tabindex"); delete c.dataset.uxFocus;
      }
    });
  };
  var attente = null;
  var plus_tard = function () { clearTimeout(attente); attente = setTimeout(examiner, 150); };
  plus_tard();
  window.addEventListener("resize", plus_tard);
  if (window.MutationObserver) {
    new MutationObserver(plus_tard).observe(document.body, { childList: true, subtree: true });
  }
})();
