import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatFCFA(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toLocaleString('fr-FR')} FCFA`;
}

export function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    planifiee: 'info', en_cours: 'success', terminee: 'warning', validee: 'success',
    rejetee: 'danger', a_completer: 'warning', brouillon: 'neutral', en_correction: 'warning',
    finalisee: 'success', envoyee: 'info', signalement: 'danger', corrige: 'success',
    cloture: 'neutral', pending: 'warning', paid: 'success', overdue: 'danger',
    cancelled: 'neutral', active: 'success', suspended: 'danger', atteint: 'success',
    non_atteint: 'danger', ok: 'success', warning: 'warning', critical: 'danger',
    valide: 'success', incomplet: 'danger', en_attente: 'warning', a_corriger: 'warning',
    rejete: 'danger', CRITICAL: 'danger', MAJEUR: 'warning', MINEUR: 'info',
  };
  return map[status] ?? 'neutral';
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}
