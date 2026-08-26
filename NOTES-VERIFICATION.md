
## 25/08/2026 — une fausse alerte, consignée

Le commit `a656ff3` affirme que les dictionnaires en ligne « renvoyaient
MANQUE » sur les douze phrases de la maille départementale. **C'est faux, et
c'était une erreur de mesure, pas un défaut du site.**

Le contrôle interrogeait le JSON avec une clé française accentuée
(« Les {n} départements sont documentés. ») passée à Python à travers un tube
de shell Windows. La clé s'y corrompait, la recherche échouait, et je lisais
une absence là où il n'y avait qu'un mauvais outil de mesure. Les trois
dictionnaires portaient les traductions depuis le premier déploiement.

**Ce qu'il faut en retenir pour la prochaine fois** : pour vérifier une chaîne
traduite en production, chercher la VALEUR en octets bruts (`grep "depatman
yo"`) plutôt que la CLÉ accentuée. Une valeur kreyòl ou anglaise est
généralement sans accent ; la clé française ne l'est jamais.

Le relèvement de DV (`?d=2026-08-17a` → `2026-08-25a`) reste néanmoins juste :
le CSV des transferts par département a gagné une colonne `pcode_departement`
ce jour-là, et une donnée dont la forme change doit changer de version. Mais
je n'ai jamais démontré que le CDN servait effectivement une copie périmée —
c'est de l'hygiène, pas un correctif.
