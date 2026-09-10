/* Module « i18n » du moteur — découpé le 16/08/2026.
   Le code est celui d'explorateur.js, déplacé verbatim : seules les
   variables réassignées ont pris le préfixe S. de l'état partagé.
   A porte les fonctions des autres modules. */
import { S } from "./etat.js?v=39";
export default function (A) {
  /* Ce que ce module reçoit des autres — calculé, jamais listé à la main. */
  const { CFG, DIR, DV, charger, dico, parseCSV } = A;
  /* ------------------------------------------------------------------ langue
     La cle de traduction est la phrase francaise elle-meme. Deux consequences
     voulues : aucun nom de cle a inventer, et une traduction absente degrade
     vers le francais lisible plutot que vers une cle technique affichee crue. */
  
  var LOCALE = { fr: "fr-FR", ht: "fr-HT", en: "en-US", es: "es-ES" };
  var BASE = CFG.base || "";

  function substituer(t, vars) {
    Object.keys(vars || {}).forEach(function (k) {
      t = t.split("{" + k + "}").join(vars[k]);
    });
    return t;
  }
  /* CE QUI RETOMBE EN FRANÇAIS SE COMPTE, ET SE DIT.
     ================================================
     Une clef absente du dictionnaire ne casse rien : `T()` rend la phrase
     française. C'est justement le danger — la page se présente comme
     traduite tout en restant à moitié française, et rien ne le signale. Au
     10/09/2026, 164 phrases du moteur manquaient dans les trois langues, et
     la fiche kreyòl affichait « Rapport de la commune (PDF) » au milieu du
     kreyòl.
     On tient donc le compte de ce qui est réellement retombé, à l'écran, sur
     cette page-là. Le bandeau qui en découle est MESURÉ, pas déclaré : il
     apparaît exactement quand quelque chose n'a pas été traduit, et il
     disparaît tout seul le jour où plus rien ne manque — sans qu'aucune
     constante ne soit à mettre à jour, donc sans qu'aucune ne puisse mentir. */
  var RETOMBEES = Object.create(null);
  var nRetombees = 0;
  /* DEUX MALADIES, PAS UNE — et le 10/09/2026 le bandeau les a confondues.
     Une phrase absente du dictionnaire peut l'être pour deux raisons
     opposées. Ou bien elle n'a jamais été traduite, et la page est
     réellement à moitié française : c'est ce que le bandeau doit dire. Ou
     bien elle est DÉJÀ traduite et repasse par `T()` une seconde fois — le
     kreyòl est alors présenté au dictionnaire comme s'il était français, ne
     s'y trouve pas, et retombe sur lui-même. L'écran reste juste ; c'est le
     compteur qui a tort.
     On les sépare en regardant si la phrase est une VALEUR du dictionnaire.
     Si elle l'est, elle est déjà dans la langue de la page : on la range à
     part, on ne l'annonce pas au lecteur — mais on la garde, parce qu'une
     traduction de traduction est un défaut du code, et qu'il fallait la
     fiche kreyòl de Pòtoprens pour trouver les deux premières. */
  var DOUBLES = Object.create(null);
  var nDoubles = 0;
  var valeurs = null, valeursPour = null;

  function dejaTraduite(t) {
    if (valeursPour !== S.DICO) {
      valeurs = Object.create(null);
      valeursPour = S.DICO;
      Object.keys(S.DICO).forEach(function (k) {
        var v = S.DICO[k];
        if (typeof v === "string") valeurs[v] = 1;
        else if (v) { if (v.one) valeurs[v.one] = 1; if (v.other) valeurs[v.other] = 1; }
      });
    }
    return valeurs[t] === 1;
  }

  function T(t) {
    if (S.LANG === "fr" || !t) return t;
    var v = S.DICO[t];
    if (v == null) {
      if (dejaTraduite(t)) {
        if (!DOUBLES[t]) { DOUBLES[t] = 1; nDoubles += 1; }
      } else if (!RETOMBEES[t]) {
        RETOMBEES[t] = 1; nRetombees += 1; annoncerRetombees();
      }
      return t;
    }
    return typeof v === "string" ? v : (v.other || v.one || t);
  }

  /* Le bandeau est discret et honnête : il ne s'excuse pas, il informe. Il ne
     se ferme pas non plus — le masquer reviendrait à cacher le mélange, ce
     qui est exactement ce qu'on refuse. */
  var boiteAvis = null;
  var enTrain = false;
  function annoncerRetombees() {
    /* SANS CE VERROU, LA RÉCURSION EST CERTAINE : la phrase du bandeau passe
       elle-même par `T()`, et si elle manque au dictionnaire — ce qui est le
       cas le jour où on l'ajoute — elle se déclare retombée, ce qui rappelle
       cette fonction, indéfiniment. */
    if (enTrain || typeof document === "undefined") return;
    enTrain = true;
    try { peindreAvis(); } finally { enTrain = false; }
  }

  function peindreAvis() {
    if (!boiteAvis) {
      boiteAvis = document.getElementById("x-avis-langue");
      if (!boiteAvis) {
        var hote = document.querySelector(".x-barre") || document.body;
        boiteAvis = document.createElement("p");
        boiteAvis.id = "x-avis-langue";
        boiteAvis.className = "x-avis-langue";
        boiteAvis.setAttribute("role", "status");
        hote.parentNode.insertBefore(boiteAvis, hote);
      }
    }
    /* La phrase vit dans le dictionnaire comme les autres. Si elle-même
       manque, elle s'affiche en français — ce qui reste vrai et lisible. */
    boiteAvis.textContent = T("Une partie de cette page n'est pas encore "
      + "traduite et reste en français. Nous y travaillons.");
    boiteAvis.hidden = false;
  }

  /* Pour les contrôles et pour qui veut savoir : ce qui est retombé, ici.
     ====================================================================
     EXPOSÉ AU NAVIGATEUR, ET C'EST UTILE PLUTÔT QUE BAVARD. Le contrôle de
     l'atelier ne relève que les appels dont l'argument est écrit
     en toutes lettres sur place ; il ne voit pas les
     `T(NIVEAU[x])`, `T(STATUT[y])`, `T(normInfo.nom)` — des phrases rangées
     dans des tables et passées par variable. Il a donc annoncé 100 % de
     couverture le 10/09 pendant que le bandeau, lui, s'affichait encore.
     Le bandeau avait raison : il mesure ce qui arrive à l'écran, le contrôle
     mesure ce qu'il sait lire.
     `window.ATM_I18N_RETOMBEES()` rend la liste exacte, sur la page ouverte.
     C'est ainsi qu'on trouve ce qu'aucun balayage statique ne trouvera. */
  function retombees() {
    return { nombre: nRetombees, phrases: Object.keys(RETOMBEES),
             doubles: Object.keys(DOUBLES) };
  }
  try { window.ATM_I18N_RETOMBEES = retombees; } catch (e) { /* hors DOM */ }
  /* Une phrase a variables reste une seule unite de traduction : le traducteur
     voit la phrase entiere et peut deplacer les variables selon sa grammaire. */
  function TF(t, vars) { return substituer(T(t), vars); }

  /* Le pluriel n'obeit pas aux memes regles partout : le francais met zero au
     singulier, l'anglais et l'espagnol au pluriel, et le creole n'inflechit pas
     apres un nombre. Une seule regle francaise cablee en dur produirait
     « 0 communes » en francais et « 1 territories » en anglais. */
  function formePlurielle(n) {
    if (S.LANG === "fr") return n < 2 ? "one" : "other";
    if (S.LANG === "ht") return "other";
    return n === 1 ? "one" : "other";
  }
  /* formes = { one: "...", other: "..." } en francais ; la cle de traduction
     est la forme « other ». Une langue peut ne fournir qu'une chaine. */
  function TN(formes, n, vars) {
    var trad = S.LANG === "fr" ? formes : S.DICO[formes.other];
    if (trad == null) trad = formes;
    if (typeof trad === "string") trad = { one: trad, other: trad };
    var f = trad[formePlurielle(n)] || trad.other || trad.one;
    return substituer(f, vars || {});
  }

  /* Un rang ne s'ecrit pas pareil partout : 1er/2e en francais, 1st/2nd en
     anglais, 1.º/2.º en espagnol, 1ye/2yem en creole. Coller « <sup>e</sup> »
     a un chiffre ne marche qu'en francais. */
  function ordinal(n) {
    if (S.LANG === "en") {
      var r100 = n % 100, r10 = n % 10;
      var suf = (r100 >= 11 && r100 <= 13) ? "th"
              : r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
      return n + "<sup>" + suf + "</sup>";
    }
    if (S.LANG === "es") return n + ".<sup>o</sup>";
    if (S.LANG === "ht") return n === 1 ? "1<sup>ye</sup>" : n + "<sup>yèm</sup>";
    return n === 1 ? "1<sup>er</sup>" : n + "<sup>e</sup>";
  }

  /* « de Ouest » se dit « de l'Ouest » : elision devant voyelle. C'est une
     regle francaise. Les autres langues recoivent le nom brut et composent
     leur propre tournure dans leur modele de phrase. */
  function deNom(n) {
    return /^[aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ]/.test(n) ? "de l'" + n : "de " + n;
  }
  /* Libelles du referentiel des indicateurs, dans un fichier satellite :
     le fichier d'origine reste intact pour qui l'a deja telecharge.
     Cle = indicateur|langue|champ. */
  var LIB = {}, UNITES = {}, libCharge = {};

  function chargerLibelles(l) {
    if (l === "fr" || libCharge[l]) return Promise.resolve();
    return charger(DIR + "atmart_referentiel_indicateurs_i18n.csv", 1)
      .then(function (t) {
        parseCSV(t).forEach(function (r) {
          LIB[r.indicateur_id + "|" + r.langue + "|" + r.champ] = r.valeur;
          if (r.champ === "unite") {
            var fr = (dico[r.indicateur_id] || {}).unite;
            if (fr) UNITES[fr + "|" + r.langue] = r.valeur;
          }
        });
        libCharge[l] = true;
      })
      /* Absent ou illisible : on garde le francais plutot que d'afficher des
         libelles vides. Une donnee sans nom est pire qu'une donnee en francais. */
      .catch(function () { libCharge[l] = true; });
  }

  /* Un champ du dictionnaire, dans la langue courante, francais par defaut. */
  /* Le nom d'un territoire suit la langue quand la source en fournit un :
     Pòtoprens en kreyol, Port-au-Prince ailleurs. L'anglais et l'espagnol
     n'ont pas de toponymie propre pour Haiti — ils gardent la forme
     francaise, qui est celle du referentiel officiel.
     Les identifiants et les p-codes ne changent JAMAIS : c'est par eux
     qu'on rejoint les fichiers, quelle que soit la langue affichee. */
  function nomT(e) {
    if (!e) return "";
    if (S.LANG === "ht" && e.nom_ht) return e.nom_ht;
    return e.nom_fr || "";
  }
  /* L'autre graphie, quand elle differe : on la montre en second pour que
     l'utilisateur reconnaisse le territoire sous ses deux noms. */
  function nomSecond(e) {
    if (!e) return "";
    var a = nomT(e), b = S.LANG === "ht" ? e.nom_fr : e.nom_ht;
    return b && b !== a ? b : "";
  }

  function libelle(indId, nom) {
    if (S.LANG !== "fr") {
      var v = LIB[indId + "|" + S.LANG + "|" + nom];
      if (v) return v;
    }
    return (dico[indId] || {})[nom] || "";
  }
  function uniteL(u) {
    if (S.LANG === "fr" || !u) return u;
    return UNITES[u + "|" + S.LANG] || T(u);
  }

  function chargerLangue(l) {
    S.LANG = LOCALE[l] ? l : "fr";
    if (S.LANG === "fr") { S.DICO = {}; return Promise.resolve(); }
    return fetch(BASE + "assets/i18n/explorateur." + S.LANG + ".json" + DV, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { S.DICO = j || {}; })
      .catch(function () { S.DICO = {}; })   /* dictionnaire absent : on reste en francais */
      .then(function () { return chargerLibelles(S.LANG); });
  }

  Object.assign(A, {LOCALE, BASE, substituer, T, TF, formePlurielle, TN, ordinal, deNom, LIB, UNITES, libCharge, chargerLibelles, nomT, nomSecond, libelle, uniteL, chargerLangue, retombees});
}
