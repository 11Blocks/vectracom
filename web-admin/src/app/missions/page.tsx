'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { missionsService, teamsService, techniciansService, vehiclesService, partnersService } from '@/services';
import { api } from '@/lib/api';
import { STATUS_META, typeMeta, statusMeta } from '@/lib/mission-meta';
import { ClipboardCheck, Plus, Search, Loader2, ArrowRight, MapPin, CheckCircle2, XCircle, UsersRound, Edit, Trash2 } from 'lucide-react';

const MISSION_TYPES = ['INSTALLATION', 'SURVEY', 'SURVEY_OSM', 'SAV', 'INFRA', 'OSM', 'GC', 'PLANTATION', 'DEVOIEMENT', 'DEPLOIEMENT', 'DENSIFICATION'];

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, loading, refetch } = useQuery(
    () => api.get('/planning/missions' + (statusFilter ? '?status=' + statusFilter : '')),
    [statusFilter],
  );
  const missions = Array.isArray(data) ? data : [];

  const list = missions.filter(m =>
    !search || `${m.clientSite} ${m.typeTache} ${m.sonatelDossierNumber ?? ''} ${m.zone ?? ''}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const decideMut = useMutation(
    ({ id, status }: { id: string; status: string }) => missionsService.updateStatus(id, status),
    {
      onSuccess: () => { toast({ title: 'Décision enregistrée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Action refusée', description: e.message, variant: 'error' }),
    },
  );

  const deleteMut = useMutation((id: string) => missionsService.remove(id), {
    onSuccess: () => { toast({ title: 'Mission supprimée', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Suppression impossible', description: e.message, variant: 'error' }),
  });

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vectracom_user') || 'null') : null;
  const canDecide = user && ['admin', 'direction', 'super_admin', 'finance_admin', 'support_admin'].includes(user.role);
  const canDelete = user && ['admin', 'super_admin'].includes(user.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ClipboardCheck size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Missions</h1>
            <p className="text-xs text-[#7a8f80]">{missions.length} mission(s) — cliquez une ligne pour le formulaire terrain</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Créer une mission</Button>
      </div>

      {/* Onglets par statut */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatusFilter('')}
          className={'rounded-lg border px-3 py-1.5 text-sm transition-colors ' + (!statusFilter ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
          Tous
        </button>
        {Object.entries(STATUS_META).map(([k, m]) => {
          const count = missions.filter(x => x.status === k).length;
          if (!count && statusFilter !== k) return null;
          return (
            <button key={k} onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
              className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ' + (statusFilter === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />{m.label} {count > 0 && <span className="text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="relative max-w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
        <input type="text" placeholder="Rechercher (client, dossier, zone…)" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <ClipboardCheck size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-4">Aucune mission — importez le planning SONATEL ou créez-en une</p>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Créer une mission</Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Dossier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Client / Site</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Zone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">SR/Plaque</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">AGE</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map(m => {
                const meta = statusMeta(m.status);
                return (
                  <tr key={m.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => router.push('/missions/' + m.id)}>
                    <td className="px-4 py-3 font-mono text-xs text-[#0f9d70]">{m.sonatelDossierNumber ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-[#e8ede9] max-w-44 truncate">{m.clientSite}</td>
                    <td className="px-4 py-3"><Badge className={typeMeta(m.typeTache).cls}>{m.typeTache}</Badge></td>
                    <td className="px-4 py-3 text-[#7a8f80]"><span className="inline-flex items-center gap-1"><MapPin size={12} className="text-[#7a8f80]/60" />{m.zone ?? '—'}</span></td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#5b8def]/80" title="SR / Plaque SONATEL">{m.srPlaque ?? '—'}</td>
                    <td className={'px-4 py-3 tabular-nums ' + (m.ageDays > 7 ? 'text-[#C0392B]' : m.ageDays > 3 ? 'text-[#D9822B]' : 'text-[#7a8f80]')} title="Ancienneté de la demande">{m.ageDays != null ? `${m.ageDays} j` : '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(m.dateMission)}</td>
                    <td className="px-4 py-3 text-[#7a8f80]">{m.importMeta?.teamLabel ?? m.team?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {m.surcharge && <Badge className="bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30 text-[10px]">SURCH</Badge>}
                        <Badge className={meta.cls}><span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />{meta.label}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canDecide && m.status === 'terminee' && (
                          <>
                            <Button size="sm" className="h-8 px-2 text-xs" disabled={decideMut.loading} onClick={() => decideMut.mutate({ id: m.id, status: 'validee' })}>
                              <CheckCircle2 size={13} /> Valider
                            </Button>
                            <Button size="sm" variant="danger" className="h-8 px-2 text-xs" disabled={decideMut.loading} onClick={() => decideMut.mutate({ id: m.id, status: 'rejetee' })}>
                              <XCircle size={13} />
                            </Button>
                          </>
                        )}
                        {canDecide && !['terminee', 'validee', 'rejetee'].includes(m.status) && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-[#7a8f80] hover:text-[#D9822B]" onClick={() => setReassignTarget(m)} title="Réaffecter (équipe, binôme, véhicule, créneau)">
                            <UsersRound size={13} />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditTarget(m)} title="Modifier métadonnées">
                          <Edit size={13} />
                        </Button>
                        {canDelete && m.status !== 'validee' && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(m.id)} title="Supprimer">
                            <Trash2 size={13} />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => router.push('/missions/' + m.id)} title="Ouvrir">
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReassignModal mission={reassignTarget} onClose={() => setReassignTarget(null)} onDone={() => { setReassignTarget(null); refetch(); }} />
      <CreateMissionModal open={showCreate} onClose={() => setShowCreate(false)} onDone={refetch} />
      <EditMissionDetailsModal mission={editTarget} onClose={() => setEditTarget(null)} onDone={() => { setEditTarget(null); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer la mission"
        message="Les rapports terrain associés peuvent être perdus. Les missions validées ne sont pas supprimables."
        confirmText="Supprimer" danger onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function CreateMissionModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({
    clientSite: '', typeTache: 'INSTALLATION', zone: '', teamId: '', technicianIds: [] as string[],
    vehicleId: '', dateMission: new Date().toISOString().slice(0, 10), sonatelDossierNumber: '', partnerId: '',
    srPlaque: '', segment: '', sonatelOlt: '', coper: '', vaCap: '', piloteSonatel: '', codeOperation: '', contactClient: '',
  });

  const { data: teams } = useQuery(() => teamsService.list(), [], { immediate: open });
  const { data: techs } = useQuery(() => techniciansService.list(), [], { immediate: open });
  const { data: vehicles } = useQuery(() => vehiclesService.list(), [], { immediate: open });
  const { data: tpl } = useQuery(() => missionsService.template(f.typeTache), [f.typeTache], { immediate: open });
  const { data: partners } = useQuery(() => partnersService.list(), [], { immediate: open });
  const partnersList = Array.isArray(partners) ? partners : [];
  const teamsList = Array.isArray(teams) ? teams : [];
  const techsList = Array.isArray(techs) ? techs : [];
  const vehiclesList = Array.isArray(vehicles) ? vehicles : [];
  const teamTechs = f.teamId ? techsList.filter((t: any) => t.teamId === f.teamId) : techsList;

  const mut = useMutation((d: any) => missionsService.create(d), {
    onSuccess: () => { toast({ title: 'Mission créée', variant: 'success' }); onClose(); onDone(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });

  const toggleTech = (id: string) => setF(p => ({
    ...p, technicianIds: p.technicianIds.includes(id) ? p.technicianIds.filter((x: string) => x !== id) : [...p.technicianIds, id],
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      clientSite: f.clientSite, typeTache: f.typeTache, dateMission: new Date(f.dateMission).toISOString(),
    };
    if (f.zone) payload.zone = f.zone;
    if (f.teamId) payload.teamId = f.teamId;
    if (f.technicianIds.length) payload.technicianIds = f.technicianIds;
    if (f.vehicleId) payload.vehicleId = f.vehicleId;
    if (f.sonatelDossierNumber) payload.sonatelDossierNumber = f.sonatelDossierNumber;
    if (f.partnerId) payload.partnerId = f.partnerId;
    if (f.srPlaque) payload.srPlaque = f.srPlaque;
    if (f.segment) payload.segment = f.segment;
    if (f.sonatelOlt) payload.sonatelOlt = f.sonatelOlt;
    if (f.coper) payload.coper = f.coper;
    if (f.vaCap) payload.vaCap = f.vaCap;
    if (f.piloteSonatel) payload.piloteSonatel = f.piloteSonatel;
    if (f.codeOperation) payload.codeOperation = f.codeOperation;
    if (f.contactClient) payload.contactClient = f.contactClient;
    mut.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Créer une mission" size="lg">
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Client / Site *" value={f.clientSite} onChange={e => setF({ ...f, clientSite: e.target.value })} required placeholder="Diallo Mamadou — Almadies" />
          <Select label="Type de tâche *" value={f.typeTache} onChange={e => setF({ ...f, typeTache: e.target.value })}>
            {MISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        {tpl && (
          <div className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3 space-y-1.5">
            <p className="text-xs text-[#e8ede9] font-medium">{tpl.label}</p>
            <p className="text-xs text-[#7a8f80]">{tpl.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(tpl.steps ?? []).map((s: any) => (
                <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a2420] text-[#7a8f80] border border-[#1e2e25]">{s.label}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              {(tpl.requiredPhotos ?? []).map((p: any) => (
                <span key={p.type} className="px-2 py-0.5 rounded-full bg-[#0f9d70]/10 text-[#0f9d70] border border-[#0f9d70]/30">{p.label} ×{p.count}</span>
              ))}
              <span className={'px-2 py-0.5 rounded-full border ' + (tpl.clientFinal ? 'bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30' : 'bg-[#D9822B]/10 text-[#D9822B] border-[#D9822B]/30')}>
                {tpl.clientFinal ? 'signature client requise' : 'sans client final'}
              </span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Zone" value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })} placeholder="Mbour" />
          <Input label="Date mission *" type="date" value={f.dateMission} onChange={e => setF({ ...f, dateMission: e.target.value })} required />
          <Input label="N° dossier SONATEL" value={f.sonatelDossierNumber} onChange={e => setF({ ...f, sonatelDossierNumber: e.target.value })} placeholder="optionnel" />
          <Select label="Partenaire" value={f.partnerId} onChange={e => setF({ ...f, partnerId: e.target.value })}>
            <option value="">— Aucun —</option>
            {partnersList.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.priceGrid === 'GRID_SOFATELCOM' ? 'prestations' : 'bordereau'})</option>)}
          </Select>
          <Input label="SR / Plaque" value={f.srPlaque} onChange={e => setF({ ...f, srPlaque: e.target.value })} placeholder="A07/PBO-82" />
        </div>
        {f.typeTache === 'DENSIFICATION' && (
          <p className="text-[11px] text-[#0f9d70] border border-[#0f9d70]/30 rounded-lg px-3 py-2 bg-[#0f9d70]/10">
            Type DENSIFICATION — la fiche chantier DENSIF (bande métrique, mesures optiques, pré-recette) s’ouvre sur le détail mission.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Input label="OLT" value={f.sonatelOlt} onChange={e => setF({ ...f, sonatelOlt: e.target.value })} placeholder="Mbour" />
          <Input label="COPER" value={f.coper} onChange={e => setF({ ...f, coper: e.target.value })} placeholder="NA / MC…" />
          <Input label="VA CAP" value={f.vaCap} onChange={e => setF({ ...f, vaCap: e.target.value })} placeholder="oui / non" />
          <Input label="Pilote SONATEL" value={f.piloteSonatel} onChange={e => setF({ ...f, piloteSonatel: e.target.value })} placeholder="DAOUDA DIAO" />
          <Input label="Code opération" value={f.codeOperation} onChange={e => setF({ ...f, codeOperation: e.target.value })} placeholder="RIT / SAV…" />
          <Input label="Contact client" value={f.contactClient} onChange={e => setF({ ...f, contactClient: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Équipe" value={f.teamId} onChange={e => setF({ ...f, teamId: e.target.value, technicianIds: [] })}>
            <option value="">— Aucune —</option>
            {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select label="Véhicule" value={f.vehicleId} onChange={e => setF({ ...f, vehicleId: e.target.value })}>
            <option value="">— Aucun —</option>
            {vehiclesList.map((v: any) => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
          </Select>
        </div>
        {teamTechs.length > 0 && (
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Binôme (0 à 2 techniciens)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {teamTechs.map((t: any) => (
                <button key={t.id} type="button" onClick={() => toggleTech(t.id)}
                  className={
                    'rounded-lg border px-2.5 py-2 text-left text-sm transition-all ' +
                    (f.technicianIds.includes(t.id) ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#e8ede9] hover:border-[#0f9d70]/40')
                  }>
                  {t.fullName}
                  {t.isTeamLeader && <span className="block text-[10px] opacity-70">chef d'équipe</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Créer la mission</Button>
        </div>
      </form>
    </Modal>
  );
}


/* ═════════════════ RÉAFFECTATION ═════════════════ */
function ReassignModal({ mission, onClose, onDone }: { mission: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const { data: teams } = useQuery(() => teamsService.list(), [], { immediate: !!mission });
  const { data: techs } = useQuery(() => techniciansService.list(), [], { immediate: !!mission });
  const { data: vehicles } = useQuery(() => vehiclesService.list(), [], { immediate: !!mission });
  const teamsList = Array.isArray(teams) ? teams : [];
  const techsList = Array.isArray(techs) ? techs : [];
  const vehiclesList = Array.isArray(vehicles) ? vehicles : [];

  const [f, setF] = useState<Record<string, any>>({});
  useEffect(() => {
    if (mission) {
      setF({
        teamId: mission.teamId ?? '',
        technicianIds: [...(mission.technicianIds ?? [])],
        vehicleId: mission.vehicleId ?? '',
        dateMission: (mission.dateMission ?? '').slice(0, 10),
      });
    }
  }, [mission]);

  const mut = useMutation(
    (d: any) => missionsService.reassign(mission.id, d),
    {
      onSuccess: () => { toast({ title: 'Mission réaffectée', variant: 'success' }); onDone(); },
      onError: (e: any) => toast({ title: 'Réaffectation refusée', description: e.message, variant: 'error' }),
    },
  );

  if (!mission) return null;
  const teamTechs = f.teamId ? techsList.filter((t: any) => t.teamId === f.teamId) : techsList;
  const toggleTech = (id: string) => setF(p => ({
    ...p, technicianIds: p.technicianIds.includes(id) ? p.technicianIds.filter((x: string) => x !== id) : [...p.technicianIds, id],
  }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      teamId: f.teamId || null,
      technicianIds: f.technicianIds,
      vehicleId: f.vehicleId || null,
      dateMission: f.dateMission ? new Date(f.dateMission).toISOString() : undefined,
    });
  };

  return (
    <Modal open={!!mission} onClose={onClose} title={`Réaffecter — ${mission.clientSite}`} size="lg">
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-xs text-[#7a8f80]">
          Règles appliquées : équipe active obligatoire, pas de double affectation d'une même équipe ni d'un même véhicule sur le même créneau jour.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Équipe" value={f.teamId} onChange={e => setF({ ...f, teamId: e.target.value, technicianIds: [] })}>
            <option value="">— Aucune —</option>
            {teamsList.map((t: any) => <option key={t.id} value={t.id} disabled={t.active === false}>{t.name}{t.active === false ? ' (désactivée)' : ''}</option>)}
          </Select>
          <Select label="Véhicule" value={f.vehicleId} onChange={e => setF({ ...f, vehicleId: e.target.value })}>
            <option value="">— Aucun —</option>
            {vehiclesList.map((v: any) => <option key={v.id} value={v.id}>{v.immatriculation}</option>)}
          </Select>
          <Input label="Créneau (date)" type="date" value={f.dateMission} onChange={e => setF({ ...f, dateMission: e.target.value })} />
        </div>
        {teamTechs.length > 0 && (
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Binôme</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {teamTechs.map((t: any) => (
                <button key={t.id} type="button" onClick={() => toggleTech(t.id)}
                  className={'rounded-lg border px-2.5 py-2 text-left text-sm transition-all ' +
                    (f.technicianIds.includes(t.id) ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#e8ede9] hover:border-[#0f9d70]/40')}>
                  {t.fullName}
                  {t.isTeamLeader && <span className="block text-[10px] opacity-70">chef d'équipe</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Réaffecter</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditMissionDetailsModal({ mission, onClose, onDone }: { mission: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const { data: partners } = useQuery(() => partnersService.list(), [], { immediate: !!mission });
  const partnersList = Array.isArray(partners) ? partners : [];

  useEffect(() => {
    if (!mission) return;
    setF({
      clientSite: mission.clientSite ?? '',
      zone: mission.zone ?? '',
      dateMission: mission.dateMission ? new Date(mission.dateMission).toISOString().slice(0, 10) : '',
      partnerId: mission.partnerId ?? '',
      sonatelDossierNumber: mission.sonatelDossierNumber ?? '',
      sonatelOlt: mission.sonatelOlt ?? '',
      srPlaque: mission.srPlaque ?? '',
      segment: mission.segment ?? '',
      contactClient: mission.contactClient ?? '',
      coper: mission.coper ?? '',
      vaCap: mission.vaCap ?? '',
      piloteSonatel: mission.piloteSonatel ?? '',
      codeOperation: mission.codeOperation ?? '',
    });
  }, [mission]);

  const mut = useMutation(
    () => missionsService.updateDetails(mission.id, {
      clientSite: f.clientSite,
      zone: f.zone || null,
      dateMission: f.dateMission ? new Date(f.dateMission).toISOString() : undefined,
      partnerId: f.partnerId || null,
      sonatelDossierNumber: f.sonatelDossierNumber || null,
      sonatelOlt: f.sonatelOlt || null,
      srPlaque: f.srPlaque || null,
      segment: f.segment || null,
      contactClient: f.contactClient || null,
      coper: f.coper || null,
      vaCap: f.vaCap || null,
      piloteSonatel: f.piloteSonatel || null,
      codeOperation: f.codeOperation || null,
    }),
    {
      onSuccess: () => { toast({ title: 'Mission mise à jour', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  if (!mission) return null;

  return (
    <Modal open={!!mission} onClose={onClose} title={`Modifier — ${mission.clientSite}`} size="lg">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Client / Site *" value={f.clientSite ?? ''} onChange={(e) => setF({ ...f, clientSite: e.target.value })} required />
          <Input label="Date" type="date" value={f.dateMission ?? ''} onChange={(e) => setF({ ...f, dateMission: e.target.value })} />
          <Input label="Zone" value={f.zone ?? ''} onChange={(e) => setF({ ...f, zone: e.target.value })} />
          <Input label="N° dossier" value={f.sonatelDossierNumber ?? ''} onChange={(e) => setF({ ...f, sonatelDossierNumber: e.target.value })} />
          <Select label="Partenaire" value={f.partnerId ?? ''} onChange={(e) => setF({ ...f, partnerId: e.target.value })}>
            <option value="">—</option>
            {partnersList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="SR / Plaque" value={f.srPlaque ?? ''} onChange={(e) => setF({ ...f, srPlaque: e.target.value })} />
          <Input label="OLT" value={f.sonatelOlt ?? ''} onChange={(e) => setF({ ...f, sonatelOlt: e.target.value })} />
          <Input label="COPER" value={f.coper ?? ''} onChange={(e) => setF({ ...f, coper: e.target.value })} />
          <Input label="VA CAP" value={f.vaCap ?? ''} onChange={(e) => setF({ ...f, vaCap: e.target.value })} />
          <Input label="Pilote SONATEL" value={f.piloteSonatel ?? ''} onChange={(e) => setF({ ...f, piloteSonatel: e.target.value })} />
          <Input label="Code opération" value={f.codeOperation ?? ''} onChange={(e) => setF({ ...f, codeOperation: e.target.value })} />
          <Input label="Contact client" value={f.contactClient ?? ''} onChange={(e) => setF({ ...f, contactClient: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
