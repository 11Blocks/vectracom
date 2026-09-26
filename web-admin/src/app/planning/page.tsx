'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { api } from '@/lib/api';
import { STATUS_META, typeMeta, statusMeta } from '@/lib/mission-meta';
import { reportsService } from '@/services';
import {
  CalendarDays, Upload, ChevronLeft, ChevronRight, Table as TableIcon, LayoutGrid,
  MapPin, ArrowRight, Loader2, CalendarRange, FileDown, FileSpreadsheet, Sun, AlertTriangle,
} from 'lucide-react';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function dateKey(d: string) { return new Date(d).toISOString().slice(0, 10); }
function mondayOf(date: Date): Date {
  const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<'table' | 'week' | 'month' | 'day' | 'quarter' | 'year'>('table');
  const [statusFilter, setStatusFilter] = useState('');
  const [weekAnchor, setWeekAnchor] = useState(mondayOf(new Date()));
  const [monthAnchor, setMonthAnchor] = useState(new Date(new Date().toISOString().slice(0, 8) + '01'));
  const [dayAnchor, setDayAnchor] = useState(new Date().toISOString().slice(0, 10));
  const [quarterAnchor, setQuarterAnchor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), q: Math.floor(n.getMonth() / 3) };
  });
  const [yearAnchor, setYearAnchor] = useState(new Date().getFullYear());

  // Vues calendrier : on ne charge que la plage affichée (le serveur plafonne à 2000 missions).
  const range: { from: string; to: string } | null = (() => {
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    switch (view) {
      case 'week': return { from: ymd(weekAnchor), to: ymd(addDays(weekAnchor, 6)) };
      case 'day': return { from: dayAnchor, to: dayAnchor };
      case 'month': {
        const start = mondayOf(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1));
        return { from: ymd(start), to: ymd(addDays(start, 41)) };
      }
      case 'quarter': return {
        from: ymd(new Date(quarterAnchor.year, quarterAnchor.q * 3, 1)),
        to: ymd(new Date(quarterAnchor.year, quarterAnchor.q * 3 + 3, 0)),
      };
      case 'year': return { from: `${yearAnchor}-01-01`, to: `${yearAnchor}-12-31` };
      default: return null;
    }
  })();

  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== '__SURCH__') params.set('status', statusFilter);
  if (range) {
    params.set('from', range.from);
    params.set('to', range.to + 'T23:59:59');
  }
  const qs = params.toString();

  const { data, loading } = useQuery(() => api.get('/planning/missions' + (qs ? '?' + qs : '')), [qs]);

  const exportMut = useMutation(
    async (kind: 'pdf' | 'excel') => {
      const month = monthAnchor.toISOString().slice(0, 7);
      const blob = kind === 'pdf'
        ? await reportsService.exportPdf('planning', { month })
        : await reportsService.exportExcel('planning', { month });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planning-${month}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    {
      onSuccess: () => toast({ title: 'Planning exporté', variant: 'success' }),
      onError: (e: any) => toast({ title: 'Export impossible', description: e.message, variant: 'error' }),
    },
  );
  const missions = Array.isArray(data) ? data : [];
  const visibleMissions = statusFilter === '__SURCH__' ? missions.filter((m: any) => m.surcharge) : missions;

  const byDay = new Map<string, any[]>();
  for (const m of visibleMissions) {
    const k = dateKey(m.dateMission);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(m);
  }

  const monthCells: Array<{ key: string; day: number; inMonth: boolean }> = (() => {
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const start = mondayOf(first);
    const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      cells.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        day: d.getDate(),
        inMonth: d.getMonth() === monthAnchor.getMonth(),
      });
    }
    return cells;
  })();
  const monthMissions = monthCells.filter(c => c.inMonth).reduce((n, c) => n + (byDay.get(c.key)?.length ?? 0), 0);

  const weekDays = [...Array(7)].map((_, i) => addDays(weekAnchor, i));
  const weekMissions = weekDays.reduce((n, d) => n + (byDay.get(d.toISOString().slice(0, 10))?.length ?? 0), 0);

  const quarterMonths = [0, 1, 2].map((i) => new Date(quarterAnchor.year, quarterAnchor.q * 3 + i, 1));
  const quarterMissions = quarterMonths.reduce((n, m) => {
    const y = m.getFullYear();
    const mo = m.getMonth();
    let c = 0;
    for (const [k, list] of Array.from(byDay.entries())) {
      const d = new Date(k);
      if (d.getFullYear() === y && d.getMonth() === mo) c += list.length;
    }
    return n + c;
  }, 0);

  const yearMonths = [...Array(12)].map((_, i) => new Date(yearAnchor, i, 1));
  const yearMissions = yearMonths.reduce((n, m) => {
    const mo = m.getMonth();
    let c = 0;
    for (const [k, list] of Array.from(byDay.entries())) {
      const d = new Date(k);
      if (d.getFullYear() === yearAnchor && d.getMonth() === mo) c += list.length;
    }
    return n + c;
  }, 0);

  const hoursLabel = (m: any) => {
    const a = m.importMeta?.heureDebut;
    const b = m.importMeta?.heureFin;
    if (a && b) return `${a}–${b}`;
    if (a) return a;
    if (m.heure) return m.heure;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><CalendarDays size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Planning</h1>
            <p className="text-xs text-[#7a8f80]">{visibleMissions.length} mission(s) — cliquez une ligne pour le détail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1">
            <button onClick={() => setView('table')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'table' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <TableIcon size={13} /> Tableau
            </button>
            <button onClick={() => setView('week')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'week' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <LayoutGrid size={13} /> Semaine
            </button>
            <button onClick={() => setView('day')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'day' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <Sun size={13} /> Jour
            </button>
            <button onClick={() => setView('month')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'month' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <CalendarRange size={13} /> Mois
            </button>
            <button onClick={() => setView('quarter')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'quarter' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <CalendarDays size={13} /> Trimestre
            </button>
            <button onClick={() => setView('year')}
              className={'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ' + (view === 'year' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
              <CalendarRange size={13} /> Année
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate('pdf')} loading={exportMut.loading}>
            <FileDown size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMut.mutate('excel')} loading={exportMut.loading}>
            <FileSpreadsheet size={14} /> Excel
          </Button>
          <Link href="/planning/import">
            <Button><Upload size={15} /> Importer SONATEL</Button>
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 w-44 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(() => {
          const surch = missions.filter((m: any) => m.surcharge).length;
          if (!surch) return null;
          return (
            <button onClick={() => setStatusFilter(statusFilter === '__SURCH__' ? '' : '__SURCH__')}
              className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ' + (statusFilter === '__SURCH__' ? 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/40' : 'bg-[#D9822B]/10 text-[#D9822B] border-[#D9822B]/30 opacity-80 hover:opacity-100')}>
              <AlertTriangle size={11} /> Surcharge · {surch}
            </button>
          );
        })()}
        {Object.entries(STATUS_META).map(([k, v]) => {
          const count = missions.filter((m: any) => m.status === k).length;
          if (!count) return null;
          return (
            <button key={k} onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
              className={'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity ' + v.cls + (statusFilter && statusFilter !== k ? ' opacity-40' : '')}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
              {v.label} · {count}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : view === 'table' ? (
        visibleMissions.length === 0 ? (
          <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
            <CalendarDays size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
            <p className="text-sm text-[#7a8f80] mb-4">Aucune mission — importez le planning SONATEL pour commencer</p>
            <Link href="/planning/import" className="inline-block"><Button><Upload size={15} /> Importer un fichier Excel</Button></Link>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2e25] bg-[#111916]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">N° dossier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Tâche</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Horaires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                {missions.map((m: any) => {
                  const meta = statusMeta(m.status);
                  return (
                    <tr key={m.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => router.push('/missions/' + m.id)}>
                      <td className="px-4 py-3 font-mono text-xs text-[#0f9d70]">{m.sonatelDossierNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-[#e8ede9] max-w-44 truncate">{m.clientSite}</td>
                      <td className="px-4 py-3"><span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ' + typeMeta(m.typeTache).cls}>{m.typeTache}</span></td>
                      <td className="px-4 py-3 text-[#7a8f80]"><span className="inline-flex items-center gap-1"><MapPin size={12} className="text-[#7a8f80]/60" />{m.zone ?? '—'}</span></td>
                      <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(m.dateMission)}</td>
                      <td className="px-4 py-3 text-[#7a8f80] text-xs tabular-nums">{hoursLabel(m) ?? '—'}</td>
                      <td className="px-4 py-3 text-[#7a8f80]">{m.importMeta?.teamLabel ?? m.team?.name ?? '—'}</td>
                      <td className="px-4 py-3"><Badge className={meta.cls}><span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />{meta.label}</Badge></td>
                      <td className="px-4 py-3 text-right text-[#7a8f80]"><ArrowRight size={14} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : view === 'week' ? (
        /* ── VUE SEMAINE ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}><ChevronLeft size={15} /></Button>
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8ede9]">
                Semaine du {weekDays[0].toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} au {weekDays[6].toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-[#7a8f80]">{weekMissions} mission(s) cette semaine</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}><ChevronRight size={15} /></Button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => {
              const key = day.toISOString().slice(0, 10);
              const dayMissions = byDay.get(key) ?? [];
              const isToday = key === new Date().toISOString().slice(0, 10);
              return (
                <div key={key} className={'rounded-lg border min-h-40 p-2 ' + (isToday ? 'border-[#0f9d70]/50 bg-[#0f9d70]/[0.04]' : 'border-[#1e2e25] bg-[#111916]')}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={'text-xs font-semibold ' + (isToday ? 'text-[#0f9d70]' : 'text-[#e8ede9]')}>{DAY_LABELS[i]}</span>
                    <span className={'text-xs ' + (isToday ? 'text-[#0f9d70] font-bold' : 'text-[#7a8f80]')}>{day.getDate()}</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayMissions.slice(0, 4).map((m: any) => {
                      const meta = statusMeta(m.status);
                      return (
                        <button key={m.id} onClick={() => router.push('/missions/' + m.id)}
                          className="w-full text-left rounded-md border border-[#1e2e25] bg-[#0a0f0d] px-2 py-1.5 hover:border-[#0f9d70]/40 transition-colors">
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeMeta(m.typeTache).dot }} />
                            <span className="text-[10px] text-[#e8ede9] truncate">{m.clientSite}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full shrink-0" style={{ background: meta.dot }} />
                            <p className="text-[9px] text-[#7a8f80] truncate">{m.typeTache} · {meta.label}</p>
                          </div>
                        </button>
                      );
                    })}
                    {dayMissions.length > 4 && (
                      <p className="text-[10px] text-[#7a8f80] text-center">+{dayMissions.length - 4} autres</p>
                    )}
                    {dayMissions.length === 0 && <p className="text-[10px] text-[#7a8f80]/40 text-center pt-4">—</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'day' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDayAnchor(new Date(new Date(dayAnchor).getTime() - 86400000).toISOString().slice(0, 10))}><ChevronLeft size={15} /></Button>
            <input type="date" value={dayAnchor} onChange={e => setDayAnchor(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
            <Button variant="secondary" size="sm" onClick={() => setDayAnchor(new Date(new Date(dayAnchor).getTime() + 86400000).toISOString().slice(0, 10))}><ChevronRight size={15} /></Button>
            <span className="text-xs text-[#7a8f80]">{(byDay.get(dayAnchor) ?? []).length} mission(s)</span>
          </div>
          <div className="space-y-2">
            {((byDay.get(dayAnchor) ?? []).length === 0) && (
              <Card className="border-[#1e2e25] bg-[#111916] p-8 text-center">
                <p className="text-sm text-[#7a8f80]">Aucune mission ce jour-là.</p>
              </Card>
            )}
            {(byDay.get(dayAnchor) ?? []).map((m: any) => {
              const meta = statusMeta(m.status);
              const hrs = hoursLabel(m);
              return (
                <button key={m.id} onClick={() => router.push('/missions/' + m.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#1e2e25] bg-[#111916] px-4 py-3 hover:border-[#0f9d70]/40 transition-colors text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#e8ede9] truncate">{m.clientSite}</p>
                    <p className="text-xs text-[#7a8f80] mt-0.5">
                      <span className="font-mono text-[#0f9d70]">{m.sonatelDossierNumber ?? '—'}</span>
                      {m.zone ? ' · ' + m.zone : ''} · {m.importMeta?.teamLabel ?? m.team?.name ?? 'Non affectée'}
                      {hrs ? ` · ${hrs}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.surcharge && <Badge className="bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30 text-[10px]">SURCH</Badge>}
                      <Badge className={meta.cls}>{meta.label}</Badge>
                    <ArrowRight size={14} className="text-[#7a8f80]/50" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : view === 'quarter' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => {
              const q = quarterAnchor.q - 1;
              setQuarterAnchor(q < 0 ? { year: quarterAnchor.year - 1, q: 3 } : { year: quarterAnchor.year, q });
            }}><ChevronLeft size={15} /></Button>
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8ede9]">T{quarterAnchor.q + 1} {quarterAnchor.year}</p>
              <p className="text-xs text-[#7a8f80]">{quarterMissions} mission(s) ce trimestre</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => {
              const q = quarterAnchor.q + 1;
              setQuarterAnchor(q > 3 ? { year: quarterAnchor.year + 1, q: 0 } : { year: quarterAnchor.year, q });
            }}><ChevronRight size={15} /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quarterMonths.map((m) => {
              const y = m.getFullYear();
              const mo = m.getMonth();
              let count = 0;
              const sample: any[] = [];
              for (const [k, list] of Array.from(byDay)) {
                const d = new Date(k);
                if (d.getFullYear() === y && d.getMonth() === mo) {
                  count += list.length;
                  if (sample.length < 4) sample.push(...list.slice(0, 4 - sample.length));
                }
              }
              return (
                <button key={mo} type="button"
                  onClick={() => { setMonthAnchor(new Date(y, mo, 1)); setView('month'); }}
                  className="rounded-lg border border-[#1e2e25] bg-[#111916] p-3 text-left hover:border-[#0f9d70]/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#e8ede9] capitalize">
                      {m.toLocaleDateString('fr-FR', { month: 'long' })}
                    </span>
                    <span className="text-xs px-1.5 rounded-full bg-[#0f9d70]/15 text-[#0f9d70]">{count}</span>
                  </div>
                  <div className="space-y-1">
                    {sample.slice(0, 3).map((mission: any) => (
                      <p key={mission.id} className="text-[10px] text-[#7a8f80] truncate">{mission.clientSite}</p>
                    ))}
                    {count === 0 && <p className="text-[10px] text-[#7a8f80]/40">—</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : view === 'year' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setYearAnchor(yearAnchor - 1)}><ChevronLeft size={15} /></Button>
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8ede9]">{yearAnchor}</p>
              <p className="text-xs text-[#7a8f80]">{yearMissions} mission(s) cette année</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setYearAnchor(yearAnchor + 1)}><ChevronRight size={15} /></Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {yearMonths.map((m) => {
              const mo = m.getMonth();
              let count = 0;
              for (const [k, list] of Array.from(byDay)) {
                const d = new Date(k);
                if (d.getFullYear() === yearAnchor && d.getMonth() === mo) count += list.length;
              }
              return (
                <button key={mo} type="button"
                  onClick={() => { setMonthAnchor(new Date(yearAnchor, mo, 1)); setView('month'); }}
                  className="rounded-lg border border-[#1e2e25] bg-[#111916] px-3 py-3 text-left hover:border-[#0f9d70]/40 transition-colors">
                  <p className="text-xs text-[#7a8f80] capitalize">{m.toLocaleDateString('fr-FR', { month: 'short' })}</p>
                  <p className="text-lg font-bold text-[#e8ede9] tabular-nums">{count}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}><ChevronLeft size={15} /></Button>
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8ede9]">
                {monthAnchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-xs text-[#7a8f80]">{monthMissions} mission(s) ce mois</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}><ChevronRight size={15} /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-[#7a8f80] uppercase pb-1">{d}</div>
            ))}
            {monthCells.map(({ key, day, inMonth }: any) => {
              const dayMissions = byDay.get(key) ?? [];
              const isToday = key === new Date().toISOString().slice(0, 10);
              return (
                <div key={key}
                  className={'rounded-lg border min-h-24 p-1.5 ' +
                    (inMonth ? (isToday ? 'border-[#0f9d70]/50 bg-[#0f9d70]/[0.04]' : 'border-[#1e2e25] bg-[#111916]') : 'border-[#1e2e25]/40 bg-[#0a0f0d] opacity-40')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={'text-[11px] ' + (isToday ? 'text-[#0f9d70] font-bold' : 'text-[#7a8f80]')}>{day}</span>
                    {dayMissions.length > 0 && (
                      <span className="text-[9px] px-1.5 rounded-full bg-[#0f9d70]/15 text-[#0f9d70]">{dayMissions.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayMissions.slice(0, 3).map((m: any) => {
                      return (
                        <button key={m.id} onClick={() => router.push('/missions/' + m.id)} title={m.clientSite}
                          className="w-full text-left rounded border border-[#1e2e25]/60 bg-[#0a0f0d] px-1.5 py-0.5 hover:border-[#0f9d70]/40 transition-colors">
                          <div className="flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full shrink-0" style={{ background: typeMeta(m.typeTache).dot }} />
                            <span className="text-[9px] text-[#e8ede9] truncate">{m.clientSite}</span>
                          </div>
                        </button>
                      );
                    })}
                    {dayMissions.length > 3 && (
                      <p className="text-[9px] text-[#7a8f80] text-center">+{dayMissions.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
