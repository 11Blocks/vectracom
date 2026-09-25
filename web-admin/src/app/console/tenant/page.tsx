'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, StatCard, Input, Select, Textarea, Tabs, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { tenantsService, tenantUsersApi } from '@/services';
import { UsersManager, TENANT_ROLE_OPTIONS } from '@/components/admin/UsersManager';
import { AuditTimeline } from '@/components/admin/AuditTimeline';
import {
  ArrowLeft, Building2, Users, UserCog, ClipboardList, Receipt, Power, Save, Archive, RotateCcw, LogIn,
} from 'lucide-react';
import { startSupportSession } from '@/lib/support-session';

const SUB_LABELS: Record<string, string> = {
  trial: 'Essai', active: 'Actif', retard_j1: 'Retard J+1', retard_j15: 'Retard J+15',
  retard_j20: 'Retard J+20 (lecture seule)', suspendu: 'Suspendu (J+30)', resilie: 'Résilié (J+60)',
};
const SUB_VARIANT: Record<string, string> = {
  trial: 'info', active: 'success', retard_j1: 'warning', retard_j15: 'warning',
  retard_j20: 'warning', suspendu: 'danger', resilie: 'danger',
};

const INFO_FIELDS = ['name', 'sonatelSubcontractorName', 'contactName', 'contactEmail', 'contactPhone', 'address', 'city', 'ninea', 'rccm', 'notes'] as const;

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <Content />
      </Suspense>
    </AppShell>
  );
}

