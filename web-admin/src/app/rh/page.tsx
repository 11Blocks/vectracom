'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, StatCard, Input, Select, Textarea, ConfirmDialog, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { hrService, teamsService } from '@/services';
import { api } from '@/lib/api';
import {
  Plus, Search, Edit, Trash2, Eye, Loader2, Users, CalendarDays, CheckCircle2, XCircle,
  Hourglass, CalendarOff, FileBadge, CalendarX2, UserCheck, UserMinus, ChevronLeft,
} from 'lucide-react';

const LEAVE_LABELS: Record<string, string> = {
  en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé',
};
const EMP_STATUS: Record<string, string> = { actif: 'Actif', en_conge: 'En congé' };

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState('employees');

  // ── Congés : compteurs pour les onglets ──
  const { data: leavesAll } = useQuery(() => hrService.listLeaves(), []);
  const leaves = Array.isArray(leavesAll) ? leavesAll : [];
  const pendingLeaves = leaves.filter((l: any) => l.status === 'en_attente');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Users size={20} /></span>
          <h1 className="text-xl font-bold text-[#e8ede9]">Ressources Humaines</h1>
        </div>
        <Link href="/rh/presence" className="text-sm text-[#0f9d70] hover:underline flex items-center gap-1">
          <CalendarDays size={14} /> Feuille de présence hebdomadaire <ChevronLeft size={14} className="rotate-180" />
        </Link>
      </div>

      <Tabs
        tabs={[
          { value: 'employees', label: 'Employés' },
          { value: 'leaves', label: 'Congés', count: pendingLeaves.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'employees' ? <EmployeesTab toast={toast} /> : <LeavesTab toast={toast} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ONGLET EMPLOYÉS — CRUD complet
// ═══════════════════════════════════════════════════════════
function EmployeesTab({ toast }: { toast: any }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState<Record<string, any>>({ fullName: '', jobTitle: '', matricule: '', status: 'actif', habilitationExpiration: '', teamId: '' });

  const { data, loading, refetch } = useQuery(
    () => hrService.listEmployees(statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  );
  const { data: teams } = useQuery(() => teamsService.list(), []);
  const teamsList = Array.isArray(teams) ? teams : [];

  const employees = Array.isArray(data) ? data : [];
  const list = employees.filter((e: any) =>
    !search || [e.fullName, e.jobTitle, e.matricule].some(v => (v || '').toLowerCase().includes(search.toLowerCase())),
  );

  const createMut = useMutation((d: any) => hrService.createEmployee(d), {
    onSuccess: () => { toast({ title: 'Employé créé', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const updateMut = useMutation(({ id, d }: any) => hrService.updateEmployee(id, d), {
    onSuccess: () => { toast({ title: 'Employé mis à jour', variant: 'success' }); setEditId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const deleteMut = useMutation((id: string) => hrService.deleteEmployee(id), {
    onSuccess: () => { toast({ title: 'Employé supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const openEdit = (emp: any) => {
    setForm({
      fullName: emp.fullName ?? '', jobTitle: emp.jobTitle ?? '', matricule: emp.matricule ?? '',
      status: emp.status ?? 'actif', habilitationExpiration: emp.habilitationExpiration?.slice(0, 10) ?? '',
      teamId: emp.teamId ?? '',
    });
    setEditId(emp.id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.teamId) delete payload.teamId;
    if (!payload.habilitationExpiration) delete payload.habilitationExpiration;
    if (editId) updateMut.mutate({ id: editId, d: payload });
    else createMut.mutate(payload);
  };

  const habilitationSoon = (d?: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff < 60;
  };

  const teamName = (id?: string | null) => teamsList.find((t: any) => t.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total employés" value={employees.length} icon={<Users size={18} />} variant="success" />
        <StatCard label="Actifs" value={employees.filter((e: any) => e.status === 'actif').length} icon={<UserCheck size={18} />} variant="success" />
        <StatCard label="En congé" value={employees.filter((e: any) => e.status === 'en_conge').length} icon={<UserMinus size={18} />} variant="warning" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input
            type="text" placeholder="Rechercher un employé…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="en_conge">En congé</option>
        </Select>
        <Button onClick={() => { setForm({ fullName: '', jobTitle: '', matricule: '', status: 'actif', habilitationExpiration: '', teamId: '' }); setShowCreate(true); }}>
          <Plus size={16} /> Nouvel employé
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Users size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucun employé trouvé</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Fonction</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Matricule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Habilitation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => setDetail(emp)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#0f9d70]/15 text-[#0f9d70] flex items-center justify-center text-xs font-bold">
                        {(emp.fullName || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </div>
                      <span className="font-medium text-[#e8ede9]">{emp.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#7a8f80]">{emp.jobTitle ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7a8f80] font-mono text-xs">{emp.matricule ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">{teamName(emp.teamId)}</td>
                  <td className="px-4 py-3">
                    {emp.habilitationExpiration ? (
                      <span className={habilitationSoon(emp.habilitationExpiration) ? 'text-[#D9822B]' : 'text-[#7a8f80]'}>
                        {fmtDate(emp.habilitationExpiration)}
                      </span>
                    ) : <span className="text-[#7a8f80]/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={emp.status === 'actif'
                      ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30'
                      : 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30'}>
                      {EMP_STATUS[emp.status] ?? emp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setDetail(emp)} title="Détails"><Eye size={14} /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => openEdit(emp)} title="Modifier"><Edit size={14} /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(emp.id)} title="Supprimer"><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Création / Édition */}
      <Modal open={showCreate || !!editId} onClose={() => { setShowCreate(false); setEditId(null); }}
        title={editId ? 'Modifier l’employé' : 'Nouvel employé'} size="lg">
        <form onSubmit={submit} className="space-y-3">
          <Input label="Nom complet *" value={String(form.fullName ?? '')} onChange={e => setForm({ ...form, fullName: e.target.value })} required placeholder="Ndiaye Moussa" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fonction" value={String(form.jobTitle ?? '')} onChange={e => setForm({ ...form, jobTitle: e.target.value })} placeholder="Technicien FTTH" />
            <Input label="Matricule" value={String(form.matricule ?? '')} onChange={e => setForm({ ...form, matricule: e.target.value })} placeholder="EMP-001" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Équipe" value={String(form.teamId ?? '')} onChange={e => setForm({ ...form, teamId: e.target.value })}>
              <option value="">— Aucune —</option>
              {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select label="Statut" value={String(form.status ?? 'actif')} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="actif">Actif</option>
              <option value="en_conge">En congé</option>
            </Select>
            <Input label="Habilitation (expiration)" type="date" value={String(form.habilitationExpiration ?? '')} onChange={e => setForm({ ...form, habilitationExpiration: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setEditId(null); }}>Annuler</Button>
            <Button type="submit" disabled={createMut.loading || updateMut.loading}>
              {(createMut.loading || updateMut.loading) && <Loader2 size={14} className="animate-spin" />}
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Détail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.fullName ?? ''} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#7a8f80] text-xs block">Fonction</span><span className="text-[#e8ede9]">{detail.jobTitle ?? '—'}</span></div>
              <div><span className="text-[#7a8f80] text-xs block">Matricule</span><span className="text-[#e8ede9] font-mono">{detail.matricule ?? '—'}</span></div>
              <div><span className="text-[#7a8f80] text-xs block">Équipe</span><span className="text-[#e8ede9]">{teamName(detail.teamId)}</span></div>
              <div><span className="text-[#7a8f80] text-xs block">Statut</span>
                <Badge className={detail.status === 'actif' ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' : 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30'}>
                  {EMP_STATUS[detail.status] ?? detail.status}
                </Badge>
              </div>
              <div><span className="text-[#7a8f80] text-xs block">Habilitation</span><span className="text-[#e8ede9]">{fmtDate(detail.habilitationExpiration)}</span></div>
              <div><span className="text-[#7a8f80] text-xs block">Créé le</span><span className="text-[#e8ede9]">{fmtDate(detail.createdAt)}</span></div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide mb-2 flex items-center gap-1.5"><FileBadge size={14} /> Documents ({(detail.documents ?? []).length})</h4>
              {(detail.documents ?? []).length === 0 ? (
                <p className="text-xs text-[#7a8f80]/60">Aucun document rattaché.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.documents.map((doc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                      <span className="text-sm text-[#e8ede9]">{doc.type}</span>
                      {doc.expirationDate && <span className="text-xs text-[#7a8f80]">exp. {fmtDate(doc.expirationDate)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer l’employé"
        message="Cette action est irréversible. Les demandes de congé liées seront également supprimées."
        confirmText="Supprimer" danger onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ONGLET CONGÉS — création, approbation, refus
// ═══════════════════════════════════════════════════════════
function LeavesTab({ toast }: { toast: any }) {
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [refuseId, setRefuseId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ employeeId: '', startDate: '', endDate: '', reason: '' });

  const { data, loading, refetch } = useQuery(
    () => hrService.listLeaves(statusFilter ? { status: statusFilter } : undefined),
    [statusFilter],
  );
  const { data: employees } = useQuery(() => hrService.listEmployees(), []);
  const empList = Array.isArray(employees) ? employees : [];
  const empName = (id: string) => empList.find((e: any) => e.id === id)?.fullName ?? 'Employé supprimé';

  const leaves = Array.isArray(data) ? data : [];

  const createMut = useMutation((d: any) => hrService.createLeave(d), {
    onSuccess: () => { toast({ title: 'Demande de congé créée', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const approveMut = useMutation((id: string) => hrService.approveLeave(id), {
    onSuccess: () => { toast({ title: 'Congé approuvé', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const refuseMut = useMutation((id: string) => hrService.refuseLeave(id), {
    onSuccess: () => { toast({ title: 'Congé refusé', variant: 'warning' }); setRefuseId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label="Demandes" value={leaves.length} icon={<CalendarDays size={18} />} variant="success" />
        <StatCard label="En attente" value={leaves.filter((l: any) => l.status === 'en_attente').length} icon={<Hourglass size={18} />} variant="warning" />
        <StatCard label="Approuvées" value={leaves.filter((l: any) => l.status === 'approuve').length} icon={<CheckCircle2 size={18} />} variant="success" />
        <StatCard label="Refusées" value={leaves.filter((l: any) => l.status === 'refuse').length} icon={<XCircle size={18} />} variant="danger" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvés</option>
          <option value="refuse">Refusés</option>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => { setForm({ employeeId: '', startDate: '', endDate: '', reason: '' }); setShowCreate(true); }}>
          <Plus size={16} /> Nouvelle demande
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : leaves.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <CalendarOff size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucune demande de congé</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Du</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Au</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Durée</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Motif</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {leaves.map((lv: any) => (
                <tr key={lv.id} className="hover:bg-[#172019] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#0f9d70]/15 text-[#0f9d70] flex items-center justify-center text-[10px] font-bold">
                        {empName(lv.employeeId).split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </div>
                      <span className="font-medium text-[#e8ede9]">{empName(lv.employeeId)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(lv.startDate)}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(lv.endDate)}</td>
                  <td className="px-4 py-3">
                    <Badge>{daysBetween(lv.startDate, lv.endDate)} j</Badge>
                  </td>
                  <td className="px-4 py-3 text-[#7a8f80] max-w-48 truncate" title={lv.reason ?? ''}>{lv.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={
                      lv.status === 'approuve' ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' :
                      lv.status === 'refuse' ? 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' :
                      'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30'
                    }>{LEAVE_LABELS[lv.status] ?? lv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lv.status === 'en_attente' ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={() => approveMut.mutate(lv.id)} className="h-8 px-2.5 text-xs">
                          <CheckCircle2 size={14} /> Approuver
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRefuseId(lv.id)} className="h-8 px-2.5 text-xs">
                          <XCircle size={14} /> Refuser
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#7a8f80]/60">Décision rendue</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle demande de congé">
        <form onSubmit={submit} className="space-y-3">
          <Select label="Employé *" value={String(form.employeeId ?? '')} onChange={e => setForm({ ...form, employeeId: e.target.value })} required>
            <option value="">— Sélectionner —</option>
            {empList.map((e: any) => <option key={e.id} value={e.id}>{e.fullName}{e.matricule ? ` (${e.matricule})` : ''}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de début *" type="date" value={String(form.startDate ?? '')} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
            <Input label="Date de fin *" type="date" min={String(form.startDate ?? '')} value={String(form.endDate ?? '')} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
          </div>
          {form.startDate && form.endDate && (
            <p className="text-xs text-[#0f9d70]">Durée : {daysBetween(form.startDate, form.endDate)} jour(s)</p>
          )}
          <Textarea label="Motif (optionnel)" value={String(form.reason ?? '')} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Congé annuel…" />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" disabled={createMut.loading}>
              {createMut.loading && <Loader2 size={14} className="animate-spin" />} Créer la demande
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!refuseId} onClose={() => setRefuseId(null)} title="Refuser ce congé"
        message="L'employé sera notifié du refus. Cette décision reste modifiable via une nouvelle demande."
        confirmText="Refuser" danger onConfirm={() => refuseId && refuseMut.mutate(refuseId)} />
    </div>
  );
}
