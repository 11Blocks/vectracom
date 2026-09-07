'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, useToast } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { reportsService } from '@/services';
import {
  FileText, FileDown, FileSpreadsheet, Loader2, TrendingUp, MapPin, Package, AlertTriangle,
  Target, BarChart3, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const PIE_COLORS = ['#0f9d70', '#C0392B', '#f5a623', '#5b8def', '#D9822B', '#7a8f80'];

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtNum(n: any) { return n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'); }

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const tooltipStyle = {
  contentStyle: { background: '#111916', border: '1px solid #1e2e25', borderRadius: '0.5rem', fontSize: 12 },
  labelStyle: { color: '#e8ede9' }, itemStyle: { color: '#e8ede9' },
};
const axisProps = { tick: { fill: '#7a8f80', fontSize: 11 }, axisLine: { stroke: '#1e2e25' }, tickLine: false as const };

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { startDate, endDate } = monthRange(month);

  const { data: perf, loading: l1 } = useQuery(() => reportsService.performance(startDate, endDate), [startDate, endDate]);
  const { data: olt, loading: l2 } = useQuery(() => reportsService.olt(startDate, endDate), [startDate, endDate]);
  const { data: sv, loading: l3 } = useQuery(() => reportsService.stockVehicles(startDate, endDate), [startDate, endDate]);
  const { data: inc, loading: l4 } = useQuery(() => reportsService.incidents(startDate, endDate), [startDate, endDate]);

  const [exporting, setExporting] = useState<string | null>(null);

  const doExport = async (report: string, kind: 'pdf' | 'excel') => {
    setExporting(`${report}-${kind}`);
    try {
      const blob = kind === 'pdf'
        ? await reportsService.exportPdf(report, { startDate, endDate, month })
        : await reportsService.exportExcel(report, { startDate, endDate, month });
      downloadBlob(blob, `rapport-${report}-${month}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast({ title: kind === 'pdf' ? 'PDF généré' : 'Excel généré', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const ExportButtons = ({ report }: { report: string }) => (
    <div className="flex gap-1.5">
      <Button size="sm" variant="secondary" disabled={exporting !== null} onClick={() => doExport(report, 'pdf')} title="Export PDF">
        {exporting === `${report}-pdf` ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} PDF
      </Button>
      <Button size="sm" variant="secondary" disabled={exporting !== null} onClick={() => doExport(report, 'excel')} title="Export Excel">
        {exporting === `${report}-excel` ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
      </Button>
    </div>
  );

  const loading = l1 || l2 || l3;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><FileText size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Rapports</h1>
            <p className="text-xs text-[#7a8f80]">5 rapports prédéfinis — exports 1-clic pour les réunions SONATEL</p>
          </div>
        </div>
        <input
          type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ═══ Rapport 1 : Performance missions & techniciens ═══ */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><TrendingUp size={15} className="text-[#0f9d70]" /> Performance missions & techniciens</h3>
                <p className="text-xs text-[#7a8f80] mt-0.5">Taux OK/NOK, classement techniciens, top motifs d'échec</p>
              </div>
              <ExportButtons report="performance" />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                ['Total', perf?.totalMissions ?? 0], ['Clôturées', perf?.closedMissions ?? 0],
                ['OK', perf?.ok ?? 0], ['NOK', perf?.nok ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2 text-center">
                  <p className="text-[10px] text-[#7a8f80]">{k}</p>
                  <p className="text-lg font-bold text-[#e8ede9]">{v as number}</p>
                </div>
              ))}
            </div>
            {(perf?.byTechnician ?? []).length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(perf?.byTechnician ?? []).slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
                    <XAxis dataKey="fullName" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} width={26} />
                    <Tooltip cursor={{ fill: 'rgba(15,157,112,0.06)' }} {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ok" name="OK" stackId="a" fill="#0f9d70" radius={[0, 0, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="nok" name="NOK" stackId="a" fill="#C0392B" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-[#7a8f80] py-8 text-center">Aucune mission clôturée sur la période</p>}
            {(perf?.topFailureReasons ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-[#7a8f80] uppercase tracking-wide">Top motifs d'échec</p>
                {(perf?.topFailureReasons ?? []).map((r: any) => (
                  <div key={r.reason} className="flex items-center justify-between text-xs">
                    <span className="text-[#e8ede9] truncate">{r.reason}</span>
                    <Badge className="bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30">{r.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ═══ Rapport 2 : Activité par zone OLT ═══ */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><MapPin size={15} className="text-[#0f9d70]" /> Activité par zone SONATEL (OLT)</h3>
                <p className="text-xs text-[#7a8f80] mt-0.5">Répartition des interventions par zone technique</p>
              </div>
              <ExportButtons report="olt" />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                ['Reçus', olt?.total ?? 0], ['Exécutés', olt?.executees ?? 0],
                ['En attente', olt?.enAttente ?? 0], ['Réussite', olt?.successRate !== null && olt?.successRate !== undefined ? `${olt.successRate}%` : '—'],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2 text-center">
                  <p className="text-[10px] text-[#7a8f80]">{k}</p>
                  <p className="text-lg font-bold text-[#e8ede9]">{v as any}</p>
                </div>
              ))}
            </div>
            {(olt?.byZone ?? []).length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(olt?.byZone ?? []).slice(0, 7)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
                    <XAxis dataKey="zone" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} width={26} />
                    <Tooltip cursor={{ fill: 'rgba(15,157,112,0.06)' }} {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="recues" name="Reçus" fill="#5b8def" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="executees" name="Exécutés" fill="#0f9d70" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="enAttente" name="En attente" fill="#f5a623" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-[#7a8f80] py-8 text-center">Aucune mission sur la période</p>}
          </Card>

          {/* ═══ Rapport 3 : Usage stock & véhicules ═══ */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><Package size={15} className="text-[#0f9d70]" /> Usage stock & véhicules</h3>
                <p className="text-xs text-[#7a8f80] mt-0.5">Consommation vs installations, coûts carburant</p>
              </div>
              <ExportButtons report="stock-vehicles" />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ['Consommé', sv?.totalConsumed ?? 0],
                ['Installations validées', sv?.installationsValidees ?? 0],
                ['Coût transport', `${fmtNum(sv?.coutTransportTotal)} F`],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2 text-center">
                  <p className="text-[10px] text-[#7a8f80]">{k}</p>
                  <p className="text-base font-bold text-[#e8ede9]">{v as any}</p>
                </div>
              ))}
            </div>
            {(sv?.consumption ?? []).length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(sv?.consumption ?? []).slice(0, 7)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
                    <XAxis dataKey="reference" {...axisProps} />
                    <YAxis {...axisProps} width={30} />
                    <Tooltip cursor={{ fill: 'rgba(15,157,112,0.06)' }} {...tooltipStyle} />
                    <Bar dataKey="quantity" name="Consommé" fill="#0f9d70" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-[#7a8f80] py-6 text-center">Aucune consommation sur la période</p>}
            {(sv?.vehicleCosts ?? []).some((v: any) => v.coutTransport > 0) && (
              <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                {(sv?.vehicleCosts ?? []).filter((v: any) => v.coutTransport > 0).map((v: any) => (
                  <div key={v.vehicleId} className="flex items-center justify-between text-xs">
                    <span className="text-[#e8ede9]">{v.immatriculation}{v.modele ? ` · ${v.modele}` : ''}</span>
                    <span className="text-[#D9822B] font-semibold">{fmtNum(v.coutTransport)} FCFA</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ═══ Rapport 4 : Incidents ═══ */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><AlertTriangle size={15} className="text-[#D9822B]" /> Rapport Incidents</h3>
                <p className="text-xs text-[#7a8f80] mt-0.5">Statistiques PIO/PBO/Chambre, délais de correction</p>
              </div>
              <ExportButtons report="incidents" />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ['Incidents', inc?.total ?? 0],
                ['Délai moyen', inc?.averageResolutionTimeHours !== null && inc?.averageResolutionTimeHours !== undefined ? `${inc.averageResolutionTimeHours} h` : '—'],
                ['Rubriques', (inc?.byRubrique ?? []).length],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2 text-center">
                  <p className="text-[10px] text-[#7a8f80]">{k}</p>
                  <p className="text-base font-bold text-[#e8ede9]">{v as any}</p>
                </div>
              ))}
            </div>
            {(inc?.byRubrique ?? []).length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={inc?.byRubrique ?? []} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={70} label={{ fill: '#7a8f80', fontSize: 11 }}>
                      {(inc?.byRubrique ?? []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs text-[#7a8f80] py-6 text-center">{inc?.note ?? 'Aucun incident sur la période'}</p>}
          </Card>

          {/* ═══ Rapport 5 : KPI SONATEL (renvoi) ═══ */}
          <Card className="border-[#0f9d70]/30 bg-[#111916] p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-[#0f9d70]/15 text-[#0f9d70]"><Target size={20} /></span>
                <div>
                  <h3 className="text-sm font-semibold text-[#e8ede9]">Rapport KPI SONATEL</h3>
                  <p className="text-xs text-[#7a8f80] mt-0.5">Tous les indicateurs contractuels — statuts vert/orange/rouge, détail des non-atteints, pénalités, historique 12 mois. Export PDF (SONATEL) et Excel (interne) depuis la page dédiée.</p>
                </div>
              </div>
              <Link href="/rapports/kpi-sonatel">
                <Button><BarChart3 size={15} /> Ouvrir le dashboard KPI <ArrowRight size={14} /></Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
