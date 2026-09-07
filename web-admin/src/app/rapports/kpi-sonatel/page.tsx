'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, StatCard, Modal, Input, Select, Textarea, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { kpiService, reportsService } from '@/services';
import {
  Target, RefreshCw, CheckCircle, XCircle, TrendingDown, Award, ShieldAlert, Wallet,
  FileDown, FileSpreadsheet, ChevronRight, ClipboardList, Info,
} from 'lucide-react';

const FAMILY_LABELS: Record<string, string> = {
  production: 'Production',
  autre_techno: 'Autres technos',
  constitutions: 'Constitutions',
  curative: 'Curative',
  preventif: 'Préventif',
  evenements: 'Événements',
  controle: 'Contrôle',
  plaintes: 'Plaintes',
  extensions: 'Ext. & densif.',
  stock: 'Stock',
  zone: 'Zone',
};

const SEGMENT_LABELS: Record<string, string> = {
  PRODUCTION_EM: 'Production EM (B2C)',
  PRODUCTION_HM_MM: 'Production HM/MM (B2C)',
  PRODUCTION_B2B: 'Production B2B',
  AUTRE_TECHNO: 'Autres technologies (5G, satellite…)',
  MAINTENANCE: 'Redevance maintenance',
  EXTENSION_LOT: 'PO lot extension',
  DENSIFICATION_LOT: 'PO lot densification',
};

const PLAN_STATUSES = [
  { value: 'ouvert', label: 'Ouvert' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'solde', label: 'Soldé' },
];

