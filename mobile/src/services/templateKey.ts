/** Mappe typeTache / libellés SONATEL → typeName template API. */
const MISSION_TYPES = [
  'INSTALLATION',
  'SURVEY',
  'SAV',
  'INFRA',
  'OSM',
  'GC',
  'PLANTATION',
  'DEVOIEMENT',
  'DEPLOIEMENT',
  'DENSIFICATION',
  'SURVEY_OSM',
] as const;

export type TemplateKey = (typeof MISSION_TYPES)[number];

const ALIASES: Array<{ re: RegExp; key: TemplateKey }> = [
  { re: /densif/i, key: 'DENSIFICATION' },
  { re: /d[ée]ploi/i, key: 'DEPLOIEMENT' },
  { re: /d[ée]voi/i, key: 'DEVOIEMENT' },
  { re: /survey.?osm|osm.?survey/i, key: 'SURVEY_OSM' },
  { re: /\bosm\b/i, key: 'OSM' },
  { re: /survey|reconnaissance|pr[ée].?install/i, key: 'SURVEY' },
  { re: /\bsav\b|d[ée]pannage|curatif/i, key: 'SAV' },
  { re: /\bgc\b|g[ée]nie.?civil/i, key: 'GC' },
  { re: /plant/i, key: 'PLANTATION' },
  { re: /infra|r[ée]seau|pbo|fibre.?infra/i, key: 'INFRA' },
  { re: /install|raccord|branchement|ftth|client/i, key: 'INSTALLATION' },
];

export function resolveTemplateKey(typeTache?: string | null, fallback: TemplateKey = 'INSTALLATION'): TemplateKey {
  const raw = (typeTache ?? '').trim();
  if (!raw) return fallback;
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  if ((MISSION_TYPES as readonly string[]).includes(upper)) return upper as TemplateKey;
  for (const a of ALIASES) {
    if (a.re.test(raw)) return a.key;
  }
  return fallback;
}
