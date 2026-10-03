'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, ConfirmDialog, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { expensesService, teamsService } from '@/services';
import { Wallet, Loader2, Plus, Pencil, Trash2, Fuel, Utensils, BedDouble, CalendarDays, Receipt } from 'lucide-react';

const TYPE_META: Record<string, { label: string; cls: string; icon: any }> = {
  carburant: { label: 'Carburant', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30', icon: Fuel },
  repas: { label: 'Repas', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30', icon: Utensils },
  logement: { label: 'Logement', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30', icon: BedDouble },
  perdiem: { label: 'Perdiem', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', icon: Wallet },
  autre: { label: 'Autre', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Receipt },
};

const fmt = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [type, setType] = useState('');
  const [teamId, setTeamId] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);

  const { data, loading, refetch } = useQuery(() => expensesService.list(), []);
  const { data: summaryData } = useQuery(() => expensesService.summary(), []);
  const { data: teamsData } = useQuery(() => teamsService.list(), []);
  const teams = useMemo(() => (Array.isArray(teamsData) ? teamsData : []), [teamsData]);

  const createMut = useMutation((d: any) => expensesService.create(d), {
    onSuccess: () => { toast({ title: 'Frais ajouté', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Ajout impossible', description: e.message, variant: 'error' }),
  });
  const updateMut = useMutation((d: any) => expensesService.update(editing?.id, d), {
    onSuccess: () => { toast({ title: 'Frais modifié', variant: 'success' }); setEditing(null); refetch(); },
    onError: (e: any) => toast({ title: 'Modification impossible', description: e.message, variant: 'error' }),
  });
  const removeMut = useMutation((id: string) => expensesService.remove(id), {
    onSuccess: () => { toast({ title: 'Frais supprimé', variant: 'success' }); setRemoveTarget(null); refetch(); },
    onError: (e: any) => toast({ title: 'Suppression impossible', description: e.message, variant: 'error' }),
  });

  const list = Array.isArray(data) ? data : [];
  const filtered = list.filter((e: any) => (!type || e.expenseType === type) && (!teamId || e.teamId === teamId));
  const summary = (summaryData as any)?.byType ?? {};
  const grandTotal = (summaryData as any)?.grandTotal ?? filtered.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Wallet size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Frais de mission</h1>
            <p className="text-xs text-[#7a8f80]">Carburant, repas, logement, perdiem — rattachés aux équipes</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter un frais</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(TYPE_META).map(([k, v]) => {
          const total = summary[k]?.total ?? 0;
          const Icon = v.icon;
          return (
            <Card key={k} className="p-4">
              <p className="text-xs text-[#7a8f80] mb-1 flex items-center gap-1.5"><Icon size={12} /> {v.label}</p>
              <p className="text-lg font-bold text-[#e8ede9] tabular-nums">{fmt(total)} F</p>
              <p className="text-[10px] text-[#7a8f80]/60">{summary[k]?.count ?? 0} ligne(s)</p>
            </Card>
          );
        })}
      </div>
      <div className="rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-[#7a8f80]">Total période</p>
        <p className="text-xl font-bold text-[#0f9d70] tabular-nums">{fmt(grandTotal)} F</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-44">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-56">
          <option value="">Toutes les équipes</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState icon={<Wallet size={40} className="text-[#7a8f80]/50" />} title="Aucun frais" description="Ajoutez carburant, repas, logement ou perdiem liés à une équipe." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Mission</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Note</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Montant</th>
                <th className="px-2 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {filtered.map((e: any) => {
                const meta = TYPE_META[e.expenseType] ?? TYPE_META.autre;
                return (
                  <tr key={e.id} className="hover:bg-[#172019]/50 transition-colors">
                    <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                    <td className="px-4 py-3"><Badge className={meta.cls}><meta.icon size={11} className="mr-1" />{meta.label}</Badge></td>
                    <td className="px-4 py-3 text-[#e8ede9]">{e.teamName ?? '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80] max-w-44 truncate">{e.missionLabel ?? '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80] max-w-48 truncate">{e.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#e8ede9] tabular-nums">{fmt(e.amount)} F</td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Modifier" onClick={() => setEditing(e)}><Pencil size={14} /></button>
                        <button className="text-[#7a8f80] hover:text-[#C0392B] p-1" title="Supprimer" onClick={() => setRemoveTarget(e)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <ExpenseModal teams={teams} onClose={() => setShowCreate(false)} onSubmit={(d) => createMut.mutate(d)} loading={createMut.loading} />
      )}
      {editing && (
        <ExpenseModal teams={teams} initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => updateMut.mutate(d)} loading={updateMut.loading} />
      )}
      <ConfirmDialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Supprimer le frais"
        message={`Supprimer ce frais de ${fmt(removeTarget?.amount)} F (${TYPE_META[removeTarget?.expenseType]?.label ?? removeTarget?.expenseType}) ?`}
        confirmText="Supprimer" danger onConfirm={() => removeTarget && removeMut.mutate(removeTarget.id)} />
    </div>
  );
}

function ExpenseModal({ teams, initial, onClose, onSubmit, loading }: {
  teams: any[]; initial?: any; onClose: () => void; onSubmit: (d: any) => void; loading: boolean;
}) {
  const [f, setF] = useState({
    teamId: initial?.teamId ?? '',
    missionId: initial?.missionId ?? '',
    expenseType: initial?.expenseType ?? 'carburant',
    amount: initial ? String(initial.amount) : '',
    expenseDate: initial?.expenseDate ?? new Date().toISOString().slice(0, 10),
    note: initial?.note ?? '',
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.expenseType && Number(f.amount) > 0;

  return (
    <Modal open onClose={onClose} title={initial ? 'Modifier le frais' : 'Ajouter un frais'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ teamId: f.teamId || null, missionId: f.missionId || null, expenseType: f.expenseType, amount: Number(f.amount), expenseDate: f.expenseDate, note: f.note.trim() || undefined }); }}>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type *" value={f.expenseType} onChange={(e) => set('expenseType', e.target.value)}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Input label="Montant (FCFA) *" type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} required />
        </div>
        <Select label="Équipe" value={f.teamId} onChange={(e) => set('teamId', e.target.value)}>
          <option value="">— Aucune —</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Input label="Date" type="date" value={f.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} />
        <Input label="Note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex. plein gasoil, repas équipe…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !valid}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? <Pencil size={14} /> : <Plus size={14} />} {initial ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
