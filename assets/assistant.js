/* Assistant de l'Explorateur Haïti — 17/08/2026.

   CE QU'IL EST. Un assistant qui explique, met des chiffres en regard, et dit
   ce que la donnée ne permet pas de savoir. Il s'adresse à quelqu'un qui n'est
   pas statisticien et qui ferme la page s'il ne comprend pas — c'est la raison
   d'être de ce fichier.

   CE QU'IL NE PEUT PAS FAIRE, et ce n'est pas une promesse mais un mécanisme.
   Trois barrières, dans cet ordre :

   1. LA SÉLECTION SE FAIT ICI, dans le navigateur, sur les données DÉJÀ
      chargées. Le modèle ne reçoit ni accès au réseau, ni la base entière :
      seulement les quelques dizaines de faits qui concernent la question.
   2. LE PROMPT LUI INTERDIT de produire un nombre absent de ces faits, et
      lui interdit même de CALCULER — un ratio utile est fourni tout fait.
      Sans cette interdiction, il faudrait accepter des nombres absents des
      faits, et la barrière suivante s'effondrerait.
   3. LE SERVEUR VÉRIFIE. Chaque nombre de la réponse doit se retrouver dans
      les faits envoyés ; sinon la réponse est refusée avant de partir. C'est
      la seule garantie qui ne repose pas sur la bonne volonté du modèle.

   POURQUOI PAS DE RÉPONSE APPROXIMATIVE PLUTÔT QUE PAS DE RÉPONSE. Parce que
   tout ce produit vaut par une chose : ses chiffres sont vrais et ses trous
   sont dits. Un assistant qui invente un nombre plausible détruit cela pour
   les vingt-huit autres blocs de la fiche.

   VIE PRIVÉE. La question part au Worker d'Atmart, sans identifiant, sans
   cookie, sans historique conservé. Rien n'est mémorisé d'une visite à
   l'autre : ni la question, ni la réponse. */
