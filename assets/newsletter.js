/* LETTRE D'INFORMATION — le formulaire qui manquait (17/09/2026).

   Le Worker `/subscribe` existait, `script.js` savait lui écrire, et aucune
   page ne portait de formulaire : on ne pouvait pas s'inscrire. Ce script
   sert les formulaires `.nl-form`, posés par le pied de page commun, les
   pages communales et les pages d'indicateur. Il ne touche pas aux
   `.newsletter-form` de `script.js` : deux gestionnaires sur un même
   formulaire enverraient deux inscriptions.

   Ce qui part : l'adresse, la langue de la page et son chemin — ce que la
   page Confidentialité déclare, et rien de plus. */
(function () {
  "use strict";
  var ADRESSE = "https://atmart-chat.atmartllc.workers.dev/subscribe";
  var MOTIF = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  Array.prototype.forEach.call(document.querySelectorAll(".nl-form"), function (form) {
    if (form.dataset.nlPret) return;          // le script peut être inclus deux fois
    form.dataset.nlPret = "1";
    var bloc = form.closest(".nl-bloc") || form.parentNode;
    var etat = bloc.querySelector(".nl-etat");
    function montrer(cls) {
      if (!etat) return;
      etat.hidden = false;
      Array.prototype.forEach.call(etat.querySelectorAll("span"), function (s) {
        s.hidden = !s.classList.contains(cls);
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var champ = form.querySelector("input[type=email]");
      var bouton = form.querySelector("button");
      var courriel = (champ.value || "").trim();
      if (!MOTIF.test(courriel)) { champ.setAttribute("aria-invalid", "true"); champ.focus(); return; }
      champ.removeAttribute("aria-invalid");
      bouton.disabled = true;
      fetch(ADRESSE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: courriel, lang: (document.documentElement.lang || "fr").slice(0, 2),
                               source: location.pathname })
      }).then(function (r) {
        return r.json().then(function (d) { return r.ok && d && d.ok; }, function () { return false; });
      }).then(function (ok) {
        if (ok) { montrer("nl-ok"); form.reset(); } else { montrer("nl-err"); }
      }, function () { montrer("nl-err"); }).then(function () { bouton.disabled = false; });
    });
  });
})();
