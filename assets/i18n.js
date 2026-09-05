// ===== Atmart i18n — sélecteur 4 langues (FR · HT · EN · ES), couverture complète =====
// Le français est la langue de base (texte dans le HTML). Les autres langues
// viennent de assets/i18n/<lang>.json. Aucune clé manquante = aucun mélange.
(function () {
  const TOUTES = { fr: "Français", ht: "Kreyòl", en: "English", es: "Español" };
  const DEFAULT = "fr";
  // LE NUMÉRO DES DICTIONNAIRES. Il suit celui de ce fichier : les deux
  // partent ensemble, puisqu'une clé nouvelle ici et sa traduction là-bas
  // sont une seule et même livraison. À monter dès qu'un `<lg>.json` change.
  const DICO_V = 23;
  // Une page dont la traduction n'est pas complete declare window.ATM_LANGUES.
  // Mieux vaut du francais entier qu'un menu traduit au-dessus de contenus
  // restes en francais : l'utilisateur croirait la page traduite.
  const LANGS = {};
  (window.ATM_LANGUES || Object.keys(TOUTES)).forEach((c) => {
    if (TOUTES[c]) LANGS[c] = TOUTES[c];
  });
  if (!Object.keys(LANGS).length) LANGS[DEFAULT] = TOUTES[DEFAULT];
  const orig = new Map();
  const base = window.ATM_I18N_BASE
    || (location.pathname.includes("/tutoriels/") ? "../" : "");

  function capture() {
    document.querySelectorAll("[data-i18n]").forEach((el) => orig.set(el, el.textContent));
    document.querySelectorAll("[data-i18n-html]").forEach((el) => orig.set(el, el.innerHTML));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => orig.set(el, el.getAttribute("placeholder")));
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => orig.set(el, el.getAttribute("aria-label")));
    /* Le titre de l'onglet et la description de la page vivent dans <head> et
       ne sont pas du texte visible : sans ce cas, une page « traduite »
       gardait son titre francais dans l'onglet et dans les resultats de
       recherche. */
    document.querySelectorAll("[data-i18n-content]").forEach((el) => orig.set(el, el.getAttribute("content")));
  }

  /* Dernier dictionnaire appliqué, gardé pour les fragments qui
     arrivent après coup — voir window.ATM_I18N.traduire(). */
  let dictCourant = {}, langCourante = DEFAULT;

  async function apply(lang) {
    const demande = lang;
    if (!LANGS[lang]) lang = DEFAULT;
    let dict = {};
    if (lang !== DEFAULT) {
      /* LE DICTIONNAIRE PORTE SON NUMÉRO DANS SON ADRESSE, comme tout le
         reste du site. `cache: "no-cache"` ne suffisait pas, et c'est une
         panne qui l'a montré : le service worker répond au CACHE D'ABORD
         pour tout ce qui n'est pas une navigation, donc il sert sa copie
         sans jamais consulter le réseau — l'option, qui ne parle qu'au
         cache HTTP du navigateur, n'était jamais atteinte.
         Conséquence mesurée le 01/09 : les traductions livrées le 30/08
         n'atteignaient aucun lecteur déjà venu. C'est la récidive exacte du
         défaut des marqueurs de données, quatre jours après sa correction.
         Ce numéro suit celui de i18n.js : les deux changent ensemble. */
      try { dict = await fetch(base + "assets/i18n/" + lang + ".json?v=" + DICO_V, { cache: "no-cache" }).then((r) => r.json()); }
      catch (e) { dict = {}; }
    }
    dictCourant = dict; langCourante = lang;
    const val = (key, fb) => (lang === DEFAULT ? fb : (dict[key] != null ? dict[key] : fb));
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = val(el.dataset.i18n, orig.get(el)); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = val(el.dataset.i18nHtml, orig.get(el)); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", val(el.dataset.i18nPh, orig.get(el))); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", val(el.dataset.i18nAria, orig.get(el))); });
    document.querySelectorAll("[data-i18n-content]").forEach((el) => { el.setAttribute("content", val(el.dataset.i18nContent, orig.get(el))); });
    document.documentElement.lang = lang;
    relierExplorateur(lang);
    // Si la page a ramene la langue au francais faute de traduction complete,
    // on ne touche pas au choix memorise : sinon visiter cette page effacerait
    // la preference de l'utilisateur pour tout le site.
    if (lang === demande && !window.ATM_LANG_FORCE) {
      localStorage.setItem("atmart_lang", lang);
    }
    // Les pages qui fabriquent leur contenu en JS (Explorateur) ne peuvent pas
    // etre traduites par attributs : on les previent pour qu'elles redessinent.
    document.dispatchEvent(new CustomEvent("atmart:lang", { detail: lang }));
    document.querySelectorAll(".lang-opt").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
    const cur = document.querySelector(".lang-current");
    if (cur) cur.textContent = "🌐 " + lang.toUpperCase();
  }

  // L'Explorateur a une URL par langue. Partout ailleurs sur le site, le lien
  // pointe vers la version francaise : on le reecrit pour que le lecteur reste
  // dans sa langue au lieu d'en changer sans l'avoir demande.
  const EXPL = "donnees-explorateur.html";
  function relierExplorateur(lang) {
    document.querySelectorAll('a[href$="' + EXPL + '"]').forEach((a) => {
      const q = a.getAttribute("href").split(EXPL)[1] || "";
      a.setAttribute("href", (lang === DEFAULT ? "/" : "/" + lang + "/") + EXPL + q);
    });
  }

  function buildSelector() {
    const nav = document.querySelector(".nav-links");
    if (!nav) return;
    if (Object.keys(LANGS).length < 2) return;   // rien a choisir
    const li = document.createElement("li");
    li.className = "lang-select";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "lang-current";
    // L'etiquette doit partir de la langue COURANTE, pas de "FR".
    // apply() la met a jour, mais il s'execute AVANT que ce bouton
    // existe : ecrite en dur, elle restait donc a FR sur une page
    // anglaise, kreyol ou espagnole. Constate le 30/08/2026.
    btn.textContent = "🌐 " + (document.documentElement.lang || DEFAULT).toUpperCase();
    btn.setAttribute("aria-label", "Langue / Lang");
    const menu = document.createElement("div");
    menu.className = "lang-menu";
    Object.keys(LANGS).forEach((code) => {
      const o = document.createElement("button");
      o.type = "button"; o.className = "lang-opt"; o.dataset.lang = code; o.textContent = LANGS[code];
      o.addEventListener("click", (e) => {
        e.stopPropagation();
        localStorage.setItem("atmart_lang_manual", "1"); // un choix manuel prime sur la detection
        hideHint();
        // Quand la page existe sous une URL par langue, on y va : traduire sur
        // place laisserait les trois autres langues invisibles pour un moteur
        // de recherche, et l'utilisateur ne pourrait pas partager le lien.
        const urls = window.ATM_LANG_URLS;
        if (urls && urls[code] && code !== document.documentElement.lang) {
          localStorage.setItem("atmart_lang", code);
          location.href = urls[code] + location.search + location.hash;
          return;
        }
        apply(code);
        menu.classList.remove("open");
      });
      menu.appendChild(o);
    });
    btn.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("open"); });
    document.addEventListener("click", () => menu.classList.remove("open"));
    li.appendChild(btn); li.appendChild(menu); nav.appendChild(li);
  }

  // ===== Invitation Kreyol =====
  // La detection du navigateur ne trouve pratiquement jamais les creolophones :
  // le code "ht" est a peine propose comme langue d'interface par Android/iOS,
  // et un Haitien du Massachusetts a le plus souvent un telephone en anglais.
  // On ne montre donc l'invitation que dans ce cas precis (langue detectee = EN,
  // aucun choix manuel), au maximum 3 fois, et jamais apres un clic.
  const HINT_MAX = 3;

  function hideHint() {
    localStorage.setItem("atmart_ht_hint", "done");
    const b = document.querySelector(".atm-hint");
    if (b) b.remove();
  }

  function maybeHint(lang) {
    if (lang !== "en") return;
    if (!LANGS.ht) return;                       // cette page n'offre pas le kreyol
    if (!window.__atmAuto) return;                          // langue deja choisie a la main
    if (localStorage.getItem("atmart_lang_manual")) return;
    const seen = localStorage.getItem("atmart_ht_hint");
    if (seen === "done") return;
    const n = parseInt(seen || "0", 10);
    if (n >= HINT_MAX) return;
    localStorage.setItem("atmart_ht_hint", String(n + 1));

    const bar = document.createElement("div");
    bar.className = "atm-hint";
    bar.innerHTML =
      '<span>Sit sa a disponib an Kreyòl ayisyen.</span>' +
      '<button type="button" class="go">Ale an Kreyòl</button>' +
      '<button type="button" class="x" aria-label="Fèmen">×</button>';
    bar.querySelector(".go").addEventListener("click", () => {
      localStorage.setItem("atmart_lang_manual", "1");
      hideHint();
      apply("ht");
    });
    bar.querySelector(".x").addEventListener("click", hideHint);
    const nav = document.querySelector("nav, header");
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  // __atmLang vient du petit script place dans le <head> : il a deja lu le choix
  // memorise, sinon la langue du navigateur, et masque la page le temps du rendu.
  // Une page servie sous une URL de langue impose sa langue : arriver sur
  // /ht/ depuis un moteur de recherche doit donner du kreyol, pas la langue
  // qu'on avait choisie la derniere fois.
  const start = (window.ATM_LANG_FORCE && LANGS[window.ATM_LANG_FORCE])
    ? window.ATM_LANG_FORCE
    : (window.__atmLang && LANGS[window.__atmLang]
        ? window.__atmLang
        : (localStorage.getItem("atmart_lang") || DEFAULT));

  capture();
  buildSelector();
  apply(start).then(() => {
    document.documentElement.classList.remove("i18n-wait");
    maybeHint(start);
  });

  /* Traduire un morceau de page construit APRÈS le premier passage.
   `orig` ne connaît pas ces éléments : on prend donc leur contenu écrit en
   dur comme repli, ce qui est exactement le français d'origine. */
  window.ATM_I18N = window.ATM_I18N || {};
  /* Traduire une CHAÎNE construite en JavaScript. La clé est la phrase
     française elle-même, comme dans le moteur : une chaîne sans traduction
     s'affiche alors en français lisible, jamais en identifiant technique. */
  window.ATM_I18N.texte = function (fr) {
    if (langCourante === DEFAULT) return fr;
    return dictCourant[fr] != null ? dictCourant[fr] : fr;
  };

  window.ATM_I18N.traduire = function (racine) {
  racine = racine || document;
  if (langCourante === DEFAULT) return;
  var v = function (cle, repli) {
    return dictCourant[cle] != null ? dictCourant[cle] : repli;
  };
  racine.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = v(el.dataset.i18n, el.textContent);
  });
  racine.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
    el.setAttribute("aria-label", v(el.dataset.i18nAria, el.getAttribute("aria-label")));
  });
  racine.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    el.setAttribute("title", v(el.dataset.i18nTitle, el.getAttribute("title")));
  });
  };

})();