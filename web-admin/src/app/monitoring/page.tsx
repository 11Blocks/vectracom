'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { monitoringService } from '@/services';
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const METRICS = [
  { key: 'cpu', label: 'CPU (%)', color: '#0f9d70' },
  { key: 'ram', label: 'RAM (%)', color: '#5b8def' },
  { key: 'storage', label: 'Stockage (%)', color: '#D9822B' },
  { key: 'ia_latency', label: 'Latence IA (ms)', color: '#f5a623' },
  { key: 'api_latency', label: 'Latence API (ms)', color: '#7a8f80' },
  { key: 'api_500_errors', label: 'Erreurs 500 / min', color: '#C0392B' },
];
const STATUS_META: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  warning: { label: 'Attention', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
  critical: { label: 'Critique', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
};

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
  const [metric, setMetric] = useState('cpu');
  const [alertTab, setAlertTab] = useState('open');

  const { data: status, loading: ls, refetch: refetchStatus } = useQuery(() => monitoringService.getStatus(), [], { pollingMs: 30000 });
  const { data: metrics, refetch: refetchMetrics } = useQuery(() => monitoringService.getMetrics({ metricType: metric }), [metric]);
  const { data: alerts, refetch: refetchAlerts } = useQuery(
    () => monitoringService.getAlerts(alertTab === 'resolved'),
    [alertTab],
  );

  const collectMut = useMutation(() => monitoringService.collect(), {
    onSuccess: () => { toast({ title: 'Collecte effectuée', variant: 'success' }); refetchStatus(); refetchMetrics(); refetchAlerts(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const resolveMut = useMutation((id: string) => monitoringService.resolveAlert(id), {
    onSuccess: () => { toast({ title: 'Alerte résolue', variant: 'success' }); refetchAlerts(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const points = (Array.isArray(metrics) ? metrics : []).slice().reverse().map((m: any) => ({
    time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
    value: Number(m.value),
  }));
  const alertList = Array.isArray(alerts) ? alerts : [];
  const st = STATUS_META[status?.status ?? 'ok'] ?? STATUS_META.ok;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Activity size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Plateforme Monitoring</h1>
            <p className="text-xs text-[#7a8f80]">CPU, RAM, stockage, latence IA, requêtes API — seuils d'alerte automatiques</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && <Badge className={st.cls}>{st.label}</Badge>}
          <Button variant="secondary" onClick={() => collectMut.mutate()} disabled={collectMut.loading}>
            {collectMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Collecter
          </Button>
        </div>
      </div>

      {/* Dernières valeurs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {METRICS.map(m => {
          const last = (Array.isArray(metrics) && metric === m.key)
            ? points[points.length - 1]?.value
            : (status?.latest?.[m.key] as number | undefined);
          return (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={'rounded-lg border p-3 text-left transition-all ' + (metric === m.key ? 'border-[#0f9d70]/50 bg-[#0f9d70]/[0.06]' : 'border-[#1e2e25] bg-[#111916] hover:border-[#0f9d70]/30')}>
              <p className="text-[10px] text-[#7a8f80] mb-1">{m.label}</p>
              <p className="text-xl font-bold" style={{ color: m.color }}>
                {last !== undefined && last !== null ? Number(last).toLocaleString('fr-FR') : '—'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Graphe */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2">
          <Cpu size={15} className="text-[#0f9d70]" /> {METRICS.find(m => m.key === metric)?.label} — évolution
        </h3>
        {points.length === 0 ? (
          <p className="text-xs text-[#7a8f80] py-10 text-center">Aucune mesure — cliquez « Collecter » pour enregistrer un point.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
                <XAxis dataKey="time" {...axisProps} />
                <YAxis {...axisProps} width={40} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={METRICS.find(m => m.key === metric)?.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Alertes */}
      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2e25] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><AlertTriangle size={15} className="text-[#D9822B]" /> Alertes techniques</h3>
          <Tabs
            tabs={[{ value: 'open', label: 'Ouvertes' }, { value: 'resolved', label: 'Résolues' }]}
            active={alertTab}
            onChange={setAlertTab}
          />
        </div>
        <div className="divide-y divide-[#1e2e25]/50">
          {alertList.length === 0 ? (
            <p className="text-xs text-[#7a8f80] py-8 text-center">Aucune alerte</p>
          ) : alertList.map((a: any) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[#e8ede9]">
                  {a.metricType} = {Number(a.value).toLocaleString('fr-FR')}
                  <span className="text-xs text-[#7a8f80] ml-2">seuil {Number(a.threshold).toLocaleString('fr-FR')}</span>
                </p>
                <p className="text-xs text-[#7a8f80]">{a.message} · {a.createdAt ? new Date(a.createdAt).toLocaleString('fr-FR') : ''}</p>
              </div>
              {!a.resolvedAt && (
                <Button size="sm" className="h-7 px-2 text-xs shrink-0" disabled={resolveMut.loading} onClick={() => resolveMut.mutate(a.id)}>
                  <CheckCircle2 size={12} className="mr-1" /> Résoudre
                </Button>
              )}
              {a.resolvedAt && <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30 shrink-0">Résolue</Badge>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
