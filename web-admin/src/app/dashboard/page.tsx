'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Badge, Card, Skeleton, EmptyState, StatCard, AiBlock, ChartEmpty } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { missionsService, dashboardService, kpiService, stockService, vehiclesService, accountingService } from '@/services';
import {
  ClipboardCheck, AlertTriangle, Clock, Package, Truck, ShieldAlert, Receipt,
  Sparkles, CheckCircle, XCircle, ArrowRight, CalendarDays, Plus, FileBarChart, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const period = new Date().toISOString().slice(0, 7);
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const { data: summary, loading: ls } = useQuery(() => dashboardService.summary(days), [days], { pollingMs: 60000 });
  const { data: missions } = useQuery(() => missionsService.list({ limit: '10' }), [], { pollingMs: 60000 });
  const { data: kpi } = useQuery(() => kpiService.dashboard(period), [period]);
  const { data: lowStock } = useQuery(() => stockService.lowStock(), []);
  const { data: vehicles } = useQuery(() => vehiclesService.list(), []);
  const { data: monthSummary } = useQuery(() => accountingService.summary(period), [period]);

  const missionList = Array.isArray(missions) ? missions : [];
  const lowStockCount = Array.isArray(lowStock) ? lowStock.length : 0;
  const vehiclesList = Array.isArray(vehicles) ? vehicles : [];

  const todayCount = summary?.kpis.todayMissions ?? 0;
  const lateCount = summary?.kpis.lateMissions ?? 0;
  const pendingCount = summary?.kpis.pendingValidation ?? 0;
  const criticalCount = summary?.kpis.openCriticalIncidents;
  const showIncidents = criticalCount !== null && criticalCount !== undefined;

  // Véhicules à contrôler : assurance ou visite technique expire sous 30 jours
  const in30d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const vehiclesToCheck = vehiclesList.filter(v =>
    (v.insuranceExpiration && v.insuranceExpiration <= in30d) ||
    (v.technicalInspectionExpiration && v.technicalInspectionExpiration <= in30d),
  ).length;

  // Activité N jours (missions datées du jour + incidents signalés), agrégée côté serveur
  const activity = (summary?.activity ?? []).map(a => ({
    jour: new Date(a.day + 'T12:00:00Z').toLocaleDateString('fr-FR', days === 7 ? { weekday: 'short', day: '2-digit' } : { day: '2-digit', month: '2-digit' }),
    Missions: a.missions,
    Incidents: a.incidents ?? 0,
  }));
  const activityEmpty = activity.every(a => a.Missions === 0 && a.Incidents === 0);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  const fmtFCFA = (n: any) => n !== null && n !== undefined ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—';

  const kpiCards = [
    { label: 'Missions du jour', value: todayCount, icon: <ClipboardCheck size={18} />, variant: 'success' as const, onClick: () => router.push('/missions') },
    { label: 'En retard', value: lateCount, icon: <AlertTriangle size={18} />, variant: (lateCount > 0 ? 'danger' : 'default') as any, onClick: () => router.push('/missions') },
    { label: 'En attente validation', value: pendingCount, icon: <Clock size={18} />, variant: (pendingCount > 0 ? 'warning' : 'default') as any, onClick: () => router.push('/missions') },
    { label: 'Stock faible', value: lowStockCount, icon: <Package size={18} />, variant: (lowStockCount > 0 ? 'warning' : 'default') as any, onClick: () => router.push('/stock') },
    { label: 'Véhicules à contrôler', value: vehiclesToCheck, icon: <Truck size={18} />, variant: (vehiclesToCheck > 0 ? 'warning' : 'default') as any, onClick: () => router.push('/vehicles') },
    ...(showIncidents ? [{ label: 'Incidents critiques ouverts', value: criticalCount, icon: <ShieldAlert size={18} />, variant: (criticalCount > 0 ? 'danger' : 'default') as any, onClick: () => router.push('/incidents') }] : []),
    { label: 'Dépenses du mois', value: monthSummary ? fmtFCFA(monthSummary.total).replace(' FCFA', '') : '—', icon: <Receipt size={18} />, variant: 'default' as const, onClick: () => router.push('/comptabilite') },
  ];

  if (ls && !summary) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-[6.5rem]" />)}
      </div>
      <Skeleton className="h-40" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#e8ede9]">Tableau de bord</h1>
        <p className="text-sm text-[#7a8f80] mt-1">Vue d'ensemble de vos opérations terrain</p>
      </div>

      {/* KPI Cards grid 2/3/4 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpiCards.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} icon={k.icon} variant={k.variant} />
        ))}
      </div>

      {/* Activité 7 jours */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
            <BarChart3 size={16} className="text-[#0f9d70]" /> Activité — {days} derniers jours
          </h3>
          <div className="flex items-center gap-4 text-xs text-[#7a8f80]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#0f9d70]" /> Missions</span>
            {showIncidents && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#f5a623]" /> Incidents</span>}
            <div className="flex rounded-md border border-[#1e2e25] overflow-hidden">
              {([7, 14, 30] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setDays(n)}
                  className={`px-2 py-1 ${days === n ? 'bg-[#0f9d70]/20 text-[#0f9d70]' : 'hover:bg-white/[0.04]'}`}
                >{n} j</button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-56">
          {activityEmpty ? (
            <ChartEmpty
              className="h-full"
              message={`Aucune mission ni incident sur les ${days} derniers jours`}
              lastDates={[
                { label: 'Dernière mission', date: summary?.lastMissionDate },
                ...(showIncidents ? [{ label: 'Dernier incident', date: summary?.lastIncidentDate }] : []),
              ]}
              action={
                <div className="flex gap-3 text-xs">
                  <Link href="/missions" className="text-[#0f9d70] hover:underline">Missions →</Link>
                  {showIncidents && <Link href="/incidents" className="text-[#0f9d70] hover:underline">Incidents →</Link>}
                </div>
              }
            />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activity} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
              <XAxis dataKey="jour" tick={{ fill: '#7a8f80', fontSize: 11 }} axisLine={{ stroke: '#1e2e25' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#7a8f80', fontSize: 11 }} axisLine={{ stroke: '#1e2e25' }} tickLine={false} width={28} />
              <Tooltip
                cursor={{ fill: 'rgba(15,157,112,0.06)' }}
                contentStyle={{ background: '#111916', border: '1px solid #1e2e25', borderRadius: '0.5rem', fontSize: 12 }}
                labelStyle={{ color: '#e8ede9' }}
                itemStyle={{ color: '#e8ede9' }}
              />
              <Bar dataKey="Missions" fill="#0f9d70" radius={[3, 3, 0, 0]} maxBarSize={28} />
              {showIncidents && <Bar dataKey="Incidents" fill="#f5a623" radius={[3, 3, 0, 0]} maxBarSize={28} />}
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Recommandations IA (ambre) */}
      {(pendingCount > 0 || lateCount > 0 || (kpi && kpi.nonAtteints > 0)) && (
        <AiBlock title="Recommandations IA">
          <div className="space-y-2">
            {pendingCount > 0 && (
              <div className="flex items-center justify-between bg-[#111916]/80 border border-[#f5a623]/25 rounded-lg p-3">
                <p className="text-sm text-[#e8ede9]">
                  <strong>{pendingCount}</strong> mission(s) terminée(s) en attente de validation
                </p>
                <div className="flex gap-2">
                  <Link href="/missions"><button className="px-3 py-1.5 text-xs rounded-md bg-[#f5a623] text-[#0a0f0d] font-medium hover:bg-[#d9911f]">Appliquer</button></Link>
                </div>
              </div>
            )}
            {lateCount > 0 && (
              <div className="flex items-center justify-between bg-[#111916]/80 border border-[#f5a623]/25 rounded-lg p-3">
                <p className="text-sm text-[#e8ede9]">
                  <strong>{lateCount}</strong> mission(s) en retard — vérifier les affectations
                </p>
                <Link href="/missions"><button className="px-3 py-1.5 text-xs rounded-md bg-[#f5a623] text-[#0a0f0d] font-medium hover:bg-[#d9911f]">Voir</button></Link>
              </div>
            )}
            {kpi && kpi.nonAtteints > 0 && (
              <div className="flex items-center justify-between bg-[#111916]/80 border border-[#f5a623]/25 rounded-lg p-3">
                <p className="text-sm text-[#e8ede9]">
                  <strong>{kpi.nonAtteints}</strong> KPI SONATEL non atteints — pénalités : <strong>{fmtFCFA(kpi.penaltiesTotal)}</strong>
                </p>
                <Link href="/rapports/kpi-sonatel"><button className="px-3 py-1.5 text-xs rounded-md bg-[#f5a623] text-[#0a0f0d] font-medium hover:bg-[#d9911f]">Détail</button></Link>
              </div>
            )}
          </div>
        </AiBlock>
      )}

      {/* Missions récentes */}
      <Card className="border-[#1e2e25] bg-[#111916]">
        <div className="p-4 border-b border-[#1e2e25]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#e8ede9]">Missions récentes</h3>
            <Link href="/missions" className="flex items-center gap-1 text-sm text-[#0f9d70] hover:underline">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {missionList.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={40} className="text-[#7a8f80]/50" />} title="Aucune mission" description="Importez un fichier SONATEL ou créez une mission" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2e25] hover:bg-transparent">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#7a8f80]">Mission</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#7a8f80] hidden sm:table-cell">Équipe</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[#7a8f80]">Action</th>
                </tr>
              </thead>
              <tbody>
                {missionList.slice(0, 10).map(m => (
                  <tr key={m.id} className="border-b border-[#1e2e25] cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => router.push('/missions/' + m.id)}>
                    <td className="px-4 py-3 text-[#e8ede9]">
                      <p className="font-medium">{m.clientSite || '—'}</p>
                      <p className="text-xs text-[#7a8f80]">{m.typeTache} · {fmtDate(m.dateMission)}</p>
                    </td>
                    <td className="px-4 py-3 text-[#7a8f80] hidden sm:table-cell">{m.zone || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={
                        m.status === 'validee' ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' :
                        m.status === 'rejetee' ? 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' :
                        m.status === 'terminee' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        m.status === 'en_cours' ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }>{m.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-[#0f9d70]">Voir →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { href: '/planning', icon: <CalendarDays size={20} />, label: 'Import SONATEL', desc: 'Planning' },
          { href: '/missions', icon: <Plus size={20} />, label: 'Nouvelle mission', desc: 'Missions' },
          { href: '/incidents', icon: <AlertTriangle size={20} />, label: 'Signaler', desc: 'Incidents' },
          { href: '/invoices', icon: <Receipt size={20} />, label: 'Facturation', desc: 'ONECOMIT→SONATEL' },
          { href: '/rapports', icon: <FileBarChart size={20} />, label: 'Rapports', desc: 'Analyses' },
        ].map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex flex-col items-center gap-2 p-4 rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] hover:border-[#0f9d70]/30 hover:bg-[#111916]/80 transition-all"
          >
            <span className="p-2.5 rounded-xl bg-[#0f9d70]/10 text-[#0f9d70] group-hover:scale-110 transition-transform">
              {a.icon}
            </span>
            <span className="text-sm font-medium text-[#e8ede9]">{a.label}</span>
            <span className="text-xs text-[#7a8f80]">{a.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
