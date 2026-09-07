'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, StatCard, Input, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { tenantsService, businessService } from '@/services';
import {
  Building2, Plus, Loader2, Search, CheckCircle2, XCircle, Power,
  ShieldCheck, ShieldAlert, ShieldX, TrendingUp, CreditCard, ArrowRight,
} from 'lucide-react';

const SUB_META: Record<string, { label: string; cls: string; icon: any }> = {
  trial: { label: 'Essai', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30', icon: ShieldCheck },
  active: { label: 'Actif', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30', icon: ShieldCheck },
  retard_j1: { label: 'Retard J+1', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30', icon: ShieldAlert },
  retard_j15: { label: 'Retard J+15', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30', icon: ShieldAlert },
  retard_j20: { label: 'Retard J+20 (lecture seule)', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', icon: ShieldAlert },
  suspendu: { label: 'Suspendu (J+30)', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', icon: ShieldX },
  resilie: { label: 'Résilié (J+60)', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30', icon: ShieldX },
};
const SUB_STATUSES = Object.keys(SUB_META);

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data, loading, refetch } = useQuery(() => tenantsService.list(), []);
  const { data: biz } = useQuery(() => businessService.dashboard(), []);
  const tenants = Array.isArray(data) ? data : [];
  const list = tenants.filter(t =>
    !search || (t.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const createMut = useMutation((d: any) => tenantsService.create(d), {
    onSuccess: () => { toast({ title: 'Tenant créé', description: 'Compte admin initialisé', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });
  const activeMut = useMutation(({ id, active }: any) => tenantsService.setActive(id, active), {
    onSuccess: () => { toast({ title: 'Statut mis à jour', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const statusMut = useMutation(({ id, status }: any) => tenantsService.setSubscriptionStatus(id, status), {
    onSuccess: () => { toast({ title: 'Abonnement mis à jour', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Building2 size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Console Green-T</h1>
            <p className="text-xs text-[#7a8f80]">Gestion multi-tenant de la plateforme VECTRACOM</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Créer un tenant</Button>
      </div>

      {/* KPI business */}
      {biz && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Tenants" value={tenants.length} icon={<Building2 size={18} />} variant="default" />
          <StatCard label="Abonnements actifs" value={tenants.filter(t => t.subscriptionStatus === 'active').length} icon={<ShieldCheck size={18} />} variant="success" />
          <StatCard label="MRR" value={biz.mrr !== undefined ? fmtFCFA(biz.mrr) : '—'} icon={<TrendingUp size={18} />} variant="success" />
          <StatCard label="ARR" value={biz.arr !== undefined ? fmtFCFA(biz.arr) : '—'} icon={<TrendingUp size={18} />} variant="success" />
        </div>
      )}

      {/* Barre de filtre */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input type="text" placeholder="Rechercher un tenant…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
        </div>
        <Link href="/monitoring/business" className="text-sm text-[#0f9d70] hover:underline flex items-center gap-1">
          Métriques business <ArrowRight size={14} />
        </Link>
      </div>

      {/* Table des tenants */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Building2 size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucun tenant</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Entreprise</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut abonnement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Changer le statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Onboarding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Créé le</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map(t => {
                const meta = SUB_META[t.subscriptionStatus] ?? { label: t.subscriptionStatus, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
                return (
                  <tr key={t.id} className="hover:bg-[#172019] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[#0f9d70]/15 text-[#0f9d70] flex items-center justify-center text-xs font-bold">
                          {(t.name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[#e8ede9]">{t.name}</p>
                          {t.sonatelSubcontractorName && <p className="text-xs text-[#7a8f80]">ST : {t.sonatelSubcontractorName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge className={meta.cls}>{meta.label}</Badge></td>
                    <td className="px-4 py-3">
                      <select
                        value={t.subscriptionStatus}
                        onChange={e => statusMut.mutate({ id: t.id, status: e.target.value })}
                        disabled={statusMut.loading}
                        className="h-8 rounded-md bg-[#0a0f0d] border border-[#1e2e25] px-2 text-xs text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
                      >
                        {SUB_STATUSES.map(s => <option key={s} value={s}>{SUB_META[s].label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {t.onboardingPaid
                        ? <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30"><CheckCircle2 size={11} className="mr-1" /> Payé</Badge>
                        : <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]"><CreditCard size={11} className="mr-1" /> Non payé</Badge>}
                    </td>
                    <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => activeMut.mutate({ id: t.id, active: !t.active })}
                        title={t.active ? 'Désactiver le tenant' : 'Réactiver le tenant'}
                        className={
                          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ' +
                          (t.active
                            ? 'border-[#0f9d70]/30 text-[#0f9d70] hover:bg-[#0f9d70]/10'
                            : 'border-[#C0392B]/30 text-[#C0392B] hover:bg-[#C0392B]/10')
                        }
                      >
                        <Power size={12} /> {t.active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rappel du workflow de blocage */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <p className="text-xs text-[#7a8f80] mb-2 font-semibold uppercase tracking-wide">Workflow de blocage progressif</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            ['J+0', 'Facture due', '#7a8f80'],
            ['J+1', 'Relance', '#f5a623'],
            ['J+15', '2e relance', '#f5a623'],
            ['J+20', 'Lecture seule', '#D9822B'],
            ['J+30', 'Suspendu', '#D9822B'],
            ['J+60', 'Résilié', '#C0392B'],
          ].map(([j, label, color], i) => (
            <span key={j} className="flex items-center gap-2">
              {i > 0 && <span className="text-[#1e2e25]">→</span>}
              <span className="rounded-full border px-2.5 py-1" style={{ borderColor: color + '55', color }}>
                <b>{j}</b> · {label}
              </span>
            </span>
          ))}
        </div>
      </Card>

      {/* Création de tenant */}
      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} loading={createMut.loading} onSubmit={d => createMut.mutate(d)} />
    </div>
  );
}

function CreateTenantModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean; onSubmit: (d: any) => void;
}) {
  const [f, setF] = useState({
    companyName: '', sonatelSubcontractorName: '', adminFullName: '',
    adminEmail: '', adminPassword: '', onboardingPaid: false,
  });
  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setF(p => ({ ...p, adminPassword: pwd }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Créer un nouveau tenant" size="lg">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); onSubmit(f); }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom de l'entreprise *" value={f.companyName} onChange={e => setF({ ...f, companyName: e.target.value })} required placeholder="3STB" />
          <Input label="Nom sous-traitant SONATEL" value={f.sonatelSubcontractorName} onChange={e => setF({ ...f, sonatelSubcontractorName: e.target.value })} placeholder="3STB (colonne ST)" />
        </div>
        <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wide pt-1">Compte administrateur initial</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom complet *" value={f.adminFullName} onChange={e => setF({ ...f, adminFullName: e.target.value })} required placeholder="Diop Amadou" />
          <Input label="Email *" type="email" value={f.adminEmail} onChange={e => setF({ ...f, adminEmail: e.target.value })} required placeholder="admin@3stb.sn" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Input label="Mot de passe (min. 8) *" type="text" value={f.adminPassword} onChange={e => setF({ ...f, adminPassword: e.target.value })} required minLength={8} placeholder="••••••••" />
          <Button type="button" variant="secondary" onClick={genPassword}>Générer</Button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[#e8ede9]">
          <input type="checkbox" checked={f.onboardingPaid} onChange={e => setF({ ...f, onboardingPaid: e.target.checked })}
            className="h-4 w-4 rounded border-[#1e2e25] bg-[#0a0f0d] accent-[#0f9d70]" />
          Frais d'onboarding payés (500 000 FCFA)
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />} Créer le tenant
          </Button>
        </div>
      </form>
    </Modal>
  );
}
