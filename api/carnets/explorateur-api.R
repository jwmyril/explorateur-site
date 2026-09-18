# Lire l'Explorateur Haïti par son API — script R
# Reading the Haiti Explorer through its API — R script
#
# Mêmes étapes que le carnet Python explorateur-api.ipynb.
# Version 1 (18/09/2026). Écrit sans R installé : non exécuté par Atmart —
# signalez tout problème à sales@atmart.ltd.
# Documentation : https://explorateur.atmart.ltd/api/index.html
#
# install.packages("jsonlite")
library(jsonlite)

BASE <- "https://explorateur.atmart.ltd/api/v1/"
lire <- function(chemin) fromJSON(paste0(BASE, chemin))

# 1. L'index de l'API
index <- lire("index.json")
print(index$compte)

# 2. Les territoires (niveau 1 = département, 2 = arrondissement, 3 = commune)
terr <- lire("territoires.json")$territoires
communes <- terr[terr$niveau == 3, ]
cat(nrow(communes), "communes\n")
parent_de <- setNames(terr$parent, terr$id)
nom_de <- setNames(terr$nom_fr, terr$id)
departement <- function(id) nom_de[[parent_de[[parent_de[[id]]]]]]

# 3. Un indicateur : temps d'accès à l'hôpital (NA = absent, jamais zéro)
v <- lire("indicateurs/IND-ACC-002.json")$valeurs
v <- v[!is.na(v$valeur), ]
v$commune <- unname(nom_de[v$territoire])
head(v[order(-v$valeur), c("commune", "valeur", "unite", "annee")], 5)

# 4. La médiane par département
v$departement <- vapply(v$territoire, departement, character(1))
sort(tapply(v$valeur, v$departement, median), decreasing = TRUE)

# 5. Les limites de l'indicateur, à citer avec le chiffre
ind <- lire("indicateurs.json")$indicateurs
ind[ind$id == "IND-ACC-002", ]$limites$fr
