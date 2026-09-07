'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, StatCard, Input, Select, ConfirmDialog, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { saasService, techniciansService } from '@/services';
import {
  CreditCard, Smartphone, MonitorSmartphone, Bot, MapPin, Mic, Eye, EyeOff,
  Plus, Ban, Loader2, Gauge, Activity, Users, CheckCircle2, Sparkles,
} from 'lucide-react';

const PLANS = [
  { code: 'MOBILE', label: 'Licence Mobile', price: '10 000 FCFA/mois', icon: Smartphone, desc: 'Technicien terrain' },
  { code: 'WEB', label: 'Licence Web', price: '25 000 FCFA/mois', icon: MonitorSmartphone, desc: 'Admin, direction, magasinier' },
  { code: 'RAG', label: 'Dashboard RAG', price: '15 000 FCFA/mois', icon: Bot, desc: 'Assistant IA direction' },
  { code: 'GEOLOCATION', label: 'Géolocalisation', price: '5 000 FCFA/mois', icon: MapPin, desc: 'Vue cartographique équipes' },
] as const;

const ADDONS = [
  { code: 'ia_vision', label: 'IA Vision', price: '50 000 FCFA/mois', icon: Eye, desc: 'Détection automatique PIO/PBO/Chambre' },
  { code: 'pre_audit', label: 'Pré-audit photos', price: '20 000 FCFA/mois', icon: Sparkles, desc: 'Audit IA des photos terrain' },
  { code: 'agent_planning', label: 'Agent planning', price: '30 000 FCFA/mois', icon: Bot, desc: 'Suggestions d’affectation automatiques' },
  { code: 'voice', label: 'Commande vocale', price: '10 000 FCFA/mois', icon: Mic, desc: 'Saisie mains libres terrain' },
] as const;