const fmt = (n: unknown) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtFCFA = (n: unknown) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : fmt(Math.round(Number(n))) + ' F');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [family, setFamily] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [tcoOpen, setTcoOpen] = useState(false);

  const { data: dash, loading, refetch } = useQuery(() => kpiService.dashboard(period), [period]);
  const { data: history } = useQuery(() => kpiService.history(), []);
  const { data: plans, refetch: refetchPlans } = useQuery(() => kpiService.masteryPlans(period), [period]);

  const recalcMut = useMutation(() => kpiService.recalculate(period), {
    onSuccess: () => { toast({ title: 'KPI recalculés', variant: 'success' }); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const exportMut = useMutation(
    async (kind: 'pdf' | 'excel') => {
      const blob = kind === 'pdf'
        ? await reportsService.exportPdf('kpi', { month: period })
        : await reportsService.exportExcel('kpi', { month: period });
      downloadBlob(blob, `rapport-optimax-${period}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`);
    },
    {
      onSuccess: () => toast({ title: 'Rapport Optimax exporté', variant: 'success' }),
      onError: (e: Error) => toast({ title: 'Export impossible', description: e.message, variant: 'error' }),
    },
  );

  const kpis = dash?.kpis ?? [];
  const families = dash?.families ?? [];
  const planByKpi = useMemo(() => new Map<string, any>((plans ?? []).map((p: any) => [p.kpiName as string, p])), [plans]);

  const filtered = family === 'all' ? kpis : kpis.filter((k: any) => k.family === family);
  const nonAtteints = kpis.filter((k: any) => k.status !== 'atteint');
  const capped = nonAtteints.some((k: any) => k.details?.capped);

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-16" />
      <Skeleton className="h-96" />
    </div>
  );

  if (!dash) return (
    <Card className="border-[#1e2e25] bg-[#111916]">
      <EmptyState icon={<Target size={40} className="text-[#7a8f80]/50" />} title="Aucune donnée KPI" description="Recalculez les KPI Optimax pour ce mois" action={
        <Button onClick={() => recalcMut.mutate()} loading={recalcMut.loading}>
          <RefreshCw size={16} /> Recalculer
        </Button>
      } />
    </Card>
  );

  const plafond = dash.plafond ?? {};
  const bonus = dash.bonus ?? {};
  const capPct = plafond.globalCap > 0 ? Math.min(100, (plafond.applique / plafond.globalCap) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9]">KPI SONATEL — Annexe Optimax</h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {dash.total} indicateurs contractuels · {families.length} familles · ICP-Pénalités juin 26
            {' · '}couverture registre {families.reduce((n: number, f: any) => n + (f.count ?? 0), 0)} / annexe Optimax
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
          <Button variant="outline" size="sm" onClick={() => setTcoOpen(true)}>
            <Wallet size={14} /> TCO du mois
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate('pdf')} loading={exportMut.loading}>
            <FileDown size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate('excel')} loading={exportMut.loading}>
            <FileSpreadsheet size={14} /> Excel
          </Button>
          <Button size="sm" onClick={() => recalcMut.mutate()} loading={recalcMut.loading}>
            <RefreshCw size={14} /> Recalculer
          </Button>
        </div>
      </div>

      {/* ── Synthèse ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Atteints" value={`${dash.atteints} / ${dash.total}`} icon={<CheckCircle size={18} />} variant="success" />
        <StatCard label="Non atteints" value={dash.nonAtteints} icon={<XCircle size={18} />} variant={dash.nonAtteints > 0 ? 'danger' : 'success'} />
        <StatCard label="Pénalités du mois" value={fmtFCFA(dash.penaltiesTotal)} icon={<TrendingDown size={18} />} variant={dash.penaltiesTotal > 0 ? 'warning' : 'success'} sublabel={capped ? 'plafonné à 20 %' : undefined} />
        <StatCard
          label="Bonus 3 mois consécutifs"
          value={bonus.eligible ? fmtFCFA(bonus.amount) : '—'}
          icon={<Award size={18} />}
          variant={bonus.eligible ? 'success' : 'default'}
          sublabel={bonus.eligible ? `${bonus.margePoints} pt de marge · cap ${fmt(bonus.plafond)} F` : 'non éligible ce mois'}
        />
      </div>

      {/* ── Bandeau plafond + bonus ── */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
                <ShieldAlert size={15} className={capped ? 'text-[#D9822B]' : 'text-[#7a8f80]'} /> Plafond des pénalités (hors TVA)
              </h3>
              {capped && <Badge variant="outline" className="bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30">plafond appliqué</Badge>}
            </div>
            <div className="space-y-2.5">
              <CapRow
                label="Production & SAV"
                applique={plafond.applique ?? 0}
                cap={plafond.globalCap ?? 0}
                base={plafond.baseProductionSav ?? 0}
              />
              <CapRow
                label="Lots extension & densification"
                applique={kpis.filter((k: any) => k.family === 'extensions').reduce((s: number, k: any) => s + Number(k.penaltyAmount), 0)}
                cap={plafond.extCap ?? 0}
                base={plafond.baseExtDensif ?? 0}
              />
            </div>
            <p className="text-[10px] text-[#7a8f80]/70 mt-2">Base = TCO du mois par segment (saisie manuelle prioritaire, sinon facture).</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-2 flex items-center gap-2">
              <Award size={15} className="text-[#0f9d70]" /> Détection bonus — 3 mois consécutifs
            </h3>
            <div className="flex gap-2">
              {(bonus.months ?? []).map((m: string) => (
                <div key={m} className="flex-1 p-2.5 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] text-center">
                  <p className="text-[10px] text-[#7a8f80]">{m}</p>
                  <p className="text-xs font-semibold text-[#e8ede9] mt-0.5">{dash.atteints === dash.total ? '100 % conformité' : `${nonAtteints.length} écart(s)`}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#7a8f80]/70 mt-2">
              Tous les KPI atteints 3 mois de suite → +1 M F par point de marge (plafond 5 M F).
            </p>
          </div>
        </div>
      </Card>

      {/* ── Filtres par famille ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <FamilyChip label="Tous" active={family === 'all'} onClick={() => setFamily('all')} atteints={dash.atteints} total={dash.total} />
        {families.map((f: any) => (
          <FamilyChip
            key={f.family}
            label={FAMILY_LABELS[f.family] ?? f.family}
            active={family === f.family}
            onClick={() => setFamily(f.family)}
            atteints={f.atteints}
            total={f.total}
          />
        ))}
      </div>

      {/* ── Liste des KPI ── */}
      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <div className="divide-y divide-[#1e2e25]/50">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-[#7a8f80]">Aucun indicateur dans cette famille pour {period}.</div>
          )}
          {filtered.map((k: any) => {
            const ok = k.status === 'atteint';
            const gap = Math.abs(Number(k.target) - Number(k.actual));
            const hasPenalty = Number(k.penaltyAmount) > 0;
            const hasPlan = planByKpi.has(k.kpiName);
            const pct = Math.min(100, (Number(k.actual) / Math.max(Number(k.target), 1)) * 100);
            return (
              <button
                key={k.kpiName}
                onClick={() => setSelected(k)}
                className="w-full text-left flex items-center justify-between gap-3 p-3.5 hover:bg-[#172019] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-[#0f9d70]' : gap > 5 ? 'bg-[#C0392B]' : 'bg-[#D9822B]'}`} />
                    <p className="text-sm text-[#e8ede9] truncate">{k.details?.label || k.kpiName}</p>
                    {!ok && hasPlan && (
                      <Badge variant="outline" className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">
                        <ClipboardList size={10} className="mr-1" /> plan {planByKpi.get(k.kpiName)?.status === 'solde' ? 'soldé' : 'engagé'}
                      </Badge>
                    )}
                    {k.details?.capped && <Badge variant="outline" className="bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30">plafonné</Badge>}
                  </div>
                  <p className="text-[10px] text-[#7a8f80]/60 mt-0.5 font-mono">{k.kpiName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ModeBadge mode={k.penaltyMode} />
                  {hasPenalty && (
                    <Badge variant="outline" className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30 tabular-nums">
                      -{fmt(k.penaltyAmount)} F
                    </Badge>
                  )}
                  <div className="text-right w-20">
                    <p className="text-sm font-semibold text-[#e8ede9] tabular-nums">
                      {Number(k.actual) > 0 || k.target === 0 ? fmt(k.actual) : fmt(k.actual)}
                      {!k.kpiName.startsWith('zone.') && !k.kpiName.startsWith('ext.') && <span className="text-[10px] text-[#7a8f80]"> %</span>}
                    </p>
                    <p className="text-[10px] text-[#7a8f80]">
                      {k.details?.direction === 'down' ? '≤' : '≥'} {fmt(k.target)}{!k.kpiName.startsWith('zone.') && !k.kpiName.startsWith('ext.') ? '%' : ''}
                    </p>
                  </div>
                  <div className="w-14 h-2 rounded-full bg-[#1a2420] overflow-hidden hidden sm:block">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${ok ? 'bg-[#0f9d70]' : pct > 60 ? 'bg-[#D9822B]' : 'bg-[#C0392B]'}`}
                      style={{ width: `${k.target === 0 ? (Number(k.actual) === 0 ? 100 : 15) : pct}%` }}
                    />
                  </div>
                  <ChevronRight size={14} className="text-[#7a8f80]/50" />
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Historique ── */}
      {history?.months?.length > 0 && (
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3">Historique</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {history.months.map((m: any) => {
              const total = m.atteints + m.nonAtteints;
              const rate = total > 0 ? Math.round((m.atteints / total) * 100) : 0;
              return (
                <div key={m.month} className="shrink-0 w-28 p-3 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] text-center">
                  <p className="text-xs text-[#7a8f80]">{m.month}</p>
                  <p className={`text-xl font-bold mt-1 ${rate >= 80 ? 'text-[#0f9d70]' : rate >= 50 ? 'text-[#D9822B]' : 'text-[#C0392B]'}`}>{rate}%</p>
                  <p className="text-[10px] text-[#7a8f80]/60 mt-0.5">{m.atteints}/{total}</p>
                  <p className="text-[10px] text-[#C0392B] mt-0.5">{fmtFCFA(m.penaltiesTotal)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <KpiDetailModal
        kpi={selected}
        period={period}
        plan={selected ? planByKpi.get(selected.kpiName) ?? null : null}
        onClose={() => setSelected(null)}
        onSaved={() => { refetchPlans(); refetch(); }}
      />
      <TcoModal open={tcoOpen} period={period} onClose={() => setTcoOpen(false)} onSaved={() => refetch()} />
    </div>
  );
}

// ═══════════════════════════════════════════
//  Sous-composants
// ═══════════════════════════════════════════
function CapRow({ label, applique, cap, base }: { label: string; applique: number; cap: number; base: number }) {
  const pct = cap > 0 ? Math.min(100, (applique / cap) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#e8ede9]">{label}</span>
        <span className="text-[#7a8f80] tabular-nums">
          {fmtFCFA(applique)} / cap {fmtFCFA(cap)} <span className="text-[#7a8f80]/60">(base {fmtFCFA(base)})</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#1a2420] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-[#D9822B]' : pct > 60 ? 'bg-[#f5a623]' : 'bg-[#0f9d70]'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

function FamilyChip({ label, active, onClick, atteints, total }: { label: string; active: boolean; onClick: () => void; atteints: number; total: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active ? 'bg-[#0f9d70] text-white border-[#0f9d70]' : 'bg-[#111916] text-[#7a8f80] border-[#1e2e25] hover:text-[#e8ede9] hover:border-[#0f9d70]/40'
      }`}
    >
      {label} <span className={active ? 'text-white/70' : 'text-[#0f9d70]'}>{atteints}</span><span className={active ? 'text-white/50' : 'text-[#7a8f80]/50'}>/{total}</span>
    </button>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'TCO') return <Badge variant="outline" className="bg-[#0f9d70]/10 text-[#7a8f80] border-[#1e2e25]">TCO</Badge>;
  if (mode === 'FORFAIT') return <Badge variant="outline" className="bg-[#0f9d70]/10 text-[#7a8f80] border-[#1e2e25]">forfait</Badge>;
  return <Badge variant="outline" className="bg-[#1a2420] text-[#7a8f80]/70 border-[#1e2e25]">suivi</Badge>;
}

function KpiDetailModal({ kpi, period, plan, onClose, onSaved }: {
  kpi: any; period: string; plan: any; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState(plan?.analysis ?? '');
  const [actions, setActions] = useState(plan?.actions ?? '');
  const [responsible, setResponsible] = useState(plan?.responsible ?? '');
  const [dueDate, setDueDate] = useState(plan?.dueDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(plan?.status ?? 'ouvert');

  const saveMut = useMutation(
    () => kpiService.putMasteryPlan(period, { kpiName: kpi.kpiName, analysis, actions, responsible, dueDate: dueDate || undefined, status }),
    {
      onSuccess: () => { toast({ title: 'Plan de maîtrise enregistré', variant: 'success' }); onSaved(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  if (!kpi) return null;
  const d = kpi.details ?? {};
  const metaKeys = new Set(['label', 'family', 'direction', 'formula', 'penaltyMode', 'penaltyLabel', 'tcoSegment', 'tco', 'units', 'capped', 'plafond']);
  const detailEntries = Object.entries(d).filter(([k]) => !metaKeys.has(k));
  const ok = kpi.status === 'atteint';

  return (
    <Modal open={!!kpi} onClose={onClose} title={d.label || kpi.kpiName} size="lg">
      <div className="space-y-4">
        {/* Valeurs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Objectif</p>
            <p className="text-lg font-bold text-[#e8ede9] tabular-nums">{d.direction === 'down' ? '≤ ' : '≥ '}{fmt(kpi.target)}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Réalisé</p>
            <p className={`text-lg font-bold tabular-nums ${ok ? 'text-[#0f9d70]' : 'text-[#C0392B]'}`}>{fmt(kpi.actual)}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Pénalité</p>
            <p className={`text-lg font-bold tabular-nums ${Number(kpi.penaltyAmount) > 0 ? 'text-[#C0392B]' : 'text-[#0f9d70]'}`}>{Number(kpi.penaltyAmount) > 0 ? `-${fmt(kpi.penaltyAmount)} F` : '0 F'}</p>
          </div>
        </div>

        {/* Formule + mode */}
        <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] space-y-2">
          <div className="flex gap-2 text-xs">
            <Info size={14} className="text-[#7a8f80] shrink-0 mt-0.5" />
            <p className="text-[#7a8f80]"><span className="text-[#e8ede9] font-medium">Formule :</span> {d.formula ?? '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModeBadge mode={kpi.penaltyMode} />
            {d.penaltyLabel && <span className="text-xs text-[#7a8f80]">{d.penaltyLabel}</span>}
          </div>
          {kpi.penaltyMode === 'TCO' && d.tcoSegment && (
            <p className="text-xs text-[#7a8f80]">TCO {SEGMENT_LABELS[d.tcoSegment] ?? d.tcoSegment} : <span className="text-[#e8ede9] tabular-nums">{fmtFCFA(d.tco)}</span></p>
          )}
          {Number(kpi.unitCount) > 0 && (
            <p className="text-xs text-[#7a8f80]">Unités sanctionnées : <span className="text-[#D9822B] font-semibold">{fmt(kpi.unitCount)}</span></p>
          )}
          {d.capped && <p className="text-xs text-[#D9822B]">Pénalité réduite par le plafond ({d.plafond}).</p>}
        </div>

        {/* Détail du calcul */}
        {detailEntries.length > 0 && (
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25]">
            <p className="text-xs font-semibold text-[#e8ede9] mb-2">Détail du calcul</p>
            <div className="grid grid-cols-2 gap-1.5">
              {detailEntries.map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-[#7a8f80]">{k.replace(/_/g, ' ')} : </span>
                  <span className="text-[#e8ede9]">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan de maîtrise */}
        <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#e8ede9] flex items-center gap-2">
              <ClipboardList size={14} className="text-[#0f9d70]" /> Plan de maîtrise
              {!ok && <span className="text-[10px] text-[#D9822B] font-normal">— obligatoire (contrat Optimax)</span>}
            </p>
            {plan && <Badge variant="outline" className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{plan.status}</Badge>}
          </div>
          <div className="space-y-2">
            <Textarea rows={2} placeholder="Analyse de la non-atteinte (causes racines)…" value={analysis} onChange={(e: any) => setAnalysis(e.target.value)} />
            <Textarea rows={2} placeholder="Actions correctives engagées…" value={actions} onChange={(e: any) => setActions(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Responsable" value={responsible} onChange={(e: any) => setResponsible(e.target.value)} />
              <Input type="date" value={dueDate} onChange={(e: any) => setDueDate(e.target.value)} />
              <Select value={status} onChange={(e: any) => setStatus(e.target.value)}>
                {PLAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => saveMut.mutate()} loading={saveMut.loading}>
                <ClipboardList size={14} /> Enregistrer le plan
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TcoModal({ open, period, onClose, onSaved }: { open: boolean; period: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { data, loading } = useQuery(() => kpiService.tco(period), [period, open]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const segments = data?.segments ?? [];
  const saveMut = useMutation(
    () => kpiService.putTco(
      period,
      segments
        .filter((s: any) => amounts[s.segment] !== undefined && amounts[s.segment] !== '')
        .map((s: any) => ({ segment: s.segment, amount: Number(amounts[s.segment]) })),
    ),
    {
      onSuccess: () => { toast({ title: 'TCO enregistré', description: 'Recalculez les KPI pour appliquer les nouveaux montants.', variant: 'success' }); onSaved(); onClose(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={`TCO du mois — ${period}`} size="lg">
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#7a8f80]">
            Montants HT par segment, base du calcul <span className="text-[#e8ede9]">(Objectif − taux) × TCO</span>.
            Sans saisie, le moteur utilise la facture du mois (production répartie au prorata des missions).
          </p>
          <div className="space-y-2">
            {segments.map((s: any) => (
              <div key={s.segment} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0a0f0d] border border-[#1e2e25]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#e8ede9] truncate">{SEGMENT_LABELS[s.segment] ?? s.segment}</p>
                  <p className="text-[10px] text-[#7a8f80]">
                    résolu : {fmtFCFA(s.resolved)} · source&nbsp;
                    <span className={s.source === 'saisie' ? 'text-[#0f9d70]' : s.source === 'facture' ? 'text-[#f5a623]' : 'text-[#7a8f80]/60'}>
                      {s.source === 'saisie' ? 'saisie manuelle' : s.source === 'facture' ? 'facture du mois' : 'aucune'}
                    </span>
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  placeholder={String(Math.round(s.resolved ?? 0))}
                  value={amounts[s.segment] ?? ''}
                  onChange={e => setAmounts(prev => ({ ...prev, [s.segment]: e.target.value }))}
                  className="w-40 h-9 px-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-sm text-[#e8ede9] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" onClick={() => saveMut.mutate()} loading={saveMut.loading}>
              <Wallet size={14} /> Enregistrer les montants saisis
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
