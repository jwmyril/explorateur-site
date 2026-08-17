/* Service worker — Explorateur Haïti (explorateur.atmart.ltd)
   Meme doctrine que le site Atmart : precache fichier par fichier (jamais
   addAll, qui annule tout au premier manquant), et bump du nom de cache a
   CHAQUE modification d'un fichier servi — sinon les habitues gardent
   l'ancienne version sans le savoir. */
const CACHE = "explorateur-v57";
/* Les fiches que le lecteur a explicitement demande a garder (bouton de
   l'edition legere) vivent dans un cache A PART, et ce cache n'est JAMAIS
   purge au changement de version : sinon chaque mise en ligne effacerait
   sans prevenir les 700 Ko qu'on avait choisi de telecharger, souvent au
   prix d'un forfait compte a l'octet. La lecture, elle, passe par
   `caches.match`, qui interroge tous les caches — rien d'autre a changer. */
const GARDE = "explorateur-communes";
const DV = "?d=2026-08-15a";   // doit suivre le DV de assets/modules/explorateur.js

const CORE = [
  "/", "/index.html", "/hors-connexion.html", "/manifest.webmanifest",
  "/assets/style.css?v=33", "/assets/data.css?v=29", "/assets/modules/explorateur.js?v=14",
  "/assets/modules/etat.js?v=13",
  "/assets/modules/explorateur-i18n.js?v=13",
  "/assets/modules/explorateur-carte.js?v=13",
  "/assets/modules/explorateur-fiche.js?v=13",
  "/assets/modules/explorateur-recherche.js?v=13",
  "/assets/modules/explorateur-comparaison.js?v=13",
  "/couches.html", "/fiche.html", "/assets/couches.js?v=4",
  "/assets/pwa.js?v=2",
  "/assets/brand/favicon.ico", "/assets/brand/logo-32.png",
  "/assets/brand/logo-dark-96.png", "/assets/brand/apple-touch-icon.png",
  // Icones de l'application installee : Android et Chrome exigent 192 et 512,
  // et les versions « maskable » evitent que le lanceur rogne le logo.
  "/assets/brand/icone-192.png", "/assets/brand/icone-512.png",
  "/assets/brand/icone-192-maskable.png", "/assets/brand/icone-512-maskable.png",
  // L'index des 140 communes de l'edition legere : 10 Ko qui rendent la
  // RECHERCHE possible sans reseau. Les fiches, elles, se mettent en cache a
  // mesure qu'on les ouvre — precacher les 140 (700 Ko) rallongerait
  // l'installation sur une liaison lente pour un benefice incertain.
  "/data/leger/communes.json",
];
const DATA = [
  "/data/atmart_referentiel_territoire_base_HT.csv",
  "/data/atmart_indicateurs_communes_HT.csv",
  "/data/atmart_referentiel_indicateurs.csv",
  // 72 Ko reels sur le reseau : la pyramide avait ete tenue hors du
  // precache pour son poids suppose, motif qui ne tenait plus une fois
  // mesure. Hors connexion, une fiche sans pyramide est une fiche amputee.
  "/data/atmart_pyramide_ages_HT.csv",
  "/data/atmart_prix_marches_HT.csv",
  "/data/haiti_contour_simplifie.geojson",
].map((u) => u + DV);

/* A L'INSTALLATION, ON NE PREND QUE LE NOYAU.
   Mesure du 16/08 sur une premiere visite : DOM pret a 8,0 s et chargement
   complet a 12,5 s, alors que le fichier le plus lourd arrivait en 67 ms.
   Le reseau n'y etait pour rien — le service worker telechargeait ses vingt
   fichiers PENDANT que la page essayait de s'afficher, et le nouveau venu
   payait comptant une avance faite pour ses visites suivantes. Le noyau
   (pages, styles, moteur, icones, index leger) part donc seul ; les donnees
   attendent que la page soit affichee, et c'est elle qui le dit. */
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(CORE.map((u) => c.add(u).catch(() => null)))
  ).then(() => self.skipWaiting()));
});

/* Les donnees, quand plus personne n'attend. Si le message n'arrive jamais
   — onglet ferme trop tot, page sans script — rien n'est perdu : chaque
   fichier entre au cache a sa premiere lecture, comme le reste. */
let donneesFaites = false;
self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "precharger" || donneesFaites) return;
  donneesFaites = true;
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(DATA.map((u) => c.add(u).catch(() => null)))
  ));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE && k !== GARDE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

/* Hors connexion, une page inconnue ne renvoie pas une excuse seule :
   l'edition legere est en cache avec l'index des 140 communes, donc le
   lecteur peut CHERCHER et LIRE sa commune sans reseau. On la sert quand la
   navigation visait une fiche ; la page d'excuse reste pour le reste, et
   elle-meme pointe vers l'edition legere. */
function filet(url, requete) {
  const versUneFiche = /^\/(index\.html)?$/.test(url.pathname) ||
                       url.pathname.startsWith("/fiche") ||
                       url.searchParams.has("id") || url.searchParams.has("c");
  return caches.match(requete)
    .then((c) => c || (versUneFiche ? caches.match("/fiche.html") : null))
    .then((c) => c || caches.match("/hors-connexion.html"));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  /* LES PAGES PASSENT PAR LE RESEAU D'ABORD, le cache n'est que le filet.
     La regle inverse — le cache d'abord, partout — a fige des lecteurs sur
     une version ancienne : un script porte son numero dans son adresse
     (`?v=`), une page HTML n'en porte aucun, donc rien ne la distingue de
     celle d'avant et la copie gardee gagnait indefiniment. Un aller-retour
     de plus par page (quelques kilooctets compresses) contre la certitude
     de lire la version publiee : le change est bon, et hors connexion le
     filet reprend la main exactement comme avant. */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((r) => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
        }
        return r;
      }).catch(() => filet(url, e.request))
    );
    return;
  }

  /* Le reste — scripts, styles, donnees — porte un numero de version dans
     son adresse : le cache d'abord est ici sans danger et sans reseau. */
  e.respondWith(
    caches.match(e.request).then((hit) => hit ||
      fetch(e.request).then((r) => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
        }
        return r;
      }).catch(() => Response.error()))
  );
});
