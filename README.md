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
| Page unique | `index.html` — le moteur vit dans `assets/modules/` (huit modules ES, entrée `explorateur.js`) |
| Données publiques | `data/*.csv` + contour GeoJSON — chargées par le navigateur |
| PWA | `sw.js` (cache `explorateur-vN`) + `manifest.webmanifest` + `hors-connexion.html` |
| Tests | `tests/` — **hors dépôt** (`.gitignore` : fixtures synthétiques non publiables) ; `tests/explorateur-tests.html` porte 87 vérifications, `tests/verifier-liens.py` contrôle les liens internes |
| Chaîne et contrôles | dans l'atelier privé `Atmart_premium_datasets` : générateurs `build_*.py`, contrôles `verif_*.py`, et `barriere.py` qui les joue tous avant chaque `git push` (hook `pre-push`) |

**Le moteur appartient à ce dépôt** (décision du 22/08/2026) : il n'est plus
partagé avec atmart.ltd, et aucun script de l'atelier ne doit le recopier.
Les DONNÉES, elles, descendent de l'atelier (`sync_donnees.py`) : un fichier
de `data/` modifié ici est écrasé à la synchronisation suivante.

## Règles non négociables (héritées d'Atmart Data)

1. Aucune donnée fictive. 2. Une valeur manquante n'est jamais un zéro.
3. Aucune divergence de référentiel masquée. 4. Les pourcentages se
recalculent sur les totaux. 5. La couverture réelle est affichée.

## Développement

```bash
# synchroniser les données depuis l'atelier (source de vérité des données)
python ../Atmart_premium_datasets/sync_donnees.py

# servir en local (serveur multi-fils, le http.server standard tronque les gros
# fichiers) puis ouvrir tests/explorateur-tests.html (87 vérifications)
python tests/serveur_local.py 8788
```

**Avant tout push** : la barrière de l'atelier se joue d'elle-même (hook
`pre-push`) et refuse la publication si un contrôle échoue. À la main :
la syntaxe de chaque module (ce sont des modules ES : `node --check fichier.js` échoue sur `import`, il faut les passer par l'entrée standard — `Get-Content fichier.js -Raw | node --input-type=module --check`), tests verts, et si un
fichier servi a changé, monter son `?v=` **et** le nom du cache dans `sw.js`
— le service worker sert des copies figées sinon (`verif_versions_site.py
--relevement` le vérifie contre l'état publié).

## Déploiement

GitHub Pages, branche `main`, CNAME `explorateur.atmart.ltd`
(DNS : CNAME `explorateur` → `jwmyril.github.io` chez FastComet).
