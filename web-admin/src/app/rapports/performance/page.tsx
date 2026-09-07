'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { performanceService } from '@/services';
import {
  TrendingUp, Users, MapPin, AlertTriangle, Upload, Loader2, BarChart3, Sparkles, Download, ListChecks,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  ComposedChart, Line, CartesianGrid,
} from 'recharts';

function currentIsoWeek(): number {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'equipes' | 'olt' | 'motifs' | 'taches'>('equipes');
  const [mode, setMode] = useState<'week' | 'range'>('week');
  const [week, setWeek] = useState(30); // défaut S30 (dernier fichier reçu)
  const [year, setYear] = useState(2026);
  const [from, setFrom] = useState('2026-07-20');
  const [to, setTo] = useState('2026-07-26');
  const [exporting, setExporting] = useState(false);

  const queryOpts = mode === 'week' ? { week, year } : { from, to };

  const { data: dash, loading, refetch } = useQuery(
    () => performanceService.dashboard(queryOpts),
    [mode, week, year, from, to],
  );
  const { data: trend } = useQuery(() => performanceService.trend(6), []);
  const { data: interpret } = useQuery(
    () => performanceService.interpret(queryOpts),
    [mode, week, year, from, to],
  );

  const importMut = useMutation((file: File) => performanceService.importDaily(file), {
    onSuccess: (res: any) => {
      toast({ title: `DAILY importé : ${res.created} créée(s), ${res.updated} màj`, variant: 'success' });
      refetch();
    },
    onError: (e: Error) => toast({ title: 'Import impossible', description: e.message, variant: 'error' }),
  });

  const onFile = (file?: File) => { if (file) importMut.mutate(file); };

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await performanceService.exportExcel(queryOpts);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dashboard_Performance_S${mode === 'week' ? week : dash?.week ?? 'x'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export Excel ONECOMIT téléchargé', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e?.message, variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const summary = dash?.summary ?? { totalCas: 0, totalOk: 0, totalNok: 0, taux: 0 };
  const teams = dash?.teams ?? [];
  const olts = dash?.olts ?? [];
  const motifs = dash?.nokMotifs ?? [];
  const taches = dash?.tachesEffectuees ?? [];

  const teamChart = useMemo(
    () => teams.slice(0, 20).map((t: any) => ({
      name: String(t.equipe).split(' ').slice(0, 2).join(' '),
      full: t.equipe,
      cas: t.cas,
      ok: t.ok,
      nok: t.nok,
      taux: t.taux,
    })),
    [teams],
  );

  const oltChart = useMemo(
    () => olts.map((o: any) => ({
      name: o.olt,
      cas: o.cas,
      ok: o.ok,
      nok: o.nok,
      taux: o.taux,
    })),
    [olts],
  );

  const weekPresets = [27, 28, 29, 30, currentIsoWeek()].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <BarChart3 size={20} className="text-[#0f9d70]" /> Performance
            {dash?.week != null && <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">S{dash.week}</Badge>}
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            Format Dashboard_Performance S27→S30 — équipes · OLT · motifs COMMENTAIRES
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1">
            <button onClick={() => setMode('week')}
              className={'px-2.5 py-1 text-xs rounded-md ' + (mode === 'week' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80]')}>
              Semaine ISO
            </button>
            <button onClick={() => setMode('range')}
              className={'px-2.5 py-1 text-xs rounded-md ' + (mode === 'range' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80]')}>
              Période
            </button>
          </div>
          {mode === 'week' ? (
            <>
              <select value={week} onChange={(e) => setWeek(Number(e.target.value))}
                className="h-9 px-2 rounded-lg border border-[#1e2e25] bg-[#111916] text-xs text-[#e8ede9]">
                {weekPresets.map((w) => <option key={w} value={w}>S{w}</option>)}
                {Array.from({ length: 52 }, (_, i) => i + 1)
                  .filter((w) => !weekPresets.includes(w))
                  .map((w) => <option key={w} value={w}>S{w}</option>)}
              </select>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 w-20 px-2 rounded-lg border border-[#1e2e25] bg-[#111916] text-xs text-[#e8ede9]" />
            </>
          ) : (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-9 px-2 rounded-lg border border-[#1e2e25] bg-[#111916] text-xs text-[#e8ede9]" />
              <span className="text-[#7a8f80] text-xs">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="h-9 px-2 rounded-lg border border-[#1e2e25] bg-[#111916] text-xs text-[#e8ede9]" />
            </>
          )}
          <Button variant="outline" size="sm" onClick={onExport} disabled={exporting}
            className="h-9 gap-1.5 text-xs border-[#1e2e25]">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export Excel
          </Button>
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#1e2e25] bg-[#111916] text-sm text-[#e8ede9] cursor-pointer hover:border-[#0f9d70]/40 transition-colors">
            {importMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importer DAILY
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Demandes traitées</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{summary.totalCas}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#0f9d70]/30 text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Installés (OK)</p>
          <p className="text-2xl font-bold text-[#0f9d70]">{summary.totalOk}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#C0392B]/30 text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Non installés (NOK)</p>
          <p className="text-2xl font-bold text-[#C0392B]">{summary.totalNok}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Taux OK</p>
          <p className="text-2xl font-bold text-[#f5a623]">{summary.taux} %</p>
        </div>
      </div>

      {interpret?.bullets?.length > 0 && (
        <Card className="border-[#f5a623]/35 bg-[#f5a623]/8 p-4">
          <h3 className="text-sm font-semibold text-[#f5a623] mb-2 flex items-center gap-2">
            <Sparkles size={15} /> Interprétation IA
          </h3>
          <ul className="space-y-1.5 mb-2">
            {interpret.bullets.map((b: string, i: number) => (
              <li key={i} className="text-xs text-[#e8ede9]/90 leading-relaxed">• {b}</li>
            ))}
          </ul>
          <p className="text-[10px] text-[#f5a623]/70 italic">{interpret.disclaimer}</p>
        </Card>
      )}

      {trend?.weeks?.length > 0 && (
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#0f9d70]" /> Tendance hebdomadaire (taux OK %)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend.weeks}>
                <XAxis dataKey="week" stroke="#7a8f80" fontSize={11} />
                <YAxis stroke="#7a8f80" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#0a0f0d', border: '1px solid #1e2e25', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: any) => [name === 'taux' ? `${v} %` : v, name === 'taux' ? 'Taux OK' : name]}
                />
                <Bar dataKey="taux" radius={[4, 4, 0, 0]}>
                  {(trend.weeks as any[]).map((w, i) => (
                    <Cell key={i} fill={w.taux >= 60 ? '#0f9d70' : w.taux >= 45 ? '#f5a623' : '#C0392B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="flex gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1 w-fit flex-wrap">
        {[
          { v: 'equipes', label: `Par équipe (${teams.length})`, icon: Users },
          { v: 'olt', label: `Par OLT (${olts.length})`, icon: MapPin },
          { v: 'motifs', label: 'Motifs NOK', icon: AlertTriangle },
          { v: 'taches', label: 'Tâches effectuées', icon: ListChecks },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ' + (tab === t.v ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <Skeleton className="h-64" /> : tab === 'equipes' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-[#7a8f80] bg-[#0a0f0d] grid grid-cols-[2fr_4rem_4rem_4rem_5rem] gap-2">
              <span>Équipe</span><span className="text-right">Cas</span><span className="text-right">OK</span><span className="text-right">NOK</span><span className="text-right">Taux</span>
            </div>
            <div className="divide-y divide-[#1e2e25]/50 max-h-[480px] overflow-y-auto">
              {teams.length === 0 && <p className="p-6 text-center text-xs text-[#7a8f80]/70">Aucune donnée — importez un Dashboard_Performance (feuille DAILY).</p>}
              {teams.map((t: any) => (
                <div key={t.equipe} className="px-4 py-2.5 grid grid-cols-[2fr_4rem_4rem_4rem_5rem] gap-2 items-center hover:bg-[#172019] transition-colors">
                  <span className="text-sm text-[#e8ede9] truncate">{t.equipe}</span>
                  <span className="text-sm text-[#e8ede9] text-right tabular-nums">{t.cas}</span>
                  <span className="text-sm text-[#0f9d70] text-right tabular-nums">{t.ok}</span>
                  <span className="text-sm text-[#C0392B] text-right tabular-nums">{t.nok}</span>
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-12 h-1.5 rounded-full bg-[#1a2420] overflow-hidden">
                      <div className={'h-full rounded-full ' + (t.taux >= 60 ? 'bg-[#0f9d70]' : t.taux >= 45 ? 'bg-[#f5a623]' : 'bg-[#C0392B]')} style={{ width: t.taux + '%' }} />
                    </div>
                    <span className="text-xs tabular-nums text-[#e8ede9] w-8 text-right">{t.taux}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#C0392B] mb-3">Évolutions installations par équipe</h3>
            <div className="h-[420px]">
              {teamChart.length === 0 ? (
                <p className="text-xs text-[#7a8f80]/70 text-center pt-20">Pas de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={teamChart} margin={{ left: 0, right: 8, top: 8, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" />
                    <XAxis dataKey="name" stroke="#7a8f80" fontSize={9} angle={-45} textAnchor="end" interval={0} height={70} />
                    <YAxis yAxisId="left" stroke="#7a8f80" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f5a623" fontSize={10} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#0a0f0d', border: '1px solid #1e2e25', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="left" dataKey="cas" name="Cas" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar yAxisId="left" dataKey="ok" name="OK" fill="#f97316" radius={[2, 2, 0, 0]} />
                    <Bar yAxisId="left" dataKey="nok" name="NOK" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="taux" name="Taux %" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      ) : tab === 'olt' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-semibold text-[#7a8f80] bg-[#0a0f0d] grid grid-cols-[2fr_4rem_4rem_4rem_5rem] gap-2">
              <span>OLT</span><span className="text-right">Cas</span><span className="text-right">OK</span><span className="text-right">NOK</span><span className="text-right">Taux</span>
            </div>
            <div className="divide-y divide-[#1e2e25]/50 max-h-[480px] overflow-y-auto">
              {olts.length === 0 && <p className="p-6 text-center text-xs text-[#7a8f80]/70">Aucune donnée.</p>}
              {olts.map((o: any) => (
                <div key={o.olt} className="px-4 py-2.5 grid grid-cols-[2fr_4rem_4rem_4rem_5rem] gap-2 items-center hover:bg-[#172019] transition-colors">
                  <span className="text-sm text-[#e8ede9]">{o.olt}</span>
                  <span className="text-sm text-[#e8ede9] text-right tabular-nums">{o.cas}</span>
                  <span className="text-sm text-[#0f9d70] text-right tabular-nums">{o.ok}</span>
                  <span className="text-sm text-[#C0392B] text-right tabular-nums">{o.nok}</span>
                  <span className="text-sm text-right tabular-nums">
                    <Badge className={o.taux >= 60 ? 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30' : o.taux >= 45 ? 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30' : 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30'}>{o.taux}%</Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#C0392B] mb-3">DASHBOARD PAR OLT</h3>
            <div className="h-[420px]">
              {oltChart.length === 0 ? (
                <p className="text-xs text-[#7a8f80]/70 text-center pt-20">Pas de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={oltChart} layout="vertical" margin={{ left: 16, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" />
                    <XAxis type="number" stroke="#7a8f80" fontSize={10} />
                    <YAxis type="category" dataKey="name" stroke="#7a8f80" fontSize={11} width={90} />
                    <Tooltip contentStyle={{ background: '#0a0f0d', border: '1px solid #1e2e25', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cas" name="Cas" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="ok" name="OK" stackId="a" fill="#f97316" />
                    <Bar dataKey="nok" name="NOK" stackId="a" fill="#94a3b8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      ) : tab === 'motifs' ? (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="px-4 py-2.5 text-xs text-[#7a8f80] bg-[#0a0f0d]">
            Libellés COMMENTAIRES Excel (SATURATION PBO, ZONE CLIENT NON FIBREE…)
          </div>
          <div className="divide-y divide-[#1e2e25]/50">
            {motifs.length === 0 && <p className="p-6 text-center text-xs text-[#7a8f80]/70">Aucun NOK sur la période.</p>}
            {motifs.map((m: any) => {
              const max = motifs[0]?.count ?? 1;
              return (
                <div key={m.motif} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#e8ede9]">{m.motif}</span>
                    <span className="text-sm text-[#C0392B] tabular-nums">{m.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1a2420] overflow-hidden">
                    <div className="h-full rounded-full bg-[#C0392B]" style={{ width: `${(m.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="px-4 py-2.5 text-xs text-[#7a8f80] bg-[#0a0f0d]">
            Colonne TACHES EFFECTUEES (SURVEY+INSTALLATION, DEPLACEMENT, NEANT…)
          </div>
          <div className="divide-y divide-[#1e2e25]/50">
            {taches.length === 0 && <p className="p-6 text-center text-xs text-[#7a8f80]/70">Aucune tâche renseignée — importez un DAILY.</p>}
            {taches.map((t: any) => {
              const max = taches[0]?.count ?? 1;
              return (
                <div key={t.tache} className="px-4 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#e8ede9]">{t.tache}</span>
                    <span className="text-sm text-[#0f9d70] tabular-nums">{t.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1a2420] overflow-hidden">
                    <div className="h-full rounded-full bg-[#0f9d70]" style={{ width: `${(t.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-[#7a8f80]">Actualiser</Button>
      </div>
    </div>
  );
}
