/**
 * Design tokens — miroir web-admin `globals.css` / Guide Frontend v1.0.
 *
 * RÈGLE : les écrans (`src/screens/**`) n’utilisent PAS de hex / rgba bruts.
 * Passer par `colors`, `statusColors`, `radius`, `spacing`, `typography`.
 * Les opacités dérivées vivent ici (surfaces soft / overlays).
 */
export const colors = {
  bg: '#0a0f0d',
  card: '#111916',
  cardAlt: '#1a2420',
  /** Hover / pressed surface (web --accent). */
  accent: '#172019',
  border: '#1e2e25',
  text: '#e8ede9',
  muted: '#7a8f80',
  primary: '#0f9d70',
  primaryHover: '#0d8a62',
  danger: '#C0392B',
  dangerHover: '#a93226',
  warning: '#D9822B',
  amber: '#f5a623',
  amberHover: '#d9911f',
  info: '#5b8def',
  purple: '#a78bfa',
  white: '#ffffff',
  black: '#000000',
  sidebar: '#0d1210',
  sidebarFg: '#c5d1c8',
  focusRing: 'rgba(15,157,112,0.5)',
  aiSurface: 'rgba(245,166,35,0.06)',
  aiBorder: 'rgba(245,166,35,0.4)',
  /** Surfaces dérivées (wells, errors, chat). */
  primarySoft12: 'rgba(15,157,112,0.12)',
  primarySoft15: 'rgba(15,157,112,0.15)',
  primarySoft18: 'rgba(15,157,112,0.18)',
  primarySoft25: 'rgba(15,157,112,0.25)',
  primarySoft35: 'rgba(15,157,112,0.35)',
  primarySoft40: 'rgba(15,157,112,0.40)',
  primaryBorder25: 'rgba(15,157,112,0.25)',
  dangerSoft12: 'rgba(192,57,43,0.12)',
  dangerSoft35: 'rgba(192,57,43,0.35)',
  dangerSoft50: 'rgba(192,57,43,0.50)',
  warningSoft50: 'rgba(217,130,43,0.50)',
  textFaint: 'rgba(232,237,233,0.5)',
  mutedFaint: 'rgba(122,143,128,0.7)',
  inputBg: 'rgba(10,15,13,0.6)',
  inputBgStrong: 'rgba(10,15,13,0.85)',
  overlay: 'rgba(0,0,0,0.7)',
  overlaySoft: 'rgba(0,0,0,0.45)',
  whiteSoft06: 'rgba(255,255,255,0.06)',
  /** WhatsApp Remontée (chat ingress). */
  waSoft12: 'rgba(37,211,102,0.12)',
  waBorder45: 'rgba(37,211,102,0.45)',
  interactiveBorder: 'rgba(15,157,112,0.30)',
} as const;

/** Canon web --radius = 0.625rem (10px). */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const motion = {
  toastMs: 220,
  modalMs: 180,
  pressScale: 0.98,
} as const;

export const typography = {
  xs: { fontSize: 10, fontWeight: '500' as const },
  sm: { fontSize: 12, fontWeight: '500' as const },
  base: { fontSize: 14, fontWeight: '400' as const },
  md: { fontSize: 14, fontWeight: '600' as const },
  lg: { fontSize: 16, fontWeight: '600' as const },
  xl: { fontSize: 20, fontWeight: '700' as const },
  mono: { fontFamily: 'monospace' as const, fontSize: 12, fontWeight: '500' as const },
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ai' | 'purple';

/** Badge / chip fills — opacity /20 alignée web. */
export const statusColors: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  success: { bg: 'rgba(15,157,112,0.20)', fg: colors.primary, border: 'rgba(15,157,112,0.3)' },
  warning: { bg: 'rgba(217,130,43,0.20)', fg: colors.warning, border: 'rgba(217,130,43,0.3)' },
  danger: { bg: 'rgba(192,57,43,0.20)', fg: colors.danger, border: 'rgba(192,57,43,0.3)' },
  info: { bg: 'rgba(91,141,239,0.20)', fg: colors.info, border: 'rgba(91,141,239,0.3)' },
  neutral: { bg: colors.cardAlt, fg: colors.muted, border: colors.border },
  ai: { bg: 'rgba(245,166,35,0.20)', fg: colors.amber, border: 'rgba(245,166,35,0.3)' },
  purple: { bg: 'rgba(167,139,250,0.20)', fg: colors.purple, border: 'rgba(167,139,250,0.3)' },
};

/** Map mission / stock status strings → Badge tone (miroir web statusVariant). */
export function statusTone(status?: string | null): StatusTone {
  const s = (status || '').toLowerCase();
  if (['terminee', 'termine', 'valide', 'approuve', 'ok', 'disponible', 'synced', 'success'].includes(s)) {
    return 'success';
  }
  if (['en_cours', 'planifiee', 'en_attente', 'pending', 'a_completer', 'warning'].includes(s)) {
    return 'warning';
  }
  if (['refuse', 'annulee', 'echec', 'failed', 'dead', 'danger', 'defectueux'].includes(s)) {
    return 'danger';
  }
  if (['signalement', 'info', 'draft'].includes(s)) return 'info';
  if (s.includes('ia') || s.includes('ai')) return 'ai';
  return 'neutral';
}

export { colors as default };
