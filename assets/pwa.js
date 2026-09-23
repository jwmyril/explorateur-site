/* Application installable — invite d'installation et état de la connexion.
   15/08/2026.

   Deux services, tous deux discrets :

   1. Une invite d'installation qui n'apparaît QUE si le navigateur la propose
      (événement `beforeinstallprompt`), et seulement après que le visiteur a
      montré de l'intérêt — pas au premier écran. Une bannière qui saute au
      visage dès l'arrivée fait fuir ; une proposition qui arrive après une
      recherche est comprise. Refusée, elle ne revient pas de la session.

   2. Un bandeau quand la connexion tombe, qui dit ce qui reste POSSIBLE :
      hors ligne, l'édition légère garde l'index des 140 communes et les
      fiches déjà ouvertes. Annoncer une panne sans dire ce qui marche encore
      n'aide personne.

   Ce fichier est facultatif : le supprimer n'enlève rien au fonctionnement
   du site, seulement l'invite et le bandeau. */
(function () {
  "use strict";
  var invite = null, propose = false;

  function texteInstaller() {
    var l = (document.documentElement.lang || "fr").slice(0, 2);
    return {
      fr: { b: "Installer l'application", d: "Consultable sans connexion, sans compte.",
            n: "Plus tard" },
      ht: { b: "Enstale aplikasyon an", d: "Ou ka li l san entènèt, san kont.",
            n: "Pita" },
      en: { b: "Install the app", d: "Readable offline, no account needed.",
            n: "Later" },
      es: { b: "Instalar la aplicación", d: "Se consulta sin conexión, sin cuenta.",
            n: "Más tarde" }
    }[l] || null;
  }

  function texteHorsLigne() {
    var l = (document.documentElement.lang || "fr").slice(0, 2);
    return {
      fr: "Vous êtes hors connexion. Les communes déjà consultées et la recherche restent disponibles.",
      ht: "Ou pa gen entènèt. Komin ou te deja louvri yo ak rechèch la disponib toujou.",
      en: "You are offline. Communes you already opened and the search still work.",
      es: "Está sin conexión. Las comunas ya consultadas y la búsqueda siguen disponibles."
    }[l] || null;
  }

  function style() {
    if (document.getElementById("pwa-style")) return;
    var s = document.createElement("style");
    s.id = "pwa-style";
    s.textContent =
      "#pwa-inst{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:60;max-width:26rem;" +
      "margin:0 auto;background:#0e2240;color:#fff;border-radius:12px;padding:.85rem 1rem;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;gap:.7rem;align-items:center;" +
      "font-size:.92rem;line-height:1.35}" +
      "#pwa-inst button{font:inherit;border:0;border-radius:9px;padding:.6rem .9rem;" +
      "min-height:44px;cursor:pointer}" +
      "#pwa-oui{background:#2ec4b6;color:#04201d;font-weight:600}" +
      "#pwa-non{background:transparent;color:#cfe0f5;text-decoration:underline;min-width:44px}" +
      "#pwa-hors{position:fixed;left:0;right:0;top:0;z-index:61;background:#8a5a00;color:#fff;" +
      "padding:.55rem .9rem;font-size:.88rem;text-align:center}" +
      "#pwa-aide{position:fixed;inset:0;z-index:70;background:rgba(6,18,34,.55);display:flex;" +
      "align-items:center;justify-content:center;padding:1rem}" +
      "#pwa-aide-boite{background:#fff;color:#0e2240;border-radius:14px;padding:1.3rem 1.4rem;" +
      "max-width:32rem;box-shadow:0 10px 36px rgba(0,0,0,.3);font-size:.95rem;line-height:1.5}" +
      "#pwa-aide-boite h2{margin:0 0 .6rem;font-size:1.15rem}" +
      "#pwa-aide-boite p{margin:0 0 .7rem}" +
      "#pwa-aide-boite .pwa-note{color:#4a5f6d;font-size:.88rem}" +
      "#pwa-aide-ok{font:inherit;border:0;border-radius:9px;min-height:44px;padding:.6rem 1.1rem;" +
      "background:#0e2240;color:#fff;cursor:pointer}" +
      "@media(prefers-reduced-motion:no-preference){#pwa-inst{animation:pwa-mont .25s ease-out}}" +
      "@keyframes pwa-mont{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}";
    document.head.appendChild(s);
  }

  function proposer() {
    var t = texteInstaller();
    if (!invite || propose || !t) return;
    propose = true;
    style();
    var d = document.createElement("div");
    d.id = "pwa-inst";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", t.b);
    d.innerHTML = '<span style="flex:1"><b>' + t.b + "</b><br><small>" + t.d +
      '</small></span><button type="button" id="pwa-oui">' + t.b.split(" ")[0] +
      '</button><button type="button" id="pwa-non">' + t.n + "</button>";
    document.body.appendChild(d);
    d.querySelector("#pwa-oui").addEventListener("click", function () {
      d.remove();
      invite.prompt();
      invite.userChoice.then(function () { invite = null; });
    });
    d.querySelector("#pwa-non").addEventListener("click", function () {
      d.remove();
      try { sessionStorage.setItem("pwa_refus", "1"); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------------------
     DEMANDER L'APPLICATION SOI-MÊME (23/09/2026).

     Jusqu'ici, l'installation n'arrivait que si le navigateur la proposait,
     et seulement après un signe d'intérêt. Chrome et Edge la proposent,
     Safari jamais, Firefox non plus : sur un iPhone, un Mac ou un Firefox,
     le visiteur n'avait aucun moyen de demander l'application, même en la
     voulant. Le lien « Télécharger l'application » du pied de page et du
     menu Ressources ouvre donc toujours quelque chose :

       · si le navigateur a préparé une invite, elle part tout de suite ;
       · s'il n'en prépare pas, on montre les gestes de CET appareil ;
       · si l'application est déjà ouverte en mode installé, on le dit.

     On ne détecte pas le navigateur par son nom : on regarde ce qu'il
     sait faire. Un nom d'agent utilisateur se maquille, pas une capacité. */
  function installee() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
    } catch (e) {}
    return navigator.standalone === true;
  }

  function texteAide() {
    var l = (document.documentElement.lang || "fr").slice(0, 2);
    /* Le 23/09, un écran tactile suffisait à déclarer un téléphone : un
       ordinateur portable à écran tactile recevait les gestes Android. On
       demande donc au navigateur s'il se dit mobile (userAgentData.mobile),
       et on garde le nom du système seulement pour distinguer iOS d'Android,
       puisque les deux gestes diffèrent. */
    var ua = navigator.userAgent || "";
    var ios = /iP(hone|ad|od)/.test(navigator.platform || "") ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
    var android = /Android/i.test(ua);
    var uad = navigator.userAgentData;
    var tactile = ios || android || (uad ? uad.mobile === true : false);
    var T = {
      fr: {
        titre: "Télécharger l'application",
        deja: "L'application est déjà installée : vous la lisez en ce moment.",
        ios: "Sur iPhone et iPad : touchez le bouton Partager, puis « Sur l'écran d'accueil ».",
        droide: "Sur Android : ouvrez le menu du navigateur (⋮), puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
        bureau: "Sur ordinateur : ouvrez le menu du navigateur, puis « Installer » (Chrome, Edge) ou « Ajouter au Dock » (Safari). Dans Firefox, l'installation n'existe pas ; mettez la page en favori, elle reste lisible hors connexion.",
        rien: "Rien à télécharger depuis une boutique : l'application, c'est ce site, gardé sur votre appareil.",
        ok: "Fermer"
      },
      ht: {
        titre: "Pran aplikasyon an",
        deja: "Aplikasyon an gen tan enstale : se li w ap li la a.",
        ios: "Sou iPhone ak iPad : peze bouton Pataje a, apre chwazi « Sou ekran dakèy la ».",
        droide: "Sou Android : louvri meni navigatè a (⋮), apre chwazi « Enstale aplikasyon an » oswa « Mete l sou ekran dakèy ».",
        bureau: "Sou yon òdinatè : louvri meni navigatè a, apre chwazi « Enstale » (Chrome, Edge) oswa « Mete nan Dock la » (Safari). Nan Firefox, enstalasyon an pa egziste ; make paj la, w ap ka li l menm san entènèt.",
        rien: "Ou pa bezwen desann anyen nan yon boutik : aplikasyon an se sit sa a, ki rete sou aparèy ou.",
        ok: "Fèmen"
      },
      en: {
        titre: "Get the app",
        deja: "The app is already installed: this is it.",
        ios: "On iPhone and iPad: tap the Share button, then « Add to Home Screen ».",
        droide: "On Android: open the browser menu (⋮), then « Install app » or « Add to Home screen ».",
        bureau: "On a computer: open the browser menu, then « Install » (Chrome, Edge) or « Add to Dock » (Safari). Firefox has no install; bookmark the page, it stays readable offline.",
        rien: "Nothing to download from a store: the app is this site, kept on your device.",
        ok: "Close"
      },
      es: {
        titre: "Descargar la aplicación",
        deja: "La aplicación ya está instalada: es lo que está leyendo.",
        ios: "En iPhone y iPad: toque el botón Compartir y luego « Añadir a pantalla de inicio ».",
        droide: "En Android: abra el menú del navegador (⋮) y luego « Instalar aplicación » o « Añadir a pantalla de inicio ».",
        bureau: "En una computadora: abra el menú del navegador y luego « Instalar » (Chrome, Edge) o « Añadir al Dock » (Safari). Firefox no tiene instalación; guarde la página en marcadores, seguirá legible sin conexión.",
        rien: "No hay nada que descargar de una tienda: la aplicación es este sitio, guardado en su dispositivo.",
        ok: "Cerrar"
      }
    };
    var t = T[l] || T.fr;
    t.geste = installee() ? t.deja : (ios ? t.ios : (tactile ? t.droide : t.bureau));
    return t;
  }

  function aide() {
    var t = texteAide();
    var vieux = document.getElementById("pwa-aide");
    if (vieux) vieux.remove();
    style();
    var d = document.createElement("div");
    d.id = "pwa-aide";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-label", t.titre);
    d.innerHTML = '<div id="pwa-aide-boite"><h2>' + t.titre + "</h2><p>" + t.geste +
      "</p><p class=\"pwa-note\">" + t.rien + '</p><button type="button" id="pwa-aide-ok">' +
      t.ok + "</button></div>";
    document.body.appendChild(d);
    var fermer = function () { d.remove(); };
    d.querySelector("#pwa-aide-ok").addEventListener("click", fermer);
    d.addEventListener("click", function (ev) { if (ev.target === d) fermer(); });
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { fermer(); document.removeEventListener("keydown", esc); }
    });
    d.querySelector("#pwa-aide-ok").focus();
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-installer], a[href="#installer"]');
    if (!a) return;
    ev.preventDefault();
    var banniere = document.getElementById("pwa-inst");
    if (banniere) banniere.remove();
    if (invite && !installee()) {
      invite.prompt();
      invite.userChoice.then(function (c) {
        invite = null;
        /* Refusée ici, la demande vient du visiteur : on lui montre quand même
           les gestes manuels, sinon il reste devant un écran qui n'a rien fait. */
        if (!c || c.outcome !== "accepted") aide();
      });
      return;
    }
    aide();
  });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    invite = e;
    var refus = false;
    try { refus = sessionStorage.getItem("pwa_refus") === "1"; } catch (err) {}
    if (refus) return;
    /* On attend un signe d'intérêt : une recherche, un clic sur un résultat,
       ou trente secondes de lecture. Jamais à l'arrivée. */
    var interet = function () { setTimeout(proposer, 600); nettoyer(); };
    var nettoyer = function () {
      document.removeEventListener("input", surRecherche, true);
      document.removeEventListener("click", surClic, true);
    };
    var surRecherche = function (ev) {
      if (ev.target && /^(x-recherche|q|x-comp-input)$/.test(ev.target.id)) interet();
    };
    var surClic = function (ev) {
      if (ev.target.closest && ev.target.closest(".x-res, #res a, .x-puce")) interet();
    };
    document.addEventListener("input", surRecherche, true);
    document.addEventListener("click", surClic, true);
    setTimeout(function () { if (!propose) { proposer(); nettoyer(); } }, 30000);
  });

  /* Le signal de fin de course : la page est affichée, plus personne
     n'attend, le service worker peut prendre les données pour les visites
     suivantes. Deux secondes de marge après `load` — sur un mobile bas de
     gamme, le rendu n'est pas fini quand l'événement part. */
  window.addEventListener("load", function () {
    setTimeout(function () {
      /* PF-3 (16/09/2026) : le prechargement partait sans regarder la
         connexion. Un lecteur qui a demande a economiser ses donnees, ou dont
         la liaison est en 2G, ne paie pas d'avance des visites qu'il ne fera
         peut-etre pas : chaque fichier entrera au cache a sa premiere
         lecture, comme pour tout le monde. */
      var cx = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (cx && (cx.saveData || /(^|-)2g$/.test(cx.effectiveType || ""))) return;
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "precharger",
          langue: (document.documentElement.lang || "fr").slice(0, 2)
        });
      }
    }, 2000);
  });

  /* état de la connexion */
  function horsLigne() {
    var t = texteHorsLigne();
    if (!t || document.getElementById("pwa-hors")) return;
    style();
    var b = document.createElement("div");
    b.id = "pwa-hors";
    b.setAttribute("role", "status");
    b.textContent = t;
    document.body.appendChild(b);
  }
  function enLigne() {
    var b = document.getElementById("pwa-hors");
    if (b) b.remove();
  }
  window.addEventListener("offline", horsLigne);
  window.addEventListener("online", enLigne);
  if (navigator.onLine === false) horsLigne();
})();
