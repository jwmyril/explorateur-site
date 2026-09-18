/* PAGE D'INDICATEUR — graphique, carte et tableau qui se répondent (17/09/2026).

   Les données sont DANS la page (`#x-ind-donnees`, un bloc JSON que rien
   n'exécute) : elle s'affiche hors connexion, sans requête, et le tableau
   écrit en HTML reste lisible quand ce script ne tourne pas. Seul le fond de
   carte se charge à part, et seulement quand on ouvre l'onglet Carte.

   Une seule sélection de communes pour les trois vues : choisir Jacmel dans
   la carte le met en évidence dans le graphique et dans le tableau. L'adresse
   garde la sélection et l'onglet (`?t=…&vue=…`) : un lien partagé montre ce
   que l'expéditeur voyait.

   Les couleurs sont lues dans la feuille de style au moment de dessiner, pas
   écrites ici : la page suit le thème clair ou sombre du lecteur. L'image
   exportée, elle, est toujours sur fond blanc — c'est ce qui s'imprime et se
   colle dans un rapport. */
(function () {
  "use strict";
  var bloc = document.getElementById("x-ind-donnees");
  if (!bloc) return;
  var D = JSON.parse(bloc.textContent);
  var T = D.t, LANG = D.lang;
  var PAR_ID = {};
  D.valeurs.forEach(function (x) { PAR_ID[x.id] = x; });
  var tries = D.valeurs.slice().sort(function (a, b) { return b.v - a.v; });
  var VUES = ["graphique", "carte", "tableau"];
  var etat = { sel: [], vue: "graphique" };
  var geo = null;

  /* ---- nombres et textes ------------------------------------------- */
  function nombre(v) {
    var s = Math.abs(v) >= 1000 ? v.toFixed(0) : (v === Math.round(v) ? String(v)
            : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
    var neg = s.charAt(0) === "-"; s = s.replace("-", "");
    var p = s.split("."), ent = p[0], dec = p[1] || "";
    var paq = [];
    while (ent.length > 3) { paq.unshift(ent.slice(-3)); ent = ent.slice(0, -3); }
    paq.unshift(ent);
    var out = LANG === "en" ? paq.join(",") + (dec ? "." + dec : "")
                            : paq.join(" ") + (dec ? "," + dec : "");
    return (neg ? "-" : "") + out;
  }
  function avecUnite(v) { return D.court === "%" ? nombre(v) + " %" : nombre(v) + " " + D.court; }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function gabarit(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }

  /* ---- couleurs : lues dans le thème du lecteur ---------------------- */
  function palette(export_) {
    if (export_) return { fond: "#ffffff", encre: "#16202c", doux: "#5b6b7b", trait: "#e6ecf2",
                          accent: "#2a6df4", classes: CLASSES_CLAIR };
    var st = getComputedStyle(document.documentElement);
    var sombre = document.documentElement.getAttribute("data-theme") === "dark" ||
      (document.documentElement.getAttribute("data-theme") !== "light" &&
       window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    function v(n, d) { return (st.getPropertyValue(n) || "").trim() || d; }
    return { fond: v("--boite", "#f5f8fb"), encre: v("--encre", "#16202c"), doux: v("--doux", "#5b6b7b"),
             trait: v("--trait", "#e6ecf2"), accent: v("--accent", "#2a6df4"),
             classes: sombre ? CLASSES_SOMBRE : CLASSES_CLAIR };
  }
  /* Cinq classes d'une seule teinte : la plus foncée porte toujours la valeur
     la plus haute, quel que soit le sens de lecture — la légende dit ce
     qu'« haut » veut dire, la couleur ne juge pas. */
  var CLASSES_CLAIR = ["#dbe7fb", "#a9c6f4", "#6f9fe8", "#3a74d6", "#1b4aa0"];
  var CLASSES_SOMBRE = ["#1c2f4a", "#23457a", "#2f63ad", "#4f8ce0", "#8cb8f5"];

  /* ---- la sélection -------------------------------------------------- */
  function defaut() {
    var pris = tries.filter(function (x) { return x.sig !== "aberrant"; });
    var hauts = pris.slice(0, 5), bas = pris.slice(-5);
    return hauts.concat(bas).map(function (x) { return x.id; });
  }
  function lireAdresse() {
    var q = new URLSearchParams(location.search);
    var t = (q.get("t") || "").split(",").filter(function (id) { return PAR_ID[id]; });
    etat.sel = t.length ? t.slice(0, 20) : defaut();
    var v = q.get("vue");
    etat.vue = VUES.indexOf(v) >= 0 ? v : "graphique";
  }
  function ecrireAdresse() {
    var q = new URLSearchParams(location.search);
    q.set("t", etat.sel.join(","));
    q.set("vue", etat.vue);
    try { history.replaceState(null, "", location.pathname + "?" + q.toString()); } catch (e) {}
  }
  function basculer(id) {
    var i = etat.sel.indexOf(id);
    if (i >= 0) etat.sel.splice(i, 1); else if (etat.sel.length < 20) etat.sel.push(id);
    tout();
  }

  /* ---- les puces ------------------------------------------------------ */
  function puces() {
    var boite = document.getElementById("x-puces");
    boite.innerHTML = "";
    etat.sel.forEach(function (id) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = PAR_ID[id].nom;
      b.setAttribute("aria-label", gabarit(T.retirer, { nom: PAR_ID[id].nom }));
      b.addEventListener("click", function () { basculer(id); });
      boite.appendChild(b);
    });
  }

  /* Un nom trop long pour sa colonne est abrégé, jamais rogné par le bord :
     « …int-Louis du Nord » ne se lit pas. Le nom entier reste dans l'infobulle. */
  function abrege(nom, place) {
    var max = Math.max(4, Math.floor(place / 6.6));
    return nom.length > max ? nom.slice(0, max - 1) + "\u2026" : nom;
  }

  /* ---- le graphique : les communes choisies, et la médiane de toutes -- */
  function svgGraphique(pal, largeur) {
    /* Dessiné à la largeur réelle de l'écran : un graphique de 760 points
       réduit sur un téléphone rendait ses noms illisibles (5 px). */
    var L = largeur || 760, ligne = 26, haut = 30;
    var gauche = Math.min(170, Math.round(L * 0.34)), droite = Math.min(110, Math.round(L * 0.25));
    var choisies = etat.sel.map(function (id) { return PAR_ID[id]; })
                            .sort(function (a, b) { return b.v - a.v; });
    var max = Math.max.apply(null, choisies.map(function (x) { return x.v; }).concat([D.mediane])) || 1;
    var H = haut + choisies.length * ligne + 16;
    var ech = function (v) { return (L - gauche - droite) * v / max; };
    var s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L + " " + H + '" role="img" aria-label="' +
             esc(gabarit(T.graphe_alt, { q: D.question })) + '" font-family="system-ui,Segoe UI,Roboto,sans-serif">'];
    choisies.forEach(function (x, i) {
      var y = haut + i * ligne;
      var coul = x.sig ? pal.doux : pal.accent;
      s.push('<g data-id="' + x.id + '"><title>' + esc(x.nom + " — " + avecUnite(x.v)) + "</title>" +
             '<text x="' + (gauche - 8) + '" y="' + (y + 16) + '" text-anchor="end" font-size="12.5" fill="' +
             pal.encre + '">' + esc(abrege(x.nom, gauche - 12)) + "</text>" +
             '<rect x="' + gauche + '" y="' + (y + 4) + '" width="' + Math.max(1, ech(x.v)).toFixed(1) +
             '" height="' + (ligne - 9) + '" rx="3" fill="' + coul + '"></rect>' +
             '<text x="' + (gauche + ech(x.v) + 6).toFixed(1) + '" y="' + (y + 16) + '" font-size="12" fill="' +
             pal.encre + '">' + esc(avecUnite(x.v)) + (x.sig ? " · " + esc(T[x.sig]) : "") + "</text></g>");
    });
    var xm = gauche + ech(D.mediane);
    s.push('<line x1="' + xm.toFixed(1) + '" x2="' + xm.toFixed(1) + '" y1="' + (haut - 6) + '" y2="' + (H - 10) +
           '" stroke="' + pal.encre + '" stroke-dasharray="4 3"></line>' +
           '<text x="' + Math.min(xm + 4, L - 200).toFixed(1) + '" y="' + (haut - 12) + '" font-size="11.5" fill="' +
           pal.doux + '">' + esc(gabarit(T.mediane, { n: D.n, v: avecUnite(D.mediane) })) + "</text>");
    s.push("</svg>");
    return s.join("");
  }

  /* ---- la carte : 140 communes, cinq classes égales en effectif ------- */
  var bornes = (function () {
    var v = D.valeurs.map(function (x) { return x.v; }).sort(function (a, b) { return a - b; });
    return [1, 2, 3, 4].map(function (k) { return v[Math.floor(k * v.length / 5)]; });
  })();
  function classe(v) { var c = 0; while (c < 4 && v >= bornes[c]) c++; return c; }
  function svgCarte(pal, largeur) {
    if (!geo) return "";
    var L = largeur || 760, H = Math.round(L * 0.62);
    var x0 = -74.55, x1 = -71.6, y0 = 17.95, y1 = 20.12, k = Math.cos(19 * Math.PI / 180);
    var ech = Math.min((L - 20) / ((x1 - x0) * k), (H - 20) / (y1 - y0));
    function px(lon) { return 10 + (lon - x0) * k * ech; }
    function py(lat) { return 10 + (y1 - lat) * ech; }
    function anneaux(g) {
      var polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      return polys.map(function (p) {
        return p.map(function (r) {
          return "M" + r.map(function (c) { return px(c[0]).toFixed(1) + "," + py(c[1]).toFixed(1); }).join("L") + "Z";
        }).join("");
      }).join("");
    }
    var s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + L + " " + H + '" role="img" aria-label="' +
             esc(gabarit(T.carte_alt, { q: D.question })) + '">'];
    var dessus = [];
    geo.features.forEach(function (f) {
      var id = f.properties.atmart_geo_id, x = PAR_ID[id];
      var coul = x ? pal.classes[classe(x.v)] : pal.trait;
      var choisie = etat.sel.indexOf(id) >= 0;
      var p = '<path data-id="' + id + '" d="' + anneaux(f.geometry) + '" fill="' + coul + '" stroke="' +
              (choisie ? pal.encre : pal.fond) + '" stroke-width="' + (choisie ? 2 : 0.6) + '"><title>' +
              esc((x ? x.nom + " — " + avecUnite(x.v) + (x.sig ? " · " + T[x.sig] : "") : f.properties.nom_fr)) +
              "</title></path>";
      (choisie ? dessus : s).push(p);
    });
    s = s.concat(dessus);
    s.push("</svg>");
    return s.join("");
  }
  function legendeCarte(pal) {
    var v = D.valeurs.map(function (x) { return x.v; });
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    var bords = [lo].concat(bornes).concat([hi]);
    return '<div class="legende-carte">' + pal.classes.map(function (c, i) {
      return '<span><i style="background:' + c + '"></i>' + esc(nombre(bords[i]) + " – " + nombre(bords[i + 1])) + "</span>";
    }).join("") + "<span>" + esc(D.unite) + "</span></div>";
  }
  function chargerCarte() {
    if (geo) return Promise.resolve();
    var v = document.getElementById("x-v-carte");
    v.innerHTML = '<p class="doux">' + esc(T.chargement) + "</p>";
    return fetch(D.carte).then(function (r) { return r.json(); }).then(function (g) { geo = g; });
  }

  /* ---- le tableau : écrit dans la page, on ne fait que le marquer ----- */
  function tableau() {
    var lignes = document.querySelectorAll("#x-v-tableau tbody tr");
    Array.prototype.forEach.call(lignes, function (tr) {
      tr.classList.toggle("choisie", etat.sel.indexOf(tr.getAttribute("data-id")) >= 0);
    });
  }

  /* ---- les vues -------------------------------------------------------- */
  function dessiner() {
    var pal = palette(false);
    var g = document.getElementById("x-v-graphique");
    var larg = Math.max(300, Math.min(900, (g.clientWidth || 760) - 26));
    g.innerHTML = svgGraphique(pal, larg);
    if (etat.vue === "carte") {
      chargerCarte().then(function () {
        document.getElementById("x-v-carte").innerHTML = svgCarte(pal) + legendeCarte(pal);
      }).catch(function () {});
    } else if (geo) {
      document.getElementById("x-v-carte").innerHTML = svgCarte(pal) + legendeCarte(pal);
    }
    tableau();
  }
  function montrerVue() {
    VUES.forEach(function (k) {
      var o = document.getElementById("x-o-" + k), v = document.getElementById("x-v-" + k);
      var actif = k === etat.vue;
      o.setAttribute("aria-selected", actif ? "true" : "false");
      o.tabIndex = actif ? 0 : -1;
      v.hidden = !actif;
    });
  }
  function tout() { puces(); montrerVue(); dessiner(); ecrireAdresse(); }

  /* ---- interactions ---------------------------------------------------- */
  VUES.forEach(function (k, i) {
    var o = document.getElementById("x-o-" + k);
    o.addEventListener("click", function () { etat.vue = k; tout(); });
    o.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      etat.vue = VUES[(i + d + VUES.length) % VUES.length];
      tout();
      document.getElementById("x-o-" + etat.vue).focus();
    });
  });
  ["x-v-graphique", "x-v-carte", "x-v-tableau"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function (e) {
      if (e.target.closest("th button")) return;
      var n = e.target.closest("[data-id]");
      if (n) basculer(n.getAttribute("data-id"));
    });
  });
  var ajout = document.getElementById("x-ajout");
  ajout.addEventListener("change", function () {
    var nom = ajout.value.trim().toLowerCase();
    var x = D.valeurs.filter(function (v) { return v.nom.toLowerCase() === nom; })[0];
    if (x && etat.sel.indexOf(x.id) < 0) basculer(x.id);
    ajout.value = "";
  });
  document.getElementById("x-defaut").addEventListener("click", function () { etat.sel = defaut(); tout(); });
  document.getElementById("x-filtre").addEventListener("input", function (e) {
    var q = e.target.value.trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll("#x-v-tableau tbody tr"), function (tr) {
      tr.classList.toggle("cachee", q !== "" && tr.textContent.toLowerCase().indexOf(q) < 0);
    });
  });
  var sens = {};
  Array.prototype.forEach.call(document.querySelectorAll("#x-v-tableau th button"), function (b) {
    b.addEventListener("click", function () {
      var cle = b.getAttribute("data-tri"), corps = document.querySelector("#x-v-tableau tbody");
      sens[cle] = !sens[cle];
      var col = { rang: 0, nom: 1, dep: 2, v: 3 }[cle];
      var tr = Array.prototype.slice.call(corps.rows);
      tr.sort(function (a, b) {
        var x = a.cells[col], y = b.cells[col], r;
        if (cle === "v") r = parseFloat(x.getAttribute("data-v")) - parseFloat(y.getAttribute("data-v"));
        else if (cle === "rang") r = parseInt(x.textContent, 10) - parseInt(y.textContent, 10);
        else r = x.textContent.localeCompare(y.textContent, LANG);
        return sens[cle] ? r : -r;
      });
      tr.forEach(function (r) { corps.appendChild(r); });
    });
  });

  /* ---- exports : une image qui dit d'où elle vient --------------------- */
  function imageExport() {
    var pal = palette(true), L = 800;
    var vue = etat.vue === "carte" && geo ? svgCarte(pal, L - 40) : svgGraphique(pal, L - 40);
    var interieur = vue.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    var vb = /viewBox="0 0 (\d+) (\d+)"/.exec(vue), h = vb ? +vb[2] : 400;
    var H = h + 130;
    var src = gabarit(T.export_source, { s: D.source, a: D.annee });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + L + '" height="' + H + '" viewBox="0 0 ' + L + " " + H +
      '" font-family="system-ui,Segoe UI,Roboto,sans-serif"><rect width="100%" height="100%" fill="#ffffff"></rect>' +
      '<text x="20" y="34" font-size="20" font-weight="700" fill="#16202c">' + esc(D.question) + "</text>" +
      '<text x="20" y="58" font-size="13" fill="#5b6b7b">' + esc(D.unite + " · " + D.annee) + "</text>" +
      '<g transform="translate(20,72)">' + interieur + "</g>" +
      '<text x="20" y="' + (H - 34) + '" font-size="12" fill="#5b6b7b">' + esc(src) + "</text>" +
      '<text x="20" y="' + (H - 14) + '" font-size="12" fill="#5b6b7b">' + esc(T.signature + " · " + D.adresse) +
      "</text></svg>";
  }
  function telecharger(blob, nom) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function nomFichier(ext) { return D.ind.toLowerCase() + "-" + etat.vue + "." + ext; }
  function avantExport() { return etat.vue === "carte" ? chargerCarte() : Promise.resolve(); }
  document.getElementById("x-svg").addEventListener("click", function () {
    avantExport().then(function () {
      telecharger(new Blob([imageExport()], { type: "image/svg+xml" }), nomFichier("svg"));
    });
  });
  document.getElementById("x-png").addEventListener("click", function () {
    avantExport().then(function () {
      var svg = imageExport(), img = new Image();
      var m = /width="(\d+)" height="(\d+)"/.exec(svg);
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = +m[1] * 2; c.height = +m[2] * 2;
        var ctx = c.getContext("2d");
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        c.toBlob(function (b) { if (b) telecharger(b, nomFichier("png")); }, "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  });
  document.getElementById("x-lien").addEventListener("click", function () {
    var etatLien = document.getElementById("x-lien-etat");
    function dit() { etatLien.textContent = T.copie; setTimeout(function () { etatLien.textContent = ""; }, 2500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).then(dit, function () {});
    }
  });

  var minuteur;
  window.addEventListener("resize", function () { clearTimeout(minuteur); minuteur = setTimeout(dessiner, 200); });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", dessiner);
  }
  lireAdresse();
  tout();
})();
