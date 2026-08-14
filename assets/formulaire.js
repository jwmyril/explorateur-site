/* ===== Atmart Data — envoi des demandes =====
   Remplace les trois formulaires « mailto: » des pages Solutions, Campus et
   Parrainage.

   Le defaut corrige ici n'est pas esthetique. « mailto: » delegue l'envoi au
   logiciel de messagerie du visiteur. Quand il n'y en a pas — cas courant sur
   telephone, et sur tout poste ou le courrier se lit dans le navigateur — le
   clic n'ouvre rien du tout. La demande est perdue, et ni le visiteur ni
   Atmart ne l'apprennent. Un formulaire qui echoue en silence est pire que
   pas de formulaire : il fait croire que la demande est partie.

   Trois chemins, du meilleur au dernier recours :

   1. ENDPOINT renseigne : la demande part en POST. Le visiteur voit qu'elle
      est partie, ou voit qu'elle a echoue — jamais rien entre les deux.
   2. Envoi impossible, ou ENDPOINT vide : le message assemble s'affiche,
      copiable en un clic, avec l'adresse en clair. Le visiteur sans
      messagerie peut le coller dans son webmail. Rien ne se perd.
   3. Le lien « mailto: » reste offert a qui a une messagerie — comme une
      commodite, plus jamais comme unique chemin.

   Ce que ce fichier ne doit jamais contenir : une clef privee, un jeton, un
   secret. ENDPOINT recoit une URL publique de service de formulaire — ce type
   d'identifiant est public par construction. Tout ce qui est ici est lisible
   par n'importe quel visiteur.

   Les textes affiches viennent du HTML de la page, porteurs de data-i18n :
   ils sont donc traduits par le mecanisme existant, dans les quatre langues,
   sans seconde table de traduction a tenir a jour. */
(function () {
  "use strict";

  /* ---- A RENSEIGNER PAR ATMART -------------------------------------------
     URL de reception des demandes (Formspree, Web3Forms, Tally, ou tout
     service acceptant un POST). Tant que cette chaine est vide, le formulaire
     bascule sur le chemin 2 : le message reste affiche et copiable, donc
     aucune demande n'est perdue.
     ----------------------------------------------------------------------- */
  /* Notre propre Worker (atmart-chat), route /demande : e-mail immediat a
     sales@atmart.ltd via Resend — la clef reste cote serveur —, copie en KV,
     5 envois/jour/IP. Aucun service tiers : les demandes restent chez Atmart. */
  var ENDPOINT = "https://atmart-chat.atmartllc.workers.dev/demande";
  var ADRESSE = "sales@atmart.ltd";

  var cfg = window.ATM_FORM;
  if (!cfg) return;
  var f = document.getElementById(cfg.form);
  var panneau = document.getElementById(cfg.panneau);
  if (!f || !panneau) return;

  var zone = panneau.querySelector(".x-msg");
  var etat = panneau.querySelector(".x-etat");
  var bouton = f.querySelector('button[type="submit"]');
  var libelle = bouton ? bouton.textContent : "";

  function valeur(nom) {
    var e = f.elements[nom];
    if (!e) return "";
    /* Un select rend sa valeur technique ; c'est le libelle lu par le visiteur
       qui doit arriver a Atmart, sinon la demande parle en codes. */
    if (e.tagName === "SELECT" && e.selectedIndex >= 0) {
      return (e.options[e.selectedIndex].textContent || "").trim();
    }
    return (e.value || "").trim();
  }

  function assembler() {
    var lignes = [];
    cfg.champs.forEach(function (c) {
      var v = valeur(c[1]);
      if (v) lignes.push(c[0] + " : " + v);
    });
    /* Certaines demandes appellent une consigne — joindre une attestation, par
       exemple. Elle voyage avec le message plutot que de rester sur la page,
       sinon le visiteur la lit puis l'oublie en ecrivant son courriel. */
    if (cfg.pied) lignes.push("", cfg.pied);
    return lignes.join("\n");
  }

  function sujet() {
    return (cfg.sujet || "Atmart Data").replace(/\{(\w+)\}/g, function (_, n) {
      return valeur(n) || "—";
    });
  }

  /* Le panneau porte trois etats mutuellement exclusifs. Les afficher par
     classe plutot que par du texte fabrique en JS permet aux quatre langues de
     vivre dans le HTML, traduites comme le reste de la page. */
  function montrer(classe) {
    ["est-envoye", "est-copie", "est-erreur"].forEach(function (c) {
      panneau.classList.toggle(c, c === classe);
    });
    panneau.hidden = false;
    if (etat) etat.setAttribute("tabindex", "-1");
    if (etat) etat.focus();
  }

  function preparerCopie() {
    if (zone) zone.value = sujet() + "\n\n" + assembler();
    var lien = panneau.querySelector(".x-mailto");
    if (lien) {
      lien.setAttribute("href", "mailto:" + ADRESSE + "?subject="
        + encodeURIComponent(sujet())
        + "&body=" + encodeURIComponent(assembler()));
    }
    /* La saisie survit a un rechargement : perdre dix champs remplis parce que
       le reseau a lache est une raison suffisante pour ne pas recommencer. */
    try {
      sessionStorage.setItem("atmart_demande_" + cfg.form, zone ? zone.value : "");
    } catch (e) { /* navigation privee : tant pis, rien de casse */ }
  }

  var copier = panneau.querySelector(".x-copier");
  if (copier) {
    copier.addEventListener("click", function () {
      if (!zone) return;
      zone.select();
      var ok = false;
      try {
        ok = document.execCommand && document.execCommand("copy");
      } catch (e) { ok = false; }
      if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(zone.value).then(function () {
          panneau.classList.add("a-copie");
        });
        return;
      }
      panneau.classList.toggle("a-copie", !!ok);
    });
  }

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (typeof f.reportValidity === "function" && !f.reportValidity()) return;
    preparerCopie();

    if (!ENDPOINT) { montrer("est-copie"); return; }

    if (bouton) { bouton.disabled = true; bouton.textContent = "…"; }
    var charge = { sujet: sujet(), page: location.pathname };
    cfg.champs.forEach(function (c) { charge[c[1]] = valeur(c[1]); });

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(charge)
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      montrer("est-envoye");
      f.reset();
      try { sessionStorage.removeItem("atmart_demande_" + cfg.form); } catch (x) {}
    }).catch(function () {
      /* Un echec reseau ne doit pas rendre la demande introuvable : on retombe
         sur le message copiable, qui ne depend d'aucun service. */
      montrer("est-erreur");
    }).then(function () {
      if (bouton) { bouton.disabled = false; bouton.textContent = libelle; }
    });
  });
})();
