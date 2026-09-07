'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, useToast, ConfirmDialog, AiBlock } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { dispositifService, teamsService } from '@/services';
import {
  LayoutGrid, Plus, Loader2, Trash2, Sparkles, Check, X, MapPin, Users, CalendarDays, Wand2, Edit,
} from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [proposals, setProposals] = useState<any[] | null>(null);
  const [checked, setChecked] = useState<Record<string, string>>({});

  const { data, loading, refetch } = useQuery(() => dispositifService.grid(day), [day]);
  const { data: teams } = useQuery(() => teamsService.list(), []);
  const teamsList = Array.isArray(teams) ? teams : [];

  const proposeMut = useMutation(() => dispositifService.propose(day), {
    onSuccess: (res: any) => {
      setProposals(res.proposals ?? []);
      setChecked(Object.fromEntries((res.proposals ?? []).map((p: any) => [p.missionId, p.suggestedTeamId])));
      toast({
        title: `${res.proposals?.length ?? 0} proposition(s) générée(s)`,
        description: res.disclaimer,
        variant: 'success',
      });
    },
    onError: (e: Error) => toast({ title: 'Proposition impossible', description: e.message, variant: 'error' }),
  });

  const applyMut = useMutation(
    () => dispositifService.apply(Object.entries(checked).map(([missionId, teamId]) => ({ missionId, teamId }))),
    {
      onSuccess: (res: any) => {
        toast({ title: `${res.applied} mission(s) affectée(s)`, description: res.skipped.length ? `${res.skipped.length} ignorée(s) (conflit ou déjà affectée).` : undefined, variant: 'success' });
        setProposals(null);
      },
      onError: (e: Error) => toast({ title: 'Application impossible', description: e.message, variant: 'error' }),
    },
  );

  const zones = data?.zones ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><LayoutGrid size={20} className="text-[#0f9d70]" /> Dispositif</h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            Grille quotidienne « qui travaille où » — zones × équipes × axes (PL/RJT), au format de la feuille DISPOSITIF SONATEL
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={day} onChange={e => setDay(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
          <Button variant="ai" onClick={() => proposeMut.mutate()} loading={proposeMut.loading}>
            <Wand2 size={15} /> Répartition auto
          </Button>
          <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Positionner une équipe</Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : zones.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<CalendarDays size={40} className="text-[#7a8f80]/50" />}
            title={`Dispositif vide pour le ${new Date(day).toLocaleDateString('fr-FR')}`}
            description="Positionnez vos équipes par zone (Mbour, Kaolack, Thiaroye, débordement Touba…) — la répartition automatique s'en sert pour proposer des affectations."
            action={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Positionner une équipe</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {zones.map((z: any) => (
            <Card key={z.zone} className="border-[#1e2e25] bg-[#111916] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#0f9d70]" /> {z.zone}
                </h3>
                <Badge className="bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30">{z.instances} instance(s)</Badge>
              </div>
              <div className="space-y-1.5">
                {z.teams.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[#e8ede9] truncate">{t.teamName}</p>
                      <p className="text-[10px] text-[#7a8f80]">
                        {t.axis ? `axe ${t.axis}` : '—'}{t.pilot ? ` · pilote ${t.pilot}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditEntry({ ...t, zoneName: z.zone })}>
                        <Edit size={11} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(t.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Propositions de répartition (bloc ambre — l'IA propose) */}
      {proposals && proposals.length > 0 && (
        <AiBlock title={`Répartition automatique — ${proposals.length} proposition(s)`}>
          <div className="space-y-2">
            <p className="text-xs text-[#7a8f80]">L&apos;IA propose, vous décidez : cochez les affectations à appliquer. Aucune mission n&apos;est modifiée sans votre validation.</p>
            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {proposals.map((p: any) => (
                <div key={p.missionId} className="flex items-center gap-3 rounded-lg border border-[#f5a623]/25 bg-[#f5a623]/[0.04] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={checked[p.missionId] === p.suggestedTeamId}
                    onChange={e => setChecked(prev => e.target.checked ? { ...prev, [p.missionId]: p.suggestedTeamId } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== p.missionId)))}
                    className="accent-[#f5a623]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#e8ede9] truncate">
                      {p.client}
                      {p.dossier && <span className="font-mono text-[#0f9d70] ml-1.5">#{p.dossier}</span>}
                      {p.surcharge && <Badge className="ml-1.5 bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30 text-[9px]">SURCH</Badge>}
                    </p>
                    <p className="text-[10px] text-[#7a8f80]">{p.zone ?? '—'} · {p.reason}</p>
                  </div>
                  <Select
                    value={checked[p.missionId] ?? p.suggestedTeamId}
                    onChange={(e: any) => setChecked(prev => ({ ...prev, [p.missionId]: e.target.value }))}
                    className="w-44 h-8 text-xs"
                  >
                    {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setProposals(null)}><X size={13} /> Ignorer</Button>
              <Button size="sm" onClick={() => applyMut.mutate()} loading={applyMut.loading}>
                <Check size={13} /> Appliquer {Object.keys(checked).length} affectation(s)
              </Button>
            </div>
          </div>
        </AiBlock>
      )}
      {proposals && proposals.length === 0 && (
        <Card className="border-[#1e2e25] bg-[#111916] p-6 text-center">
          <p className="text-sm text-[#7a8f80]">Aucune mission non affectée ce jour — tout est déjà couvert.</p>
        </Card>
      )}

      <AddEntryModal open={showAdd} day={day} teams={teamsList} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refetch(); }} />
      <AddEntryModal open={!!editEntry} day={day} teams={teamsList} entry={editEntry} onClose={() => setEditEntry(null)} onDone={() => { setEditEntry(null); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Retirer du dispositif"
        message="L'équipe ne sera plus positionnée sur cette zone." confirmText="Retirer" danger
        onConfirm={() => deleteId && dispositifService.remove(deleteId).then(() => { toast({ title: 'Entrée retirée', variant: 'success' }); setDeleteId(null); refetch(); }).catch((e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }))} />
    </div>
  );
}

function AddEntryModal({ open, day, teams, entry, onClose, onDone }: { open: boolean; day: string; teams: any[]; entry?: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ zoneName: '', teamName: '', axis: '', pilot: '', teamId: '' });

  useEffect(() => {
    if (entry) {
      setF({
        zoneName: entry.zoneName ?? '',
        teamName: entry.teamName ?? '',
        axis: entry.axis ?? '',
        pilot: entry.pilot ?? '',
        teamId: entry.teamId ?? '',
      });
    } else if (open) {
      setF({ zoneName: '', teamName: '', axis: '', pilot: '', teamId: '' });
    }
  }, [entry, open]);

  const mut = useMutation(
    () => dispositifService.upsert({
      day,
      zoneName: f.zoneName,
      teamName: f.teamName || teams.find((t: any) => t.id === f.teamId)?.name || '',
      axis: f.axis || undefined,
      pilot: f.pilot || undefined,
      teamId: f.teamId || undefined,
    }),
    {
      onSuccess: () => { toast({ title: entry ? 'Position mise à jour' : 'Équipe positionnée', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={`${entry ? 'Modifier' : 'Positionner une équipe'} — ${new Date(day).toLocaleDateString('fr-FR')}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Zone *" value={f.zoneName} onChange={e => setF({ ...f, zoneName: e.target.value })} required placeholder="Mbour / DEBORDEMENT TOUBA…" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Équipe VECTRACOM" value={f.teamId} onChange={e => setF({ ...f, teamId: e.target.value })}>
            <option value="">— Aucune (nom libre) —</option>
            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Ou nom libre" value={f.teamName} onChange={e => setF({ ...f, teamName: e.target.value })} placeholder="ABABACAR LATYR SARR" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Axe (PL06, RJT29…)" value={f.axis} onChange={e => setF({ ...f, axis: e.target.value })} placeholder="PL29" />
          <Input label="Pilote SONATEL" value={f.pilot} onChange={e => setF({ ...f, pilot: e.target.value })} placeholder="DAOUDA DIAO" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.zoneName.trim() || (!f.teamId && !f.teamName.trim())}>{mut.loading && <Loader2 size={14} className="animate-spin" />} {entry ? 'Enregistrer' : 'Positionner'}</Button>
        </div>
      </form>
    </Modal>
  );
}
