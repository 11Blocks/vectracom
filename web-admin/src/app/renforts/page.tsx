'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, ConfirmDialog, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { renfortsService, teamsService, zonesService } from '@/services';
import { ArrowRightLeft, Loader2, Plus, Pencil, CheckCircle2, Ban, MapPin, Users, CalendarRange } from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  termine: { label: 'Terminé', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  annule: { label: 'Annulé', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
};

const fmt = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  const { data, loading, refetch } = useQuery(() => renfortsService.list(), []);
  const { data: teamsData } = useQuery(() => teamsService.list(), []);
  const { data: zonesData } = useQuery(() => zonesService.list(), []);
  const teams = useMemo(() => (Array.isArray(teamsData) ? teamsData : []), [teamsData]);
  const zones = useMemo(() => (Array.isArray(zonesData) ? zonesData : []), [zonesData]);

  const createMut = useMutation((d: any) => renfortsService.create(d), {
    onSuccess: () => { toast({ title: 'Renfort créé', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });
  const updateMut = useMutation((d: any) => renfortsService.update(editing?.id, d), {
    onSuccess: () => { toast({ title: 'Renfort mis à jour', variant: 'success' }); setEditing(null); refetch(); },
    onError: (e: any) => toast({ title: 'Modification impossible', description: e.message, variant: 'error' }),
  });
  const statusMut = useMutation(({ id, status }: { id: string; status: string }) => renfortsService.setStatus(id, status), {
    onSuccess: () => { toast({ title: 'Statut mis à jour', variant: 'success' }); setTerminateTarget(null); setCancelTarget(null); refetch(); },
    onError: (e: any) => toast({ title: 'Action refusée', description: e.message, variant: 'error' }),
  });

  const list = Array.isArray(data) ? data : [];
  const actifs = list.filter((r: any) => r.status === 'actif');
  const totalPerdiem = list.reduce((s: number, r: any) => s + Number(r.totalPerdiem ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ArrowRightLeft size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Renforts</h1>
            <p className="text-xs text-[#7a8f80]">Déplacement d'équipe vers une autre zone — supplément perdiem/jour/membre</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Nouveau renfort</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Renforts actifs</p>
          <p className="text-2xl font-bold text-[#0f9d70]">{actifs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Total renforts</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{list.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Coût perdiem cumulé</p>
          <p className="text-2xl font-bold text-[#f5a623]">{fmt(totalPerdiem)} F</p>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState icon={<ArrowRightLeft size={40} className="text-[#7a8f80]/50" />} title="Aucun renfort" description="Déplacez une équipe d'une zone vers une autre (ex. Thiès → Dakar) avec un supplément perdiem." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Trajet</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Période</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Perdiem/j</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Jours</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Membres</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Coût perdiem</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-2 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-[#172019]/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#e8ede9]">{r.teamName ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-[#7a8f80]/60" />{r.fromZoneName ?? '—'} <ArrowRightLeft size={11} className="text-[#0f9d70]" /> {r.toZoneName ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                  <td className="px-4 py-3 text-right text-[#e8ede9] tabular-nums">{fmt(r.perdiemPerDay)} F</td>
                  <td className="px-4 py-3 text-center text-[#e8ede9]">{r.days}</td>
                  <td className="px-4 py-3 text-center text-[#e8ede9]"><span className="inline-flex items-center gap-1"><Users size={12} className="text-[#7a8f80]" />{r.members}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-[#f5a623] tabular-nums">{fmt(r.totalPerdiem)} F</td>
                  <td className="px-4 py-3 text-center"><Badge className={STATUS_META[r.status]?.cls ?? ''}>{STATUS_META[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'actif' && (
                        <>
                          <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Modifier" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                          <button className="text-[#0f9d70] p-1" title="Terminer" onClick={() => setTerminateTarget(r)}><CheckCircle2 size={14} /></button>
                          <button className="text-[#7a8f80] hover:text-[#C0392B] p-1" title="Annuler" onClick={() => setCancelTarget(r)}><Ban size={14} /></button>
                        </>
                      )}
                      {r.status !== 'actif' && (
                        <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Modifier" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <RenfortModal teams={teams} zones={zones} onClose={() => setShowCreate(false)}
          onSubmit={(d) => createMut.mutate(d)} loading={createMut.loading} />
      )}
      {editing && (
        <RenfortModal teams={teams} zones={zones} initial={editing} onClose={() => setEditing(null)}
          onSubmit={(d) => updateMut.mutate(d)} loading={updateMut.loading} />
      )}
      <ConfirmDialog open={!!terminateTarget} onClose={() => setTerminateTarget(null)} title="Terminer le renfort"
        message={`Clôturer le renfort de l'équipe « ${terminateTarget?.teamName ?? ''} » ?`} confirmText="Terminer"
        onConfirm={() => terminateTarget && statusMut.mutate({ id: terminateTarget.id, status: 'termine' })} />
      <ConfirmDialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Annuler le renfort"
        message={`Annuler le renfort de l'équipe « ${cancelTarget?.teamName ?? ''} » ?`} confirmText="Annuler" danger
        onConfirm={() => cancelTarget && statusMut.mutate({ id: cancelTarget.id, status: 'annule' })} />
    </div>
  );
}

function RenfortModal({ teams, zones, initial, onClose, onSubmit, loading }: {
  teams: any[]; zones: any[]; initial?: any; onClose: () => void; onSubmit: (d: any) => void; loading: boolean;
}) {
  const [f, setF] = useState({
    teamId: initial?.teamId ?? '',
    fromZoneId: initial?.fromZoneId ?? '',
    toZoneId: initial?.toZoneId ?? '',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    perdiemPerDay: initial ? String(initial.perdiemPerDay) : '1000',
    note: initial?.note ?? '',
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.teamId && f.startDate && f.endDate;

  return (
    <Modal open onClose={onClose} title={initial ? 'Modifier le renfort' : 'Nouveau renfort'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ teamId: f.teamId, fromZoneId: f.fromZoneId || null, toZoneId: f.toZoneId || null, startDate: f.startDate, endDate: f.endDate, perdiemPerDay: Number(f.perdiemPerDay) || 0, note: f.note.trim() || undefined }); }}>
        <Select label="Équipe *" value={f.teamId} onChange={(e) => set('teamId', e.target.value)} required>
          <option value="">— Sélectionner —</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Zone d'origine" value={f.fromZoneId} onChange={(e) => set('fromZoneId', e.target.value)}>
            <option value="">—</option>
            {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
          <Select label="Zone de renfort" value={f.toZoneId} onChange={(e) => set('toZoneId', e.target.value)}>
            <option value="">—</option>
            {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Début *" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} required />
          <Input label="Fin *" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} required />
        </div>
        <Input label="Perdiem / jour / membre (FCFA)" type="number" min="0" value={f.perdiemPerDay} onChange={(e) => set('perdiemPerDay', e.target.value)} />
        <Input label="Note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Ex. renfort Dakar suite saturation zone Mbour…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !valid}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? <Pencil size={14} /> : <Plus size={14} />} {initial ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
