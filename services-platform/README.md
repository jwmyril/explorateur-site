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
npx wrangler d1 migrations apply atmart-explorateur-services-dev --local
npm test
npm run dev
```

## Routes initiales

| Méthode | Route | Accès | Fonction |
|---|---|---|---|
| GET | `/api/v1/health` | public | état du service |
| GET | `/api/v1/services` | public | frontière gratuit et payant |
| GET | `/api/v1/pricing` | public | tarifs proposés en USD |
| POST | `/api/v1/auth/request-link` | public | envoyer un lien de connexion par courriel |
| POST | `/api/v1/auth/verify` | public | échanger un lien à usage unique contre une session |
| POST | `/api/v1/scenarios/evaluate` | public | scénario non enregistré |
| POST | `/api/v1/audits/preview` | public | audit limité, sans conservation |
| POST | `/api/v1/billing/checkout` | connecté | obtenir le lien Payhip du service |
| POST | `/api/v1/payhip/webhook` | Payhip | activer ou retirer les droits après signature vérifiée |
| POST | `/api/v1/billing/stripe-checkout` | connecté | solution Stripe directe de repli |
| POST | `/api/v1/stripe/webhook` | Stripe | activer ou retirer les droits après signature vérifiée |
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
- Les liens de connexion expirent après 15 minutes et ne sont utilisables qu'une fois.
- Le paiement n'est pas simulé : un droit est activé seulement après un webhook Payhip ou Stripe signé.
- L'adresse utilisée lors du paiement Payhip doit être celle du compte Atmart connecté.
- Les événements Payhip sans utilisateur correspondant sont conservés comme `pending_user` sans ouvrir d'accès.

Le secret `PAYHIP_API_KEY` doit être ajouté avec `wrangler secret put PAYHIP_API_KEY`. Il ne doit jamais apparaître dans un fichier du dépôt ou dans une conversation. Chaque valeur publique `PAYHIP_PRODUCT_*` peut contenir l'identifiant numérique ou, de préférence, le code court situé après `/b/` dans le lien Payhip; `PAYHIP_URL_*` contient le lien complet correspondant.

Dans Payhip, configurer l'URL `/api/v1/payhip/webhook` dans **Settings → Developer** et activer `paid`, `refunded`, `subscription.created` et `subscription.deleted`. Stripe direct reste disponible comme solution de repli; ses secrets suivent la même règle.

## Avant le déploiement

Les ressources de développement existent dans Cloudflare : D1 `atmart-explorateur-services-dev` et R2 privé `atmart-explorateur-private-dev`. Il reste à restaurer l'authentification Wrangler, appliquer la migration distante, choisir l'authentification et le paiement, puis tester un Worker de préproduction. Ne pas utiliser ces ressources comme production.
