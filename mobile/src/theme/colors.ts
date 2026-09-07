/** Design tokens — miroir web-admin VECTRACOM (ui/index.tsx). */
export const colors = {
  bg: '#0a0f0d',
  card: '#111916',
  cardAlt: '#1a2420',
  border: '#1e2e25',
  text: '#e8ede9',
  muted: '#7a8f80',
  primary: '#0f9d70',
  primaryHover: '#0d8a62',
  danger: '#C0392B',
  warning: '#D9822B',
  amber: '#f5a623',
  info: '#5b8def',
  white: '#ffffff',
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const statusColors: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  success: { bg: 'rgba(15,157,112,0.15)', fg: colors.primary, border: 'rgba(15,157,112,0.3)' },
  warning: { bg: 'rgba(217,130,43,0.15)', fg: colors.warning, border: 'rgba(217,130,43,0.3)' },
  danger: { bg: 'rgba(192,57,43,0.15)', fg: colors.danger, border: 'rgba(192,57,43,0.3)' },
  info: { bg: 'rgba(91,141,239,0.15)', fg: colors.info, border: 'rgba(91,141,239,0.3)' },
  neutral: { bg: colors.cardAlt, fg: colors.muted, border: colors.border },
};
