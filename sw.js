/* Service worker — Explorateur Haïti (explorateur.atmart.ltd)
   Meme doctrine que le site Atmart : precache fichier par fichier (jamais
   addAll, qui annule tout au premier manquant), et bump du nom de cache a
   CHAQUE modification d'un fichier servi — sinon les habitues gardent
   l'ancienne version sans le savoir. */
const CACHE = "explorateur-v21";
const DV = "?d=2026-08-14a";   // doit suivre le DV de assets/explorateur.js

const CORE = [
  "/", "/index.html", "/hors-connexion.html", "/manifest.webmanifest",
  "/assets/style.css?v=32", "/assets/data.css?v=25", "/assets/explorateur.js?v=11",
  "/assets/brand/favicon.ico", "/assets/brand/logo-32.png",
  "/assets/brand/logo-dark-96.png", "/assets/brand/apple-touch-icon.png",
];
const DATA = [
  "/data/atmart_referentiel_territoire_base_HT.csv",
  "/data/atmart_indicateurs_communes_HT.csv",
  "/data/atmart_referentiel_indicateurs.csv",
  "/data/atmart_pyramide_ages_HT.csv",
  "/data/atmart_prix_marches_HT.csv",
  "/data/haiti_contour_simplifie.geojson",
].map((u) => u + DV);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(CORE.concat(DATA).map((u) => c.add(u).catch(() => null)))
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) =>
    Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit ||
      fetch(e.request).then((r) => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
        }
        return r;
      }).catch(() =>
        e.request.mode === "navigate"
          ? caches.match("/hors-connexion.html")
          : Response.error()
      ))
  );
});
