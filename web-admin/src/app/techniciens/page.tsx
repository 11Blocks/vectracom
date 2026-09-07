'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { techniciansService, teamsService } from '@/services';
import { UserCheck, Plus, Loader2, Trash2, Edit, Users, Star } from 'lucide-react';

const COMPETENCES = ['DEPLOIEMENT', 'DENSIF', 'EXTENSION', 'OSM', 'SAV', 'GC', 'DEVOIEMENT'];
const CONTRACTS = ['CDD', 'CDI', 'PRESTATAIRE'];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState('');

  const { data: teams } = useQuery(() => teamsService.list(), []);
  const teamsList = Array.isArray(teams) ? teams : [];
  const { data, loading, refetch } = useQuery(
    () => techniciansService.list(teamFilter ? { teamId: teamFilter } : undefined),
    [teamFilter],
  );
  const list = Array.isArray(data) ? data : [];
  const teamName = (id: string) => teamsList.find((t: any) => t.id === id)?.name ?? '—';

  const deleteMut = useMutation((id: string) => techniciansService.delete(id), {
    onSuccess: () => { toast({ title: 'Technicien supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <UserCheck size={20} className="text-[#0f9d70]" /> Techniciens
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {list.length} technicien(s) — chefs d’équipe et binômes
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/equipes"><Button variant="outline" size="sm"><Users size={14} /> Équipes</Button></Link>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter</Button>
        </div>
      </div>

      <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="max-w-xs">
        <option value="">Toutes les équipes</option>
        {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<UserCheck size={40} className="text-[#7a8f80]/50" />}
            title="Aucun technicien"
            description="Créez d’abord une équipe, puis ajoutez chef + binômes."
            action={<Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter</Button>} />
        </Card>
      ) : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="divide-y divide-[#1e2e25]/50">
            {list.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9] font-medium">{t.fullName}</p>
                    {t.isTeamLeader && (
                      <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30 gap-1">
                        <Star size={10} /> Chef
                      </Badge>
                    )}
                    <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{teamName(t.teamId)}</Badge>
                    {!t.active && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30">inactif</Badge>}
                  </div>
                  <p className="text-[10px] text-[#7a8f80] mt-0.5">
                    {t.phone ?? '—'} · {(t.competences ?? []).join(', ') || 'sans compétence'} · {t.contractType ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditItem(t)}>
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

      <TechFormModal open={showCreate} teams={teamsList} leaders={list.filter((t: any) => t.isTeamLeader)} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      <TechFormModal open={!!editItem} tech={editItem} teams={teamsList} leaders={list.filter((t: any) => t.isTeamLeader && t.id !== editItem?.id)} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le technicien"
        message="Cette action est définitive." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function TechFormModal({
  open, tech, teams, leaders, onClose, onDone,
}: {
  open: boolean; tech?: any | null; teams: any[]; leaders: any[]; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState({
    fullName: '', teamId: '', phone: '', isTeamLeader: false, teamLeaderId: '',
    contractType: 'CDI', competences: [] as string[], active: true, experienceYears: '',
  });

  useEffect(() => {
    if (tech) {
      setF({
        fullName: tech.fullName ?? '',
        teamId: tech.teamId ?? '',
        phone: tech.phone ?? '',
        isTeamLeader: !!tech.isTeamLeader,
        teamLeaderId: tech.teamLeaderId ?? '',
        contractType: tech.contractType ?? 'CDI',
        competences: tech.competences ?? [],
        active: tech.active !== false,
        experienceYears: tech.experienceYears != null ? String(tech.experienceYears) : '',
      });
    } else if (open) {
      setF({
        fullName: '', teamId: teams[0]?.id ?? '', phone: '', isTeamLeader: false, teamLeaderId: '',
        contractType: 'CDI', competences: [], active: true, experienceYears: '',
      });
    }
  }, [tech, open, teams]);

  const toggleComp = (c: string) => {
    setF((prev) => ({
      ...prev,
      competences: prev.competences.includes(c)
        ? prev.competences.filter((x) => x !== c)
        : [...prev.competences, c],
    }));
  };

  const payload = () => ({
    fullName: f.fullName,
    teamId: f.teamId,
    phone: f.phone || undefined,
    isTeamLeader: f.isTeamLeader,
    teamLeaderId: f.isTeamLeader ? null : (f.teamLeaderId || null),
    contractType: f.contractType,
    competences: f.competences,
    experienceYears: f.experienceYears !== '' ? Number(f.experienceYears) : undefined,
    ...(tech ? { active: f.active } : {}),
  });

  const mut = useMutation(
    () => tech ? techniciansService.update(tech.id, payload()) : techniciansService.create(payload()),
    {
      onSuccess: () => { toast({ title: tech ? 'Technicien mis à jour' : 'Technicien créé', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={tech ? `Modifier — ${tech.fullName}` : 'Nouveau technicien'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Nom complet *" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Équipe *" value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })} required>
            <option value="">—</option>
            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Input label="Téléphone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Contrat" value={f.contractType} onChange={(e) => setF({ ...f, contractType: e.target.value })}>
            {CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Expérience (ans)" type="number" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#e8ede9]">
          <input type="checkbox" checked={f.isTeamLeader} onChange={(e) => setF({ ...f, isTeamLeader: e.target.checked, teamLeaderId: '' })} className="accent-[#0f9d70]" />
          Chef d’équipe
        </label>
        {!f.isTeamLeader && (
          <Select label="Rattaché au chef" value={f.teamLeaderId} onChange={(e) => setF({ ...f, teamLeaderId: e.target.value })}>
            <option value="">—</option>
            {leaders.filter((l: any) => l.teamId === f.teamId).map((l: any) => (
              <option key={l.id} value={l.id}>{l.fullName}</option>
            ))}
          </Select>
        )}
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Compétences</p>
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleComp(c)}
                className={'px-2 py-1 rounded text-[10px] border ' + (f.competences.includes(c)
                  ? 'bg-[#0f9d70] text-white border-[#0f9d70]'
                  : 'border-[#1e2e25] text-[#7a8f80]')}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {tech && (
          <label className="flex items-center gap-2 text-sm text-[#e8ede9]">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-[#0f9d70]" />
            Actif
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.fullName.trim() || !f.teamId}>
            {mut.loading && <Loader2 size={14} className="animate-spin" />} {tech ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
