/* Module « recherche » du moteur — découpé le 16/08/2026.
   Le code est celui d'explorateur.js, déplacé verbatim : seules les
   variables réassignées ont pris le préfixe S. de l'état partagé.
   A porte les fonctions des autres modules. */
import { S } from "./etat.js?v=33";
export default function (A) {
  /* Ce que ce module reçoit des autres — calculé, jamais listé à la main. */
  const { $, NIVEAU, T, TF, TN, annoncer, esc, liste, nomSecond, nomT, sansAccent } = A;
  /* ------------------------------------------------------------- recherche */

  /* Les articles que l'usage met devant un nom de commune et que le
     référentiel CNIGS n'écrit pas — ou écrit, selon la commune. « Les
     Gonaïves » ne trouvait rien ; « Les Cayes » se cherche aussi bien sans
     son article. On retire l'article des DEUX côtés, ce qui règle les deux
     sens à la fois. */
  var ARTICLES = /^(les|le|la|l|ls)[\s'-]+/;

  /* La forme réduite d'un nom : sans accent, sans article, sans tiret,
     sans apostrophe, sans espace. « Croix-Des-Bouquets », « croix des
     bouquets » et « CroixDesBouquets » y deviennent la même chaîne — et
     « Grand'Anse » rejoint « Grand Anse ». Ce n'est PAS un rapprochement
     approximatif : deux chaînes réduites qui coïncident désignent le même
     nom, tandis qu'une distance d'édition, elle, rapproche des noms
     différents. Les p-codes passent par la même moulinette sans dommage :
     ils n'ont ni article ni ponctuation. */
  function reduit(s) {
    return sansAccent(s).trim().replace(ARTICLES, "").replace(/[\s'’.-]/g, "");
  }

  function chercher(q) {
    var brut = sansAccent(q).trim();
    var k = reduit(q);
    if (!k) return [];
    var exact = [], debut = [], dedans = [];
    S.terr.forEach(function (r) {
      var a = reduit(r.nom_fr), b = reduit(r.nom_ht),
          c = reduit(r.pcode), d = reduit(r.atmart_geo_id);
      /* Les alias sont des mots entiers (« pays », « nasyonal ») : un match
         partiel ferait remonter la fiche nationale sur « pa »… */
      /* Les alias restent comparés sur la forme non réduite : ce sont des
         mots entiers (« pays », « nasyonal »), et les coller les uns aux
         autres ferait remonter la fiche nationale sur des fragments. */
      if (r.alias && sansAccent(r.alias).split(" ").indexOf(brut) > -1) { exact.push(r); return; }
      if (a === k || b === k || c === k || d === k) exact.push(r);
      else if (a.indexOf(k) === 0 || b.indexOf(k) === 0 || c.indexOf(k) === 0 || d.indexOf(k) === 0) debut.push(r);
      else if (a.indexOf(k) > 0 || b.indexOf(k) > 0 || c.indexOf(k) > -1 || d.indexOf(k) > -1) dedans.push(r);
    });
    var tri = function (x, y) { return x.niveau_admin - y.niveau_admin; };
    return exact.sort(tri).concat(debut.sort(tri), dedans.sort(tri)).slice(0, 30);
  }

  /* Suggestions en cas de faute : distance de Levenshtein bornée. */
  function proches(q) {
    var k = sansAccent(q).trim();
    if (k.length < 4) return [];
    function dist(a, b) {
      var m = a.length, n = b.length, prev = [], cur = [], i, j;
      if (Math.abs(m - n) > 3) return 99;
      for (j = 0; j <= n; j++) prev[j] = j;
      for (i = 1; i <= m; i++) {
        cur[0] = i;
        for (j = 1; j <= n; j++)
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur.slice();
      }
      return prev[n];
    }
    return S.terr.map(function (r) { return { r: r, d: dist(k, sansAccent(r.nom_fr)) }; })
      .filter(function (x) { return x.d <= 3; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 5).map(function (x) { return x.r; });
  }

  function afficherResultats(liste, q) {
    var el = $("#x-resultats");
    if (!q) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    if (!liste.length) {
      var sug = proches(q);
      el.innerHTML = '<p class="x-vide">' +
        TF("Aucun territoire ne correspond à « {q} ».", { q: esc(q) }) + "</p>" +
        (sug.length
          ? '<p class="x-vide" style="padding-top:0">' + T("Vouliez-vous dire :") + "</p>" +
            sug.map(function (r) { return carteResultat(r); }).join("")
          : '<p class="x-vide" style="padding-top:0">' +
            T("Essayez un nom de commune, un p-code (HT0121) ou un identifiant Atmart.") + "</p>");
      annoncer(sug.length
        ? TN({ one: "Aucun résultat exact. {n} suggestion proche.",
               other: "Aucun résultat exact. {n} suggestions proches." }, sug.length, { n: sug.length })
        : T("Aucun résultat."));
      return;
    }
    el.innerHTML = liste.map(carteResultat).join("");
    annoncer(TN({ one: "{n} territoire trouvé.", other: "{n} territoires trouvés." },
                liste.length, { n: liste.length }));
  }
  function carteResultat(r) {
    return '<button class="x-res" role="option" data-id="' + esc(r.atmart_geo_id) + '"><b>' +
      esc(nomT(r)) + "</b>" + (nomSecond(r) ? " <i>" + esc(nomSecond(r)) + "</i>" : "") +
      "<small>" + (T(NIVEAU[r.niveau_admin]) || esc(r.type_entite)) + " · " +
      esc(r.pcode || r.source_geo_id) + "</small></button>";
  }

  Object.assign(A, {chercher, proches, afficherResultats, carteResultat});
}
