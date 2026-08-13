# Explorateur Haïti — explorateur.atmart.ltd

Site autonome de l'Explorateur Haïti, un produit **Atmart Data**
(https://atmart.ltd). Même modèle que Suite360 et Arpentaj : son propre
sous-domaine, son propre dépôt, son identité — dans la famille Atmart.

Profils territoriaux des **140 communes d'Haïti** (référentiel CNIGS/OCHA
COD-AB 2018) : indicateurs sourcés et datés, comparaison de territoires avec
alerte de millésimes, classements à trois niveaux, quatre lectures (brute,
pour 100 km², part nationale, pour 10 000 habitants), exports CSV traçés.
Tout tourne dans le navigateur — aucun serveur, aucun compte, aucun traceur.

## Architecture

| Quoi | Où |
|---|---|
| Page unique | `index.html` — le moteur est `assets/explorateur.js` |
| Données publiques | `data/*.csv` + contour GeoJSON — chargées par le navigateur |
| PWA | `sw.js` (cache `explorateur-vN`) + `manifest.webmanifest` + `hors-connexion.html` |
| Tests | `tests/` — **exclu du dépôt** (fixtures synthétiques non publiables) |

Le moteur est **partagé** avec atmart.ltd pendant la transition :
`window.ATM_EXPLORATEUR.site` fait traverser les liens éditoriaux vers
atmart.ltd ; sans cette clé, le même fichier sert la version intégrée.

## Règles non négociables (héritées d'Atmart Data)

1. Aucune donnée fictive. 2. Une valeur manquante n'est jamais un zéro.
3. Aucune divergence de référentiel masquée. 4. Les pourcentages se
recalculent sur les totaux. 5. La couverture réelle est affichée.

## Développement

```bash
# synchroniser données + moteur depuis Atmart_website (source de vérité)
python tests/sync-donnees.py

# servir en local puis ouvrir tests/explorateur-tests.html (15 assertions)
python -m http.server 8362
```

**Avant tout push** : `node --check assets/explorateur.js`, tests verts, et si
un fichier servi a changé, monter son `?v=` **et** le nom du cache dans `sw.js`
— le service worker sert des copies figées sinon.

## Déploiement

GitHub Pages, branche `main`, CNAME `explorateur.atmart.ltd`
(DNS : CNAME `explorateur` → `jwmyril.github.io` chez FastComet).