function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState('licenses');
  const [showAssign, setShowAssign] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null);

  const month = new Date().toISOString().slice(0, 7);
  const { data: licenses, loading, refetch } = useQuery(() => saasService.listLicenses(), []);
  const { data: addons, refetch: refetchAddons } = useQuery(() => saasService.getAddons(), []);
  const { data: limits, refetch: refetchLimits } = useQuery(() => saasService.getLimits(), []);
  const { data: usage } = useQuery(() => saasService.getUsage(month), [month]);
  const { data: techsData } = useQuery(() => techniciansService.list(), []);
  const techs = Array.isArray(techsData) ? techsData : [];

  const licList = Array.isArray(licenses) ? licenses : [];
  const addonList = Array.isArray(addons) ? addons : [];
  const activeCount = licList.filter(l => l.status === 'active').length;
  const monthlyTotal = licList.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.amount ?? 0), 0);

  const revokeMut = useMutation((userId: string) => saasService.revokeLicense(userId), {
    onSuccess: () => { toast({ title: 'Licence révoquée', variant: 'success' }); setRevokeTarget(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const addonMut = useMutation(({ code, activate }: any) =>
    activate ? saasService.activateAddon(code) : saasService.deactivateAddon(code), {
    onSuccess: (_d: any) => { toast({ title: 'Option mise à jour', variant: 'success' }); refetchAddons(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const assignMut = useMutation((d: any) => saasService.assignLicense(d.userId, d.planCode), {
    onSuccess: () => { toast({ title: 'Licence attribuée', variant: 'success' }); setShowAssign(false); refetch(); },
    onError: (e: any) => toast({ title: 'Attribution impossible', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><CreditCard size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Abonnements & Licences</h1>
            <p className="text-xs text-[#7a8f80]">Gestion des licences par utilisateur et des options IA</p>
          </div>
        </div>
        <Button onClick={() => setShowAssign(true)}><Plus size={16} /> Attribuer une licence</Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Licences actives" value={activeCount} icon={<CheckCircle2 size={18} />} variant="success" />
        <StatCard label="Total licences" value={licList.length} icon={<Users size={18} />} variant="default" />
        <StatCard label="Coût mensuel" value={fmtFCFA(monthlyTotal)} icon={<CreditCard size={18} />} variant="default" />
        <StatCard label="Options actives" value={addonList.filter((a: any) => a.isActive).length + '/' + ADDONS.length} icon={<Sparkles size={18} />} variant="ai" />
      </div>

      <Tabs
        tabs={[
          { value: 'licenses', label: 'Licences', count: licList.length },
          { value: 'addons', label: 'Options IA' },
          { value: 'limits', label: 'Limites & Usage' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ── ONGLET LICENCES ── */}
      {tab === 'licenses' && (
        loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        : licList.length === 0 ? (
          <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
            <CreditCard size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
            <p className="text-sm text-[#7a8f80] mb-4">Aucune licence attribuée</p>
            <Button onClick={() => setShowAssign(true)}><Plus size={15} /> Attribuer une première licence</Button>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2e25] bg-[#111916]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Cycle</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Début</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                {licList.map(l => {
                  const plan = PLANS.find(p => p.code === l.planCode);
                  return (
                    <tr key={l.id} className="hover:bg-[#172019] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#e8ede9]">{l.user?.fullName ?? l.user?.email ?? '—'}</p>
                        {l.user?.email && l.user?.fullName && <p className="text-xs text-[#7a8f80]">{l.user.email}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge className="bg-[#1a2420] text-[#e8ede9] border-[#1e2e25]">{plan?.label ?? l.planCode}</Badge></td>
                      <td className="px-4 py-3 text-[#7a8f80]">{l.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'}</td>
                      <td className="px-4 py-3 text-right text-[#e8ede9] font-semibold">{fmtFCFA(l.amount)}</td>
                      <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(l.startDate)}</td>
                      <td className="px-4 py-3">
                        <Badge className={l.status === 'active'
                          ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30'
                          : 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30'}>
                          {l.status === 'active' ? 'Active' : l.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs text-[#7a8f80] hover:text-[#C0392B]"
                          onClick={() => setRevokeTarget(l)} disabled={l.status !== 'active'}>
                          <Ban size={13} /> Révoquer
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── ONGLET OPTIONS ── */}
      {tab === 'addons' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ADDONS.map(a => {
            const state = addonList.find((x: any) => x.addonType === a.code);
            const isActive = !!state?.isActive;
            const Icon = a.icon;
            return (
              <Card key={a.code} className={'p-4 ' + (isActive ? 'border-[#f5a623]/40' : 'border-[#1e2e25]')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={'p-2 rounded-lg ' + (isActive ? 'bg-[#f5a623]/15 text-[#f5a623]' : 'bg-[#1a2420] text-[#7a8f80]')}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#e8ede9]">{a.label}</p>
                      <p className="text-xs text-[#7a8f80] mt-0.5">{a.desc}</p>
                      <p className="text-xs text-[#7a8f80] mt-1">{a.price}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={isActive ? 'outline' : 'ai'} disabled={addonMut.loading}
                    onClick={() => addonMut.mutate({ code: a.code, activate: !isActive })}>
                    {isActive ? <><EyeOff size={13} /> Désactiver</> : <><Eye size={13} /> Activer</>}
                  </Button>
                </div>
                {isActive && (
                  <p className="mt-3 text-xs text-[#f5a623] flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> Option active — facturée mensuellement
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── ONGLET LIMITES ── */}
      {tab === 'limits' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-[#1e2e25] bg-[#111916] p-5">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><Gauge size={15} className="text-[#0f9d70]" /> Limites du plan</h3>
            {limits ? (
              <div className="space-y-2.5 text-sm">
                {Object.entries(limits).filter(([k]) => !['id', 'companyId', 'createdAt', 'updatedAt', 'company'].includes(k)).map(([k, v]: [string, any]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[#7a8f80] capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                    <span className="text-[#e8ede9] font-medium">{v === null ? '∞' : String(v)}</span>
                  </div>
                ))}
              </div>
            ) : <Skeleton className="h-40" />}
          </Card>
          <Card className="border-[#1e2e25] bg-[#111916] p-5">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><Activity size={15} className="text-[#0f9d70]" /> Usage du mois ({month})</h3>
            {usage ? (
              <div className="space-y-2.5 text-sm">
                {Object.entries(usage).filter(([k]) => !['id', 'companyId', 'month', 'createdAt', 'updatedAt', 'company'].includes(k)).map(([k, v]: [string, any]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[#7a8f80] capitalize">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                    <span className="text-[#e8ede9] font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : <Skeleton className="h-40" />}
          </Card>
        </div>
      )}

      {/* Modal attribution */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Attribuer une licence">
        <AssignForm techs={techs} licensedUserIds={licList.map(l => l.userId)} loading={assignMut.loading}
          onSubmit={d => assignMut.mutate(d)} onCancel={() => setShowAssign(false)} />
      </Modal>

      <ConfirmDialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Révoquer la licence"
        message={revokeTarget ? `La licence ${revokeTarget.planCode} de ${revokeTarget.user?.fullName ?? 'cet utilisateur'} sera révoquée immédiatement.` : ''}
        confirmText="Révoquer" danger
        onConfirm={() => revokeTarget && revokeMut.mutate(revokeTarget.userId)} />
    </div>
  );
}

function AssignForm({ techs, licensedUserIds, loading, onSubmit, onCancel }: {
  techs: any[]; licensedUserIds: string[]; loading: boolean;
  onSubmit: (d: any) => void; onCancel: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [planCode, setPlanCode] = useState('MOBILE');

  const candidates = techs.filter(t => t.userId && !licensedUserIds.includes(t.userId));

  return (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); onSubmit({ userId, planCode }); }}>
      <div>
        <p className="text-xs text-[#7a8f80] mb-1.5">Utilisateur (techniciens avec compte, sans licence) *</p>
        {candidates.length > 0 ? (
          <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
            {candidates.map(t => (
              <button key={t.id} type="button" onClick={() => setUserId(t.userId)}
                className={
                  'rounded-lg border px-3 py-2 text-left text-sm transition-all ' +
                  (userId === t.userId ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#e8ede9] hover:border-[#0f9d70]/40')
                }>
                {t.fullName}
                <span className="text-xs text-[#7a8f80] ml-2">— compte lié</span>
              </button>
            ))}
          </div>
        ) : (
          <Input label="ID utilisateur (UUID)" value={userId} onChange={e => setUserId(e.target.value)}
            placeholder="Aucun technicien éligible — collez un UUID" />
        )}
      </div>
      <Select label="Plan *" value={planCode} onChange={e => setPlanCode(e.target.value)}>
        {PLANS.map(p => <option key={p.code} value={p.code}>{p.label} — {p.price}</option>)}
      </Select>
      <p className="text-xs text-[#7a8f80]">La licence démarre aujourd'hui, en facturation mensuelle.</p>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={!userId || loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Attribuer
        </Button>
      </div>
    </form>
  );
}
