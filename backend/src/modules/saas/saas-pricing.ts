/** Grille tarifaire SaaS VECTRACOM (FCFA HT) — source : cahier des charges. */
export const SAAS_PLAN_CODES = ['MOBILE', 'WEB', 'RAG', 'GEOLOCATION'] as const;
export type SaasPlanCode = (typeof SAAS_PLAN_CODES)[number];

export const PLAN_PRICES: Record<SaasPlanCode, { monthly: number; annual: number; name: string; description: string }> = {
  MOBILE: { monthly: 10000, annual: 110000, name: 'Licence Mobile', description: 'Technicien terrain (application mobile)' },
  WEB: { monthly: 25000, annual: 275000, name: 'Licence Web', description: 'Admin, direction, magasinier (back-office)' },
  RAG: { monthly: 15000, annual: 165000, name: 'Dashboard RAG', description: 'Assistant IA conversationnel direction' },
  GEOLOCATION: { monthly: 5000, annual: 55000, name: 'Géolocalisation', description: 'Vue cartographique temps réel des équipes' },
};

export const SAAS_ADDON_TYPES = ['ia_vision', 'pre_audit', 'agent_planning', 'voice'] as const;
export type SaasAddonType = (typeof SAAS_ADDON_TYPES)[number];

export const ADDON_PRICES: Record<SaasAddonType, number> = {
  ia_vision: 50000,
  pre_audit: 20000,
  agent_planning: 30000,
  voice: 10000,
};

export const BASE_LIMITS = { maxPhotosPerMonth: 10000, maxIaRequestsPerMonth: 100, maxStorageGb: 10, maxApiRequestsPerDay: 500 };
export const PREMIUM_LIMITS = { maxPhotosPerMonth: 100000, maxIaRequestsPerMonth: 1000, maxStorageGb: 50, maxApiRequestsPerDay: 5000 };

export const OVERAGE_UNIT_PRICES = {
  photos: { unit: 10000, price: 5000 },     // 5 000 FCFA / 10 000 photos
  ia: { unit: 1, price: 500 },              // 500 FCFA / requête
  storage: { unit: 10, price: 10000 },      // 10 000 FCFA / 10 GB
  api: { unit: 1000, price: 1000 },         // 1 000 FCFA / 1 000 requêtes
} as const;

export const ONBOARDING_FEE = 350000;
export const ANNUAL_PLATFORM_FEE = 300000;
export const SAAS_TVA_RATE = 0.18;
