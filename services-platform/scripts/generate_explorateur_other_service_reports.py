from generate_explorateur_service_reports import create_report


REPORTS = [
    {
        "file": "atmart-verifie-audit-donnees.pdf",
        "title": "Atmart Vérifié",
        "tag": "Savoir exactement ce qu’un jeu de données permet - et ne permet pas - d’affirmer.",
        "promise": "Un fichier peut être complet en apparence et rester inutilisable. Atmart Vérifié examine sa <b>provenance, sa qualité, sa cohérence, ses droits d’usage et ses limites</b>.",
        "audience": "Producteurs de données, ONG, ministères, chercheurs et projets qui s’apprêtent à publier, financer, intégrer ou réutiliser un jeu de données.",
        "steps": [("Cadrage du jeu", "Usage prévu, population, période, variables et décisions concernées."), ("Contrôles mesurés", "Complétude, unicité, validité, cohérence, géocodage et fraîcheur."), ("Concordance", "Comparaison aux sources et référentiels disponibles."), ("Passeport juridique", "Producteur, conditions, licence, attribution et restrictions."), ("Verdict documenté", "Forces, anomalies, risques et limites d’interprétation.")],
        "deliver": [("Fiche Atmart Vérifié", "Documentation structurée du jeu."), ("Table des contrôles", "Tests, résultats et preuves reproductibles."), ("Registre des anomalies", "Gravité, impact et recommandation."), ("Passeport juridique", "Droits de publication et de réutilisation."), ("Réunion de restitution", "Lecture du verdict et priorités.")],
        "excluded": "Correction complète du fichier, collecte de remplacement, certification réglementaire ou avis juridique. Une anomalie non démontrable reste signalée comme incertitude.",
        "price": "199 USD", "price_note": "par jeu standard", "price_copy": "Un jeu de données, jusqu’à trois fichiers liés et une restitution. Le nettoyage éventuel fait l’objet d’un devis séparé.",
        "why": [("Mesuré sur le fichier", "Les taux sont recalculés, jamais recopiés d’une note."), ("Limites explicites", "Le livrable dit aussi ce qu’on ne peut pas conclure."), ("Preuves réutilisables", "Tests, sources et règles vous sont remis.")],
    },
    {
        "file": "cartographie-sur-mesure-atmart.pdf",
        "title": "Cartographie sur mesure Atmart",
        "tag": "Montrer une réalité territoriale sans déformer ce que disent les données.",
        "promise": "Une carte utile ne se contente pas d’être belle. Elle rend visibles <b>la source, le millésime, l’échelle, les absences et les limites</b> de chaque résultat.",
        "audience": "Organisations qui préparent un rapport, une proposition, une intervention ou une présentation et doivent communiquer une information territoriale vérifiable.",
        "steps": [("Question cartographique", "Message, public, territoire, support final et décision attendue."), ("Contrôle des données", "Échelle, codes géographiques, couverture et valeurs manquantes."), ("Choix visuel", "Projection, classes, couleurs, symboles et traitement des absences."), ("Production", "Carte principale, légende, notes et formats demandés."), ("Validation", "Relecture factuelle et ajustements de présentation.")],
        "deliver": [("Carte prête à publier", "PNG haute définition et PDF."), ("Version éditable", "SVG ou projet convenu selon le besoin."), ("Données cartographiques", "GeoJSON ou tableau de jointure autorisé."), ("Notice de lecture", "Source, millésime, méthode et limites."), ("Une révision", "Corrections dans le périmètre validé.")],
        "excluded": "Géocodage massif, acquisition d’imagerie, relevé terrain ou carte à une échelle que les données ne permettent pas. Un zéro ne remplace jamais une absence de donnée.",
        "price": "129 USD", "price_note": "par carte standard", "price_copy": "Une carte, une déclinaison graphique et une révision. Séries de cartes, atlas et données complexes : devis préalable.",
        "why": [("Échelle honnête", "La carte ne descend jamais plus bas que sa source."), ("Formats ouverts", "Vous gardez des fichiers réutilisables sans Atmart."), ("Méthode visible", "Chaque carte porte ses sources et avertissements.")],
    },
    {
        "file": "harmonisation-referentiels-atmart.pdf",
        "title": "Harmonisation de référentiels Atmart",
        "tag": "Faire parler ensemble des bases qui nomment différemment les mêmes territoires.",
        "promise": "Des noms proches ne sont pas nécessairement le même lieu. L’harmonisation construit des correspondances <b>traçables, stables et reproductibles</b> vers les codes de référence.",
        "audience": "Équipes qui rapprochent plusieurs bases territoriales comportant variantes de noms, codes absents, millésimes différents ou rattachements administratifs contradictoires.",
        "steps": [("Inventaire", "Sources, identifiants, niveaux géographiques et millésimes."), ("Normalisation", "Noms, accents, variantes historiques et règles de comparaison."), ("Appariement contrôlé", "Correspondances certaines, candidates, ambiguës et non rattachées."), ("Validation", "Revue des cas sensibles et conservation de la preuve."), ("Automatisation", "Script et règles pour rejouer l’alignement.")],
        "deliver": [("Table de correspondance", "Identifiants sources et codes cibles."), ("Registre des exceptions", "Ambiguïtés et éléments non rattachés."), ("Rapport de couverture", "Taux par source, niveau et territoire."), ("Script reproductible", "Traitement relançable sur une nouvelle version."), ("Dictionnaire des règles", "Choix, priorités et limites.")],
        "excluded": "Correspondance inventée pour atteindre 100 %, refonte de la base source, dédoublonnage de personnes ou validation administrative officielle des nouveaux découpages.",
        "price": "299 USD", "price_note": "périmètre standard", "price_copy": "Jusqu’à trois fichiers et 10 000 lignes. Volume, complexité ou référentiels supplémentaires : devis avant traitement.",
        "why": [("Aucun rapprochement forcé", "L’ambiguïté reste visible et comptée."), ("Référentiel solide", "P-codes et arbre territorial déjà disponibles."), ("Travail rejouable", "Le script accompagne la table finale.")],
    },
    {
        "file": "formation-accompagnement-atmart.pdf",
        "title": "Formation et accompagnement Atmart",
        "tag": "Aider votre équipe à lire, produire et contester des données territoriales.",
        "promise": "La formation part de vos décisions et de vos fichiers. L’objectif est une équipe capable de <b>reproduire la méthode, reconnaître les limites et expliquer ses résultats</b>.",
        "audience": "ONG, institutions, étudiants et équipes de programme qui veulent renforcer leurs pratiques en qualité des données, analyse territoriale, cartographie ou tableaux de bord.",
        "steps": [("Diagnostic des besoins", "Profils, outils, objectifs, contraintes et cas de travail."), ("Parcours ciblé", "Contenu adapté au niveau et aux décisions de l’équipe."), ("Atelier pratique", "Exercices sur l’Explorateur ou sur des données autorisées."), ("Production guidée", "Un résultat concret réalisé pendant la session."), ("Plan d’autonomie", "Ressources, contrôles et prochaines pratiques.")],
        "deliver": [("Session interactive", "Deux heures à distance pour l’équipe."), ("Support de formation", "Méthode, exemples et exercices."), ("Fichiers pratiques", "Modèles et contrôles utilisés."), ("Production d’équipe", "Carte, diagnostic ou tableau selon le module."), ("Suivi court", "Questions pendant sept jours.")],
        "excluded": "Certification professionnelle, licence logicielle, développement complet d’un outil, support illimité ou traitement de données sensibles sans accord préalable.",
        "price": "249 USD", "price_note": "par atelier équipe", "price_copy": "Jusqu’à dix participants, deux heures en ligne et sept jours de suivi. Parcours multi-sessions : proposition distincte.",
        "why": [("Cas réel", "L’équipe pratique sur une décision concrète."), ("Méthode transmissible", "Supports et fichiers restent disponibles."), ("Langues adaptées", "Français, kreyòl ou anglais selon le groupe.")],
    },
    {
        "file": "activation-rapide-atmart.pdf",
        "title": "Activation rapide Atmart",
        "tag": "Préparer ou rétablir rapidement une lecture territoriale en situation d’urgence.",
        "promise": "Avant un cyclone ou après un choc, la vitesse ne doit pas effacer la preuve. L’activation assemble les données disponibles en <b>situation, priorités, lacunes et décisions documentées</b>.",
        "audience": "ONG, collectivités, réseaux et partenaires qui préparent une saison cyclonique ou doivent consolider rapidement l’information après une catastrophe.",
        "steps": [("Déclenchement", "Zone, événement, période, utilisateurs et décisions urgentes."), ("Assemblage", "Sources publiques et fichiers autorisés réunis dans un cadre commun."), ("Contrôle rapide", "Fraîcheur, couverture, contradictions et lacunes critiques."), ("Lecture opérationnelle", "Territoires prioritaires, accès, services et besoins d’information."), ("Mise à jour", "Révision convenue quand une nouvelle source fiable paraît.")],
        "deliver": [("Brief territorial", "Situation, chiffres clés et limites."), ("Carte opérationnelle", "Couches pertinentes et zones prioritaires."), ("Registre des sources", "Date, producteur et niveau de confiance."), ("Table des lacunes", "Informations absentes à collecter en priorité."), ("Restitution rapide", "Lecture commune avec l’équipe de réponse.")],
        "excluded": "Coordination humanitaire officielle, alerte météo, déploiement terrain, garantie en temps réel ou décision automatique d’allocation. Les sources incertaines restent qualifiées comme telles.",
        "price": "499 USD", "price_note": "par activation standard", "price_copy": "Un événement, un périmètre territorial et deux mises à jour sur sept jours. Extension ou permanence : devis séparé.",
        "why": [("Rapide et traçable", "Chaque chiffre garde sa source et son heure."), ("Lacunes visibles", "L’absence d’information devient une priorité."), ("Résultat d’intérêt général", "Les éléments publics financés restent accessibles.")],
    },
]


if __name__ == "__main__":
    for report in REPORTS:
        print(create_report(report))
