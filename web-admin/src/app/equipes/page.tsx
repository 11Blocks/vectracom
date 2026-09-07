'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { teamsService, techniciansService } from '@/services';
import { Users, Plus, Loader2, Trash2, Edit, UserCheck } from 'lucide-react';
import Link from 'next/link';

const TEAM_TYPES = ['PROD', 'SAV', 'INFRA', 'EXTENSION'];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(() => teamsService.list(), []);
  const { data: techs } = useQuery(() => techniciansService.list(), []);
  const list = Array.isArray(data) ? data : [];
  const techList = Array.isArray(techs) ? techs : [];
  const countByTeam = (id: string) => techList.filter((t: any) => t.teamId === id).length;

  const deleteMut = useMutation((id: string) => teamsService.delete(id), {
    onSuccess: () => { toast({ title: 'Équipe supprimée', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: Error) => toast({ title: 'Suppression impossible', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <Users size={20} className="text-[#0f9d70]" /> Équipes
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {list.length} équipe(s) — composition via techniciens (chef + binômes)
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/techniciens"><Button variant="outline" size="sm"><UserCheck size={14} /> Techniciens</Button></Link>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Nouvelle équipe</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<Users size={40} className="text-[#7a8f80]/50" />}
            title="Aucune équipe"
            description="Créez Alpha, Beta, Gamma… puis rattachez les techniciens."
            action={<Button onClick={() => setShowCreate(true)}><Plus size={15} /> Créer</Button>} />
        </Card>
      ) : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="divide-y divide-[#1e2e25]/50">
            {list.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9] font-medium">{t.name}</p>
                    <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{t.type}</Badge>
                    {t.zone && <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{t.zone}</Badge>}
                    {!t.active && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30">inactive</Badge>}
                  </div>
                  <p className="text-[10px] text-[#7a8f80] mt-0.5">{countByTeam(t.id)} technicien(s)</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditItem(t)} title="Modifier">
                    <Edit size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(t.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TeamFormModal open={showCreate} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      <TeamFormModal open={!!editItem} team={editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer l’équipe"
        message="Impossible si des techniciens y sont encore rattachés." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function TeamFormModal({ open, team, onClose, onDone }: { open: boolean; team?: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', type: 'PROD', zone: '', active: true });

  useEffect(() => {
    if (team) setF({ name: team.name ?? '', type: team.type ?? 'PROD', zone: team.zone ?? '', active: team.active !== false });
    else if (open) setF({ name: '', type: 'PROD', zone: '', active: true });
  }, [team, open]);

  const mut = useMutation(
    () => team
      ? teamsService.update(team.id, { name: f.name, type: f.type, zone: f.zone || null, active: f.active })
      : teamsService.create({ name: f.name, type: f.type, zone: f.zone || undefined }),
    {
      onSuccess: () => { toast({ title: team ? 'Équipe mise à jour' : 'Équipe créée', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={team ? `Modifier — ${team.name}` : 'Nouvelle équipe'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Nom *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="Alpha" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type *" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {TEAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Zone" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} placeholder="Mbour" />
        </div>
        {team && (
          <label className="flex items-center gap-2 text-sm text-[#e8ede9]">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-[#0f9d70]" />
            Active
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.name.trim()}>
            {mut.loading && <Loader2 size={14} className="animate-spin" />} {team ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
