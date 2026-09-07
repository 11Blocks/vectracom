'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { dailyWorkersService, teamsService } from '@/services';
import {
  UserCog, Plus, Loader2, Trash2, ChevronLeft, Clock, CalendarDays, Users, Edit,
} from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editWorker, setEditWorker] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [timesheetOpen, setTimesheetOpen] = useState(false);

  const { data, loading, refetch } = useQuery(() => dailyWorkersService.list(), []);
  const { data: teams } = useQuery(() => teamsService.list(), []);
  const teamsList = Array.isArray(teams) ? teams : [];
  const teamName = (id: string) => teamsList.find((t: any) => t.id === id)?.name ?? '—';

  const list = Array.isArray(data) ? data : [];

  const deleteMut = useMutation((id: string) => dailyWorkersService.remove(id), {
    onSuccess: () => { toast({ title: 'Journalier supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-1">
            <ChevronLeft size={14} /> RH
          </button>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><UserCog size={20} className="text-[#0f9d70]" /> Journaliers</h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {list.length} journalier(s) — équipes déploiement (chef + 5-6 journaliers), pointage chantier et salaires à la journée
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTimesheetOpen(true)}><CalendarDays size={15} /> État salaires</Button>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<Users size={40} className="text-[#7a8f80]/50" />}
            title="Aucun journalier"
            description="Ajoutez les journaliers des équipes déploiement — pointés quotidiennement sur chantier, salariés à la journée."
            action={<Button onClick={() => setShowCreate(true)}><Plus size={15} /> Premier journalier</Button>} />
        </Card>
      ) : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="divide-y divide-[#1e2e25]/50">
            {list.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9]">{w.fullName}</p>
                    <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{teamName(w.teamId)}</Badge>
                    {!w.active && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30 text-[10px]">inactif</Badge>}
                  </div>
                  <p className="text-[10px] text-[#7a8f80] mt-0.5">
                    {w.phone ?? '—'} · salaire {Number(w.dailyRate).toLocaleString('fr-FR')} F/jour
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditWorker(w)} title="Modifier">
                    <Edit size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(w.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CreateWorkerModal open={showCreate} teams={teamsList} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      <EditWorkerModal worker={editWorker} onClose={() => setEditWorker(null)} onDone={() => { setEditWorker(null); refetch(); }} />
      <TimesheetModal open={timesheetOpen} onClose={() => setTimesheetOpen(false)} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le journalier"
        message="Ses pointages seront conservés en historique." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function CreateWorkerModal({ open, teams, onClose, onDone }: { open: boolean; teams: any[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ fullName: '', teamId: '', phone: '', dailyRate: '' });

  const mut = useMutation(
    () => dailyWorkersService.create({
      fullName: f.fullName,
      teamId: f.teamId,
      phone: f.phone || undefined,
      dailyRate: f.dailyRate ? Number(f.dailyRate) : undefined,
    }),
    {
      onSuccess: () => { toast({ title: 'Journalier ajouté', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title="Nouveau journalier">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Nom complet *" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} required placeholder="Ibrahima Ndiaye" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Équipe *" value={f.teamId} onChange={e => setF({ ...f, teamId: e.target.value })} required>
            <option value="">— Sélectionner —</option>
            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Salaire / jour (F)" type="number" value={f.dailyRate} onChange={e => setF({ ...f, dailyRate: e.target.value })} placeholder="3500" />
        </div>
        <Input label="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.fullName.trim() || !f.teamId}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditWorkerModal({ worker, onClose, onDone }: { worker: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ phone: '', dailyRate: '', active: true });

  useEffect(() => {
    if (worker) {
      setF({
        phone: worker.phone ?? '',
        dailyRate: worker.dailyRate != null ? String(worker.dailyRate) : '',
        active: worker.active !== false,
      });
    }
  }, [worker]);

  const mut = useMutation(
    () => dailyWorkersService.update(worker.id, {
      phone: f.phone || undefined,
      dailyRate: f.dailyRate !== '' ? Number(f.dailyRate) : undefined,
      active: f.active,
    }),
    {
      onSuccess: () => { toast({ title: 'Journalier mis à jour', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Mise à jour impossible', description: e.message, variant: 'error' }),
    },
  );

  if (!worker) return null;

  return (
    <Modal open={!!worker} onClose={onClose} title={`Modifier — ${worker.fullName}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        <Input label="Salaire / jour (F)" type="number" value={f.dailyRate} onChange={e => setF({ ...f, dailyRate: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-[#e8ede9] cursor-pointer">
          <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-[#0f9d70]" />
          Actif
        </label>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function TimesheetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, loading } = useQuery(
    () => open ? dailyWorkersService.timesheet(from, to) : Promise.resolve(null),
    [from, to, open],
    { immediate: false },
  );
  const rows = (Array.isArray(data) ? data : []) as any[];

  const clockMut = useMutation(
    () => dailyWorkersService.clockIn(
      Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
      today,
    ),
    {
      onSuccess: (res: any) => {
        // recharge via refetch du useQuery — simplification : fermeture/rouverture
        window.location.reload();
      },
      onError: (e: Error) => window.alert('Pointage impossible : ' + e.message),
    },
  );
  void clockMut;

  const totalDue = rows.reduce((s, r) => s + r.salaryDue, 0);

  return (
    <Modal open={open} onClose={onClose} title="État des salaires — journaliers" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Du" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input label="Au" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {loading ? <Skeleton className="h-32" /> : rows.length === 0 ? (
          <p className="text-xs text-[#7a8f80]/70 py-4 text-center">Aucun journalier sur la période.</p>
        ) : (
          <>
            <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 overflow-hidden">
              {rows.map((r: any) => (
                <label key={r.dailyWorkerId} className="flex items-center gap-3 px-3 py-2 hover:bg-[#172019] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!selected[r.dailyWorkerId]}
                    onChange={e => setSelected(p => ({ ...p, [r.dailyWorkerId]: e.target.checked }))}
                    className="accent-[#0f9d70]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#e8ede9] truncate">{r.fullName}</p>
                    <p className="text-[10px] text-[#7a8f80]">{Number(r.dailyRate).toLocaleString('fr-FR')} F/jour</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-[#e8ede9] tabular-nums flex items-center gap-1 justify-end"><Clock size={11} /> {r.days} j</p>
                    <p className="text-xs text-[#D9822B] tabular-nums">{r.salaryDue.toLocaleString('fr-FR')} F</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#7a8f80]">Total dû sur la période : <b className="text-[#e8ede9]">{totalDue.toLocaleString('fr-FR')} F</b></p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
