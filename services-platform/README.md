# Atmart Explorateur Services

Socle indépendant pour les quatre services payants associés à Explorateur Haïti. L'accès aux données publiques reste gratuit et ne nécessite aucun compte.

## Services

- Atmart Rapports : rapports personnalisés et commandes.
- Atmart Scénarios : modèles multicritères privés et reproductibles.
- Atmart Data Quality : audit des données appartenant au client.
- Atmart Instances : espaces privés et personnalisés pour les organisations.

Les routes publiques `/api/v1/services`, `/api/v1/scenarios/evaluate` et `/api/v1/audits/preview` démontrent la valeur sans facturer les données. La sauvegarde, la personnalisation et les espaces privés exigent une organisation authentifiée et un droit de service actif.

## Démarrage local

```powershell
npm install
npm run types
npx wrangler d1 migrations apply atmart-explorateur-services --local
npm test
npm run dev
```

## Routes initiales

| Méthode | Route | Accès | Fonction |
|---|---|---|---|
| GET | `/api/v1/health` | public | état du service |
| GET | `/api/v1/services` | public | frontière gratuit et payant |
| POST | `/api/v1/scenarios/evaluate` | public | scénario non enregistré |
| POST | `/api/v1/audits/preview` | public | audit limité, sans conservation |
| POST | `/api/v1/reports` | payant | créer une commande de rapport |
| POST | `/api/v1/scenarios` | payant | calculer et enregistrer un scénario |
| POST | `/api/v1/audits` | payant | exécuter et conserver un audit |
| POST | `/api/v1/instances` | payant | créer une instance privée |

## Sécurité

- Les jetons ne sont stockés qu'après hachage SHA-256.
- Aucun secret ne doit être écrit dans `wrangler.jsonc` ou dans le dépôt.
- Les données d'audit ont une date de suppression dès leur création.
- CORS autorise uniquement le domaine public et les serveurs locaux.
- Les réponses privées utilisent `Cache-Control: no-store`.
- Le paiement n'est pas simulé : un droit est activé seulement après confirmation vérifiée d'un fournisseur réel.

## Avant le déploiement

Créer les ressources D1 et R2, remplacer l'identifiant D1 local, générer les types, choisir l'authentification et le paiement, puis tester en environnement `staging`. Ne pas déployer la configuration actuelle en production.
