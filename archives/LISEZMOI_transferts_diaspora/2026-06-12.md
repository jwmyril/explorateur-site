# Dataset : Transferts de la diaspora (2000–2025)

**Éditeur :** Atmart LLC (Mache Teknoloji ak Done) — dataset gratuit
**Fichier :** `transferts_diaspora_2000_2025.csv` (UTF-8, séparateur virgule)
**Dernière mise à jour de la source :** 08 avril 2026 (Banque mondiale)
**Lignes :** 208 (8 pays × 26 années)

## Contenu

Transferts personnels reçus (« personal remittances, received ») pour Haïti et 7 pays de comparaison de la Caraïbe et de l'Afrique francophone : Haïti, République dominicaine, Jamaïque, Sénégal, Côte d'Ivoire, Mali, Cameroun, Togo.

## Dictionnaire de variables

| Colonne | Type | Description |
|---|---|---|
| `pays` | texte | Nom du pays (anglais, tel que fourni par la Banque mondiale) |
| `code_iso3` | texte | Code pays ISO 3166-1 alpha-3 (ex. HTI = Haïti) |
| `annee` | entier | Année (2000–2025) |
| `transferts_usd` | nombre | Transferts reçus, en dollars US courants |
| `transferts_millions_usd` | nombre | Même valeur, en millions d'USD (lecture facile) |
| `part_pib_pct` | nombre | Transferts en % du PIB du pays |

Valeurs vides = donnée non encore publiée par la Banque mondiale pour cette année.

## Sources

- Banque mondiale, indicateur `BX.TRF.PWKR.CD.DT` (Personal remittances, received, current US$)
- Banque mondiale, indicateur `BX.TRF.PWKR.DT.GD.ZS` (Personal remittances, received, % of GDP)
- API : `https://api.worldbank.org/v2/country/HTI;DOM;JAM;SEN;CIV;MLI;CMR;TGO/indicator/...`

## Licence

Données sources : Banque mondiale, licence CC BY 4.0. Compilation Atmart : utilisation libre avec attribution « Atmart — atmart / données Banque mondiale ».

## Chiffres clés (pour vérification rapide)

- Haïti 2024 : 4 111 M USD, soit 16,3 % du PIB
- Haïti 2020 : 22,4 % du PIB (record de la série)
- République dominicaine 2024 : 11 247 M USD (9,1 % du PIB)
- Jamaïque 2024 : 3 564 M USD (16,2 % du PIB)
- Côte d'Ivoire 2024 : 1 771 M USD (2,0 % du PIB)

## Idées d'analyse (tutoriels Atmart)

1. Évolution des transferts vers Haïti, 2000–2025 (courbe) — que s'est-il passé en 2010 ? en 2020 ?
2. Comparaison % du PIB entre les 8 pays (barres) — pourquoi Haïti et la Jamaïque dépendent-elles autant des transferts ?
3. Dollars absolus vs % du PIB — le piège des grands nombres (République dominicaine vs Haïti).
