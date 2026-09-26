export const INVOICE_STATUS_META: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  en_correction: { label: 'En correction', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  finalisee: { label: 'Émise', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  envoyee: { label: 'Envoyée', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  partiellement_payee: { label: 'Payée en partie', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
  payee: { label: 'Payée', cls: 'bg-[#0f9d70]/30 text-[#34d399] border-[#0f9d70]/40' },
  annulee: { label: 'Annulée', cls: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30' },
};

export const INVOICE_KIND_LABELS: Record<string, string> = {
  periodique: 'Missions',
  manuelle: 'Manuelle',
  avoir: 'Avoir',
};

export const INVOICE_CATEGORIES = ['PRODUCTION', 'SAV', 'TS', 'POI', 'INFRA', 'GC', 'AUTRE'];

export const PAYMENT_METHODS: Record<string, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  mobile_money: 'Mobile money',
  compensation: 'Compensation',
  autre: 'Autre',
};

export const EDITABLE_STATUSES = ['brouillon', 'en_correction'];

export function invoiceStatusMeta(status: string) {
  return INVOICE_STATUS_META[status] ?? { label: status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
}

export function fmtFCFA(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString('fr-FR') + ' FCFA' : '—';
}

export function fmtDay(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