(function () {
  "use strict";
  var POINT = "https://atmart-chat.atmartllc.workers.dev/eksplore";
  var MAX_FAITS = 13000;

  function T(fr) {
    return (window.ATM_I18N && window.ATM_I18N.texte) ? window.ATM_I18N.texte(fr) : fr;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function langue() {
    var l = document.documentElement.lang || "fr";
    return ["fr", "ht", "en", "es"].indexOf(l) > -1 ? l : "fr";
  }

  /* ------------------------------------------------------------- LES FAITS

     Ce que l'assistant a le droit de savoir. On assemble ici, à partir de ce
     que la page a déjà en mémoire, un bloc de texte compact. Tout ce qui n'y
     figure pas est, pour lui, inconnu — et il doit le dire.

     `window.ATM_FAITS` est publié par le moteur (fiche) et par la page
     Couches, chacun sachant ce qu'il a chargé. Ce fichier ne va rien chercher
     lui-même : il ne doit exister qu'une source de vérité par page. */
  function faits() {
    var f = (window.ATM_FAITS && window.ATM_FAITS()) || "";
    return String(f).slice(0, MAX_FAITS);
  }

  /* ------------------------------------------------------------ INTERFACE */

  function bulle(role, texte, classe) {
    return '<div class="as-m as-' + role + (classe ? " " + classe : "") + '">' +
           esc(texte).replace(/\n/g, "<br>") + "</div>";
  }

  function poser() {
    if (document.getElementById("as-boite")) return;
    var hote = document.getElementById("as-hote");
    if (!hote) return;

    hote.innerHTML =
      '<details id="as-boite" class="as-boite">' +
      '<summary class="as-t">' + esc(T("Poser une question sur ces données")) + "</summary>" +
      '<div class="as-c">' +
      '<p class="as-avis">' + esc(T(
        "Cet assistant ne répond qu'avec les données de la page où vous êtes. " +
        "Il ne cherche rien ailleurs, ne calcule rien, et refuse de répondre " +
        "plutôt que de deviner. Votre question n'est pas conservée.")) + "</p>" +
      '<div id="as-fil" class="as-fil" aria-live="polite"></div>' +
      '<div class="as-saisie">' +
      '<label class="x-sr" for="as-q">' + esc(T("Votre question")) + "</label>" +
      '<input id="as-q" type="text" autocomplete="off" maxlength="300" placeholder="' +
      esc(T("Par exemple : que veut dire ce chiffre ?")) + '" />' +
      '<button type="button" id="as-env" class="btn btn-primary">' +
      esc(T("Demander")) + "</button></div>" +
      '<div id="as-suggestions" class="as-sug"></div>' +
      "</div></details>";

    suggestions();
    document.getElementById("as-env").addEventListener("click", envoyer);
    document.getElementById("as-q").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); envoyer(); }
    });
    document.getElementById("as-suggestions").addEventListener("click", function (e) {
      var b = e.target.closest("[data-q]");
      if (!b) return;
      document.getElementById("as-q").value = b.dataset.q;
      envoyer();
    });
  }

  /* Trois questions prêtes. Quelqu'un qui n'ose pas écrire à une machine
     clique ; et ces trois-là montrent en une ligne ce que l'assistant sait
     faire — expliquer, comparer, avouer ses limites. */
  function suggestions() {
    var s = document.getElementById("as-suggestions");
    if (!s) return;
    var qs = (window.ATM_FAITS_SUGGESTIONS && window.ATM_FAITS_SUGGESTIONS()) || [
      "Que veut dire ce chiffre, en clair ?",
      "Quelles sont les limites de cette donnée ?",
      "Qu'est-ce que cette page ne permet pas de savoir ?"
    ];
    s.innerHTML = qs.map(function (q) {
      return '<button type="button" class="as-sq" data-q="' + esc(T(q)) + '">' +
             esc(T(q)) + "</button>";
    }).join("");
  }

  var enCours = false;

  function envoyer() {
    if (enCours) return;
    var champ = document.getElementById("as-q");
    var fil = document.getElementById("as-fil");
    var q = (champ.value || "").trim();
    if (!q) return;

    var f = faits();
    if (!f) {
      fil.innerHTML += bulle("r", T(
        "Les données de cette page ne sont pas encore chargées. Réessayez dans un instant."), "as-avert");
      return;
    }

    enCours = true;
    champ.value = "";
    fil.innerHTML += bulle("q", q);
    fil.innerHTML += '<div class="as-m as-r as-attente">' + esc(T("Je regarde les données…")) + "</div>";
    fil.scrollTop = fil.scrollHeight;

    fetch(POINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, faits: f, langue: langue() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      var att = fil.querySelector(".as-attente");
      if (att) att.remove();
      if (d && d.refus) {
        /* LE REFUS EST UN RÉSULTAT, PAS UNE PANNE. Le contrôle du serveur a
           trouvé dans la réponse un nombre absent des données : elle ne
           s'affiche pas. On le DIT au lecteur — c'est la preuve visible que
           la garantie fonctionne, et non un message d'erreur à cacher. */
        fil.innerHTML += bulle("r", T(
          "Je préfère ne pas répondre : la réponse que j'allais donner " +
          "contenait un chiffre qui ne figure pas dans les données de cette " +
          "page. Sur ce site, un chiffre non vérifié ne s'affiche pas. " +
          "Reformulez votre question, ou demandez-moi d'expliquer un chiffre " +
          "précis que vous voyez à l'écran."), "as-avert");
      } else if (d && d.reponse) {
        fil.innerHTML += bulle("r", d.reponse);
      } else {
        fil.innerHTML += bulle("r", T(
          "L'assistant n'est pas joignable pour l'instant. Les données de la " +
          "page, elles, restent lisibles et téléchargeables."), "as-avert");
      }
      fil.scrollTop = fil.scrollHeight;
    }).catch(function () {
      var att = fil.querySelector(".as-attente");
      if (att) att.remove();
      fil.innerHTML += bulle("r", T(
        "La connexion n'a pas abouti. L'assistant a besoin du réseau ; le " +
        "reste de la page fonctionne sans lui."), "as-avert");
    }).then(function () { enCours = false; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", poser);
  } else { poser(); }
  document.addEventListener("atmart:lang", function () {
    var b = document.getElementById("as-boite");
    if (b) { b.remove(); poser(); }
  });
})();
