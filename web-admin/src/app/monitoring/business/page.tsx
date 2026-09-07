'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, StatCard, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { businessService } from '@/services';
import { TrendingUp, RefreshCw, Building2, CreditCard, Users, KeyRound } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const PLAN_LABELS: Record<string, string> = {
  MOBILE: 'Licence Mobile', WEB: 'Licence Web', RAG: 'Dashboard RAG', GEOLOCATION: 'Géolocalisation',
};
const ADDON_LABELS: Record<string, string> = {
  ia_vision: 'IA Vision PBO', pre_audit: 'Pré-audit photo', agent_planning: 'Agent Planning', voice: 'Raccourci vocal',
};

function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA';
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
  const { data, loading, refetch } = useQuery(() => businessService.dashboard(), []);

  const refreshMut = useMutation(() => businessService.mrr(), {
    onSuccess: () => { toast({ title: 'Recalcul effectué', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const licenses = (data?.licenses ?? []).map((l: any) => ({
    name: PLAN_LABELS[l.planCode] ?? l.planCode, count: l.count, monthly: l.monthly,
  }));
  const addons = (data?.addons ?? []).map((a: any) => ({
    name: ADDON_LABELS[a.addonType] ?? a.addonType, count: a.count, monthly: a.monthly,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><TrendingUp size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Business Monitoring</h1>
            <p className="text-xs text-[#7a8f80]">Green-T — revenus récurrents, licences actives, rétention</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => refreshMut.mutate()} disabled={refreshMut.loading}>
          <RefreshCw size={14} className={refreshMut.loading ? 'animate-spin' : ''} /> Recalculer
        </Button>
      </div>

      {/* KPIs financiers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="MRR" value={fmtFCFA(data?.mrr)} icon={<TrendingUp size={16} />} variant="success" />
        <StatCard label="ARR" value={fmtFCFA(data?.arr)} icon={<TrendingUp size={16} />} variant="success" />
        <StatCard label="Churn" value={data?.churn !== undefined ? `${Number(data.churn).toFixed(1)}%` : '—'} icon={<Users size={16} />} variant={Number(data?.churn ?? 0) > 5 ? 'danger' : 'default'} />
        <StatCard label="NRR" value={data?.nrr !== undefined ? `${Number(data.nrr).toFixed(0)}%` : '—'} icon={<TrendingUp size={16} />} variant="default" />
        <StatCard label="ARPU" value={fmtFCFA(data?.arpu)} icon={<CreditCard size={16} />} variant="default" />
        <StatCard label="LTV" value={fmtFCFA(data?.ltv)} icon={<Building2 size={16} />} variant="default" />
        <StatCard label="CAC" value={fmtFCFA(data?.cac)} icon={<Users size={16} />} variant="default" />
      </div>

      {/* Tenants */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Tenants actifs</p><p className="text-2xl font-bold text-[#0f9d70]">{data?.tenants?.actifs ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">En essai</p><p className="text-2xl font-bold text-[#f5a623]">{data?.tenants?.essai ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Résiliés</p><p className="text-2xl font-bold text-[#C0392B]">{data?.tenants?.resilie ?? 0}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Licences */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><KeyRound size={15} className="text-[#0f9d70]" /> Licences actives par plan</h3>
          {licenses.length === 0 ? (
            <p className="text-xs text-[#7a8f80] py-8 text-center">Aucune licence active</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={licenses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2e25" vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} width={30} />
                  <Tooltip cursor={{ fill: 'rgba(15,157,112,0.06)' }} {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="Licences" fill="#0f9d70" radius={[3, 3, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Options */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><CreditCard size={15} className="text-[#f5a623]" /> Options IA actives (récurrent)</h3>
          {addons.length === 0 ? (
            <p className="text-xs text-[#7a8f80] py-8 text-center">Aucune option activée</p>
          ) : (
            <div className="space-y-2">
              {addons.map(a => (
                <div key={a.name} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2.5">
                  <span className="text-sm text-[#e8ede9]">{a.name}</span>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{a.count} tenant(s)</Badge>
                    <span className="text-sm font-semibold text-[#f5a623]">{fmtFCFA(a.monthly)}/mois</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
