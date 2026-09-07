/** Clés des 13 sections — Module Paramètres VECTRACOM (doc 4 sept). */
export const SETTINGS_SECTIONS = [
  'general',
  'users',
  'missions',
  'stock',
  'vehicles',
  'kpi',
  'billing',
  'notifications',
  'incidents',
  'reports',
  'integrations',
  'security',
  'advanced',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'Informations générales',
  users: 'Utilisateurs & Permissions',
  missions: 'Missions & Formulaires',
  stock: 'Stock & Articles',
  vehicles: 'Véhicules',
  kpi: 'KPI SONATEL',
  billing: 'Facturation',
  notifications: 'Notifications',
  incidents: 'Incidents & IA Vision',
  reports: 'Rapports',
  integrations: 'Intégrations',
  security: 'Sécurité & Conformité',
  advanced: 'Avancé',
};

/** Valeurs d'usine — enrichissement, ne remplace pas les modules métier. */
export function defaultSettings(): Record<SettingsSection, Record<string, unknown>> {
  return {
    general: {
      companyName: '',
      logoUrl: '',
      primaryColor: '#0f9d70',
      timezone: 'Africa/Dakar',
      currency: 'FCFA',
      language: 'fr',
    },
    missions: {
      enabledTypes: [
        'INSTALLATION', 'DENSIFICATION', 'DEPLOIEMENT', 'SURVEY', 'SURVEY_OSM',
        'SAV', 'INFRA', 'OSM', 'GC', 'PLANTATION', 'DEVOIEMENT',
      ],
      validationWorkflow: 'interne_sonatel',
      manageHint: '/parametres/formulaires',
    },
    stock: {
      defaultAlertThreshold: 10,
      units: ['unité', 'mètre', 'kg', 'litre', 'paire', 'carton'],
      barcodeScanEnabled: true,
      manageHint: '/stock',
    },
    vehicles: {
      thresholdOrangeDays: 30,
      thresholdRedDays: 7,
      documentTypes: ['carte_grise', 'assurance', 'visite_technique'],
      manageHint: '/vehicles',
    },
    kpi: {
      alertGapPercent: 5,
      bonusConsecutiveMonths: 3,
      bonusAmountFcfa: 1000000,
      manageHint: '/rapports/kpi-sonatel',
    },
    billing: {
      tvaRate: 0.18,
      paymentTermsDays: 30,
      invoiceNumberFormat: 'FACT-{YYYY}-{####}',
      invoiceTemplate: 'standard',
      manageHint: '/invoices',
    },
    notifications: {
      manageHint: '/notifications',
      syncWithNotificationSettings: true,
      soundEnabled: true,
      smsEnabled: false,
      smsProvider: '',
    },
    incidents: {
      rubriques: ['PBO', 'PIO', 'CHAMBRE'],
      severities: ['CRITICAL', 'MAJEUR', 'MINEUR', 'INFORMATION'],
      workflow: 'ia_humain_validation',
      manageHint: '/incidents',
    },
    reports: {
      enabledIndicators: ['performance', 'kpi', 'stock', 'incidents', 'olt'],
      autoRecipients: [] as string[],
      manageHint: '/rapports',
    },
    integrations: {
      whatsappBusinessId: '',
      whatsappEnabled: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpFrom: '',
      geminiConfigured: false,
      webhookUrl: '',
    },
    security: {
      sessionDays: 7,
      auditRetentionMonths: 12,
      backupFrequency: 'daily',
      complianceFlags: ['SONATEL'],
      manageHint: '/parametres/permissions',
    },
    users: {
      customRoles: [] as string[],
      passwordMinLength: 8,
      passwordRequireUpper: true,
      passwordRequireDigit: true,
      passwordExpiryDays: 90,
      manageHint: '/parametres/permissions',
    },
    advanced: {
      allowReset: false,
      lastExportAt: null,
    },
  };
}
