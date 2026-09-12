import type { ServiceId } from "./domain";

export interface PriceOffer {
  id: string;
  service: ServiceId;
  name: string;
  amountUsd: number;
  cadence: "once" | "month";
  stripePriceEnv: "STRIPE_PRICE_REPORTS" | "STRIPE_PRICE_SCENARIOS" | "STRIPE_PRICE_DATA_QUALITY" | "STRIPE_PRICE_INSTANCES";
  payhipProductEnv: "PAYHIP_PRODUCT_REPORTS" | "PAYHIP_PRODUCT_SCENARIOS" | "PAYHIP_PRODUCT_DATA_QUALITY" | "PAYHIP_PRODUCT_INSTANCES";
  payhipUrlEnv: "PAYHIP_URL_REPORTS" | "PAYHIP_URL_SCENARIOS" | "PAYHIP_URL_DATA_QUALITY" | "PAYHIP_URL_INSTANCES";
  includes: string[];
}

export const PRICE_OFFERS: PriceOffer[] = [
  {
    id: "reports-custom",
    service: "reports",
    name: "Rapport personnalisé",
    amountUsd: 149,
    cadence: "once",
    stripePriceEnv: "STRIPE_PRICE_REPORTS",
    payhipProductEnv: "PAYHIP_PRODUCT_REPORTS",
    payhipUrlEnv: "PAYHIP_URL_REPORTS",
    includes: ["Jusqu'à 5 territoires", "Choix des sections", "PDF personnalisé", "Fichiers de calcul et sources"],
  },
  {
    id: "scenarios-team",
    service: "scenarios",
    name: "Scénarios équipe",
    amountUsd: 99,
    cadence: "month",
    stripePriceEnv: "STRIPE_PRICE_SCENARIOS",
    payhipProductEnv: "PAYHIP_PRODUCT_SCENARIOS",
    payhipUrlEnv: "PAYHIP_URL_SCENARIOS",
    includes: ["Scénarios privés", "Pondérations enregistrées", "Analyse de sensibilité", "5 utilisateurs"],
  },
  {
    id: "data-quality-complete",
    service: "data_quality",
    name: "Audit qualité complet",
    amountUsd: 249,
    cadence: "once",
    stripePriceEnv: "STRIPE_PRICE_DATA_QUALITY",
    payhipProductEnv: "PAYHIP_PRODUCT_DATA_QUALITY",
    payhipUrlEnv: "PAYHIP_URL_DATA_QUALITY",
    includes: ["Audit automatisé", "Rapport d'anomalies", "Table de corrections", "Conservation maximale de 30 jours"],
  },
  {
    id: "instances-organization",
    service: "instances",
    name: "Instance organisation",
    amountUsd: 249,
    cadence: "month",
    stripePriceEnv: "STRIPE_PRICE_INSTANCES",
    payhipProductEnv: "PAYHIP_PRODUCT_INSTANCES",
    payhipUrlEnv: "PAYHIP_URL_INSTANCES",
    includes: ["Espace privé", "Rôles et utilisateurs", "Identité visuelle", "Support et mises à jour"],
  },
];

export function offerById(id: string): PriceOffer | undefined {
  return PRICE_OFFERS.find((offer) => offer.id === id);
}