function Content() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const initialTab = params.get('tab') ?? 'info';
  const { toast } = useToast();
  const [tab, setTab] = useState(initialTab);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    try { setMe(JSON.parse(localStorage.getItem('vectracom_user') || 'null')); } catch { /* ignore */ }
  }, []);
  const role: string = me?.role ?? '';
  const canManage = role === 'super_admin' || role === 'finance_admin';
  const isSuper = role === 'super_admin';

  const { data: tenant, loading, refetch, error } = useQuery(() => tenantsService.get(id), [id]);
  const usersApi = useMemo(() => tenantUsersApi(id), [id]);

  const activeMut = useMutation((active: boolean) => tenantsService.setActive(id, active), {
    onSuccess: () => { toast({ title: 'Statut mis à jour', variant: 'success' }); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const archiveMut = useMutation((archive: boolean) => archive ? tenantsService.archive(id) : tenantsService.restore(id), {
    onSuccess: () => { toast({ title: 'Tenant mis à jour', variant: 'success' }); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const impersonateMut = useMutation((tenantId: string) => tenantsService.impersonate(tenantId), {
    onSuccess: (res: any) => { startSupportSession(res); window.location.href = '/dashboard'; },
    onError: (e: Error) => toast({ title: 'Session support impossible', description: e.message, variant: 'error' }),
  });

  if (!id) return <Card className="p-8 text-center text-sm text-[#7a8f80]">Tenant non précisé</Card>;
  if (loading && !tenant) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  if (error || !tenant) {
    return (
      <Card className="p-8 text-center space-y-3">
        <p className="text-sm text-[#C0392B]">{error ?? 'Tenant introuvable'}</p>
        <Link href="/console" className="text-sm text-[#0f9d70] hover:underline">Retour à la console</Link>
      </Card>
    );
  }

  const s = tenant.stats ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/console" className="text-[#7a8f80] hover:text-[#0f9d70]" aria-label="Retour"><ArrowLeft size={18} /></Link>
          <div className="h-10 w-10 rounded-lg bg-[#0f9d70]/15 text-[#0f9d70] flex items-center justify-center text-sm font-bold">
            {(tenant.name ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
              {tenant.name}
              <Badge variant={SUB_VARIANT[tenant.subscriptionStatus] ?? 'neutral'}>{SUB_LABELS[tenant.subscriptionStatus] ?? tenant.subscriptionStatus}</Badge>
              {tenant.archivedAt ? <Badge variant="neutral">Archivé</Badge> : tenant.active ? <Badge variant="success">Actif</Badge> : <Badge variant="danger">Désactivé</Badge>}
            </h1>
            <p className="text-xs text-[#7a8f80]">
              {tenant.sonatelSubcontractorName ? `ST SONATEL : ${tenant.sonatelSubcontractorName} · ` : ''}Client depuis le {fmtDateTime(tenant.createdAt)}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {!tenant.archivedAt && (
              <Button variant={tenant.active ? 'secondary' : 'primary'} size="sm" loading={activeMut.loading}
                onClick={() => {
                  if (tenant.active && !window.confirm(`Désactiver ${tenant.name} ? Ses utilisateurs ne pourront plus se connecter.`)) return;
                  activeMut.mutate(!tenant.active);
                }}>
                <Power size={14} /> {tenant.active ? 'Désactiver' : 'Réactiver'}
              </Button>
            )}
            {isSuper && !tenant.archivedAt && (
              <Button variant="secondary" size="sm" loading={impersonateMut.loading}
                title="Ouvre l'application au nom de l'administrateur du tenant (30 min, actions tracées)"
                onClick={() => {
                  if (!window.confirm(`Ouvrir une session support chez ${tenant.name} ? Vous agirez au nom de son administrateur pendant 30 minutes ; toutes les actions sont journalisées.`)) return;
                  impersonateMut.mutate(tenant.id);
                }}>
                <LogIn size={14} /> Session support
              </Button>
            )}
            {isSuper && (
              <Button variant={tenant.archivedAt ? 'secondary' : 'danger'} size="sm" loading={archiveMut.loading}
                onClick={() => {
                  if (!tenant.archivedAt && !window.confirm(`Archiver ${tenant.name} ? Le tenant est désactivé et masqué de la liste ; ses données et factures sont conservées.`)) return;
                  archiveMut.mutate(!tenant.archivedAt);
                }}>
                {tenant.archivedAt ? <><RotateCcw size={14} /> Restaurer</> : <><Archive size={14} /> Archiver</>}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Utilisateurs actifs" value={`${s.activeUsers ?? 0} / ${s.users ?? 0}`} icon={<Users size={18} />} variant="success"
          sublabel={tenant.maxUsers ? `Plafond : ${tenant.maxUsers}` : `Dernière connexion : ${fmtDateTime(s.lastLoginAt)}`} />
        <StatCard label="Techniciens / équipes" value={`${s.technicians ?? 0} / ${s.teams ?? 0}`} icon={<UserCog size={18} />} />
        <StatCard label="Missions" value={s.missions ?? 0} icon={<ClipboardList size={18} />} />
        <StatCard label="Factures SaaS ouvertes" value={s.openSaasInvoices ?? 0} icon={<Receipt size={18} />}
          variant={s.openSaasInvoices ? 'warning' : 'default'} sublabel={s.openSaasInvoices ? fmtFCFA(s.openSaasAmount) : undefined} />
      </div>

      <Tabs
        tabs={[
          { value: 'info', label: 'Informations' },
          { value: 'users', label: 'Utilisateurs', count: s.users },
          { value: 'subscription', label: 'Abonnement' },
          { value: 'history', label: 'Historique' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'info' && <InfoTab tenant={tenant} canEdit={canManage} onSaved={refetch} />}
      {tab === 'users' && (
        <Card className="p-4">
          <UsersManager
            api={usersApi}
            roleOptions={TENANT_ROLE_OPTIONS}
            canManage={canManage}
            canResetPassword={canManage || role === 'support_admin'}
            title={`Comptes ${tenant.name}`}
            onChanged={refetch}
          />
        </Card>
      )}
      {tab === 'subscription' && <SubscriptionTab tenant={tenant} canEdit={canManage} onSaved={refetch} />}
      {tab === 'history' && (
        <Card className="p-4">
          <AuditTimeline fetcher={(p) => tenantsService.auditLogs(id, p)} deps={[id]} />
        </Card>
      )}
    </div>
  );
}

function InfoTab({ tenant, canEdit, onSaved }: { tenant: any; canEdit: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const initial = useMemo(
    () => Object.fromEntries(INFO_FIELDS.map(k => [k, tenant[k] ?? ''])) as Record<(typeof INFO_FIELDS)[number], string>,
    [tenant],
  );
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);

  const dirty = INFO_FIELDS.filter(k => (f[k] ?? '') !== (initial[k] ?? ''));
  const saveMut = useMutation((changes: any) => tenantsService.update(tenant.id, changes), {
    onSuccess: () => { toast({ title: 'Informations enregistrées', variant: 'success' }); onSaved(); },
    onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes = Object.fromEntries(dirty.map(k => [k, k === 'name' ? f[k].trim() : (f[k].trim() || null)]));
    saveMut.mutate(changes);
  };
  const field = (k: (typeof INFO_FIELDS)[number], label: string, props: Record<string, unknown> = {}) => (
    <Input label={label} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} disabled={!canEdit} {...props} />
  );

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider border-b border-[#1e2e25] pb-2 flex items-center gap-2"><Building2 size={13} /> Entreprise</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field('name', "Nom de l'entreprise *", { required: true, minLength: 2 })}
            {field('sonatelSubcontractorName', 'Nom sous-traitant SONATEL (colonne ST)')}
            {field('ninea', 'NINEA')}
            {field('rccm', 'RCCM')}
            {field('address', 'Adresse')}
            {field('city', 'Ville')}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider border-b border-[#1e2e25] pb-2">Contact principal</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {field('contactName', 'Nom du contact')}
            {field('contactEmail', 'Email du contact', { type: 'email' })}
            {field('contactPhone', 'Téléphone')}
          </div>
          <p className="text-[11px] text-[#7a8f80]">Le contact sert aux échanges commerciaux et à la facturation. Les identifiants de connexion se gèrent dans l’onglet Utilisateurs.</p>
        </div>
        <Textarea label="Notes internes Green-T" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} disabled={!canEdit} />
        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            {dirty.length > 0 && <span className="text-xs text-[#f5a623]">{dirty.length} modification(s) non enregistrée(s)</span>}
            <Button type="button" variant="secondary" disabled={!dirty.length} onClick={() => setF(initial)}>Annuler</Button>
            <Button type="submit" disabled={!dirty.length} loading={saveMut.loading}><Save size={14} /> Enregistrer</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function SubscriptionTab({ tenant, canEdit, onSaved }: { tenant: any; canEdit: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const initial = useMemo(() => ({
    subscriptionStatus: tenant.subscriptionStatus,
    subscriptionStartDate: tenant.subscriptionStartDate ?? '',
    subscriptionEndDate: tenant.subscriptionEndDate ?? '',
    trialEndDate: tenant.trialEndDate ?? '',
    onboardingPaid: Boolean(tenant.onboardingPaid),
    platformFeePaid: Boolean(tenant.platformFeePaid),
    maxUsers: tenant.maxUsers ? String(tenant.maxUsers) : '',
  }), [tenant]);
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);

  const saveMut = useMutation(async () => {
    if (f.subscriptionStatus !== initial.subscriptionStatus) {
      await tenantsService.setSubscriptionStatus(tenant.id, f.subscriptionStatus);
    }
    const changes: any = {};
    for (const k of ['subscriptionStartDate', 'subscriptionEndDate', 'trialEndDate'] as const) {
      if (f[k] !== initial[k]) changes[k] = f[k] || null;
    }
    if (f.onboardingPaid !== initial.onboardingPaid) changes.onboardingPaid = f.onboardingPaid;
    if (f.platformFeePaid !== initial.platformFeePaid) changes.platformFeePaid = f.platformFeePaid;
    if (f.maxUsers !== initial.maxUsers) changes.maxUsers = f.maxUsers ? Number(f.maxUsers) : null;
    if (Object.keys(changes).length) await tenantsService.update(tenant.id, changes);
  }, {
    onSuccess: () => { toast({ title: 'Abonnement enregistré', variant: 'success' }); onSaved(); },
    onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
  });

  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  return (
    <Card className="p-5">
      <form onSubmit={e => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select label="Statut d'abonnement" value={f.subscriptionStatus} onChange={e => setF({ ...f, subscriptionStatus: e.target.value })} disabled={!canEdit}>
            {Object.entries(SUB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Début d'abonnement" type="date" value={f.subscriptionStartDate} onChange={e => setF({ ...f, subscriptionStartDate: e.target.value })} disabled={!canEdit} />
          <Input label="Fin d'abonnement" type="date" value={f.subscriptionEndDate} onChange={e => setF({ ...f, subscriptionEndDate: e.target.value })} disabled={!canEdit} />
          <Input label="Fin de la période d'essai" type="date" value={f.trialEndDate} onChange={e => setF({ ...f, trialEndDate: e.target.value })} disabled={!canEdit} />
          <Input label="Plafond d'utilisateurs actifs" type="number" min={1} value={f.maxUsers} placeholder="Illimité"
            onChange={e => setF({ ...f, maxUsers: e.target.value })} disabled={!canEdit} />
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-[#e8ede9]">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.onboardingPaid} onChange={e => setF({ ...f, onboardingPaid: e.target.checked })} disabled={!canEdit} className="h-4 w-4 accent-[#0f9d70]" />
            Frais d'onboarding payés
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.platformFeePaid} onChange={e => setF({ ...f, platformFeePaid: e.target.checked })} disabled={!canEdit} className="h-4 w-4 accent-[#0f9d70]" />
            Frais de plateforme payés
          </label>
        </div>
        <p className="text-[11px] text-[#7a8f80]">
          Suspendu ou résilié : les utilisateurs du tenant ne peuvent plus se connecter. Retard J+20 : accès en lecture seule.
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <Link href={`/abonnements?companyId=${tenant.id}`} className="text-sm text-[#0f9d70] hover:underline">Licences & options</Link>
            <Link href={`/abonnements/facturation?companyId=${tenant.id}`} className="text-sm text-[#0f9d70] hover:underline">Factures SaaS</Link>
          </div>
          {canEdit && <Button type="submit" disabled={!dirty} loading={saveMut.loading}><Save size={14} /> Enregistrer</Button>}
        </div>
      </form>
    </Card>
  );
}
