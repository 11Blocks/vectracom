/**
 * Métadonnées partagées Missions / Planning — harmonie de la palette VECTRACOM :
 * mint système #0f9d70, bleu #5b8def, orange #D9822B, rouge #C0392B,
 * ambre #f5a623 réservé à l'IA uniquement.
 */

export const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  planifiee: { label: 'Planifiée', cls: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30', dot: '#5b8def' },
  en_cours: { label: 'En cours', cls: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30', dot: '#0f9d70' },
  terminee: { label: 'Terminée', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', dot: '#D9822B' },
  validee: { label: 'Validée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/40', dot: '#0f9d70' },
  rejetee: { label: 'Rejetée', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30', dot: '#C0392B' },
  a_completer: { label: 'À compléter', cls: 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30', dot: '#f5a623' },
  annulee: { label: 'Annulée', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: '#64748b' },
};

/** Couleur par type de tâche — repère visuel instantané dans les tableaux. */
export const TYPE_META: Record<string, { cls: string; dot: string }> = {
  INSTALLATION: { cls: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30', dot: '#0f9d70' },
  SAV: { cls: 'bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30', dot: '#D9822B' },
  SURVEY: { cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: '#a78bfa' },
  SURVEY_OSM: { cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: '#a78bfa' },
  INFRA: { cls: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30', dot: '#C0392B' },
  OSM: { cls: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30', dot: '#5b8def' },
  GC: { cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', dot: '#22d3ee' },
  PLANTATION: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: '#34d399' },
  DEVOIEMENT: { cls: 'bg-slate-400/15 text-slate-300 border-slate-400/30', dot: '#94a3b8' },
  DEPLOIEMENT: { cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', dot: '#818cf8' },
  DENSIFICATION: { cls: 'bg-teal-500/15 text-teal-300 border-teal-500/30', dot: '#2dd4bf' },
};

export function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', dot: '#7a8f80' };
}

export function typeMeta(type: string) {
  return TYPE_META[type] ?? { cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', dot: '#7a8f80' };
}
