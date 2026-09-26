'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, Textarea, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { incidentsService, teamsService, techniciansService, absoluteUploadUrl } from '@/services';
import {
  ArrowLeft, AlertTriangle, Loader2, FileDown, Users, Wrench, CheckCircle2, Lock,
  MapPin, Clock, MessageSquare, Radio, Zap, Wrench as WrenchIcon, Pencil, RotateCcw,
} from 'lucide-react';

const PBO_DEFAUTS = ['DESORGANISE', 'SANS_COUVERCLE', 'ENDOMAGE', 'CABLE_DESORDRE'];
const PIO_TYPES = ['POTEAU_SIMPLE', 'POTEAU_MOISE', 'CABLE', 'ACCESSOIRE'];
const PIO_ETATS = ['DEBOUT', 'INCLINE', 'A_TERRE', 'CASSE'];
const CHAMBRE_TYPES = ['L2T', 'L3T', 'L5T', 'L6T'];
const CHAMBRE_ETATS = ['ACCESSIBLE', 'BOUCHEE', 'ENDOMAGEE', 'INONDEE'];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  signalement: { label: 'Signalement', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  en_cours: { label: 'En cours', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  en_attente: { label: 'En attente', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  corrige: { label: 'Corrigé', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  cloture: { label: 'Clôturé', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
};
const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: 'Critique', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  MAJEUR: { label: 'Majeur', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
  MINEUR: { label: 'Mineur', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  INFORMATION: { label: 'Information', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
};

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [showAssign, setShowAssign] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  const { data, loading, refetch } = useQuery(() => incidentsService.get(String(id)), [id]);
  const { data: teams } = useQuery(() => teamsService.list(), []);
  const teamsList = Array.isArray(teams) ? teams : [];
  const { data: techsData } = useQuery(() => techniciansService.list(), []);
  const techs = Array.isArray(techsData) ? techsData : [];

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('vectracom_user') || 'null') : null;
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const canDirection = user && ['admin', 'direction', 'super_admin', 'finance_admin', 'support_admin'].includes(user.role);
  const canResolve = user && ['admin', 'chef_equipe', 'super_admin'].includes(user.role);

  const assignMut = useMutation((d: any) => incidentsService.assign(String(id), d), {
    onSuccess: () => { toast({ title: 'Équipe assignée', variant: 'success' }); setShowAssign(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const resolveMut = useMutation((d: any) => incidentsService.resolve(String(id), d), {
    onSuccess: () => { toast({ title: 'Incident résolu', variant: 'success' }); setShowResolve(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const generateSavMut = useMutation(
    (mode: 'groupee' | 'individuelle') => incidentsService.generateSav(String(id), mode),
    {
      onSuccess: (d: any) => {
        toast({ title: `${d.created.length} mission(s) SAV créée(s)`, description: "Missions planifiées dès demain, liées à l'incident.", variant: 'success' });
        refetch();
      },
      onError: (e: any) => toast({ title: 'Génération impossible', description: e.message, variant: 'error' }),
    },
  );

  const updateMut = useMutation((d: any) => incidentsService.update(String(id), d), {
    onSuccess: () => { toast({ title: 'Incident mis à jour', variant: 'success' }); setShowEdit(false); refetch(); },
    onError: (e: any) => toast({ title: 'Modification impossible', description: e.message, variant: 'error' }),
  });
  const reopenMut = useMutation((reason: string) => incidentsService.reopen(String(id), reason), {
    onSuccess: () => { toast({ title: 'Incident rouvert', variant: 'success' }); setShowReopen(false); refetch(); },
    onError: (e: any) => toast({ title: 'Réouverture impossible', description: e.message, variant: 'error' }),
  });

  const closeMut = useMutation(() => incidentsService.close(String(id)), {
    onSuccess: () => { toast({ title: 'Incident clôturé', variant: 'success' }); setShowClose(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const downloadReport = async () => {
    try {
      const blob = await incidentsService.generateReport(String(id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      toast({ title: 'Génération impossible', description: e.message, variant: 'error' });
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (!data) return <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center"><p className="text-sm text-[#7a8f80]">Incident introuvable</p></Card>;

  const inc = data;
  const st = STATUS_META[inc.status] ?? { label: inc.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
  const sev = SEVERITY_META[inc.severity] ?? SEVERITY_META.INFORMATION;
  const teamName = teamsList.find((t: any) => t.id === inc.assignedTeamId)?.name;
  const techNames = (inc.assignedTechnicianIds ?? []).map((tid: string) => techs.find((t: any) => t.id === tid)?.fullName).filter(Boolean);
  const photoUrls: string[] = (inc.photos ?? []).map((p: any) => (typeof p === 'string' ? p : p?.url)).filter(Boolean);
  const equipment = inc.rubrique === 'PBO'
    ? [inc.pboReference, inc.pboDefaut].filter(Boolean).join(' · ')
    : inc.rubrique === 'PIO'
      ? [inc.pioType, inc.pioEtat].filter(Boolean).join(' · ')
      : [inc.chambreType, inc.chambreEtat].filter(Boolean).join(' · ');
  const closed = inc.status === 'cloture';

  return (
    <div className="space-y-4 max-w-5xl">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => router.push('/incidents')} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-2">
            <ArrowLeft size={15} /> Retour aux incidents
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
              <AlertTriangle size={20} className="text-[#D9822B]" /> {inc.incidentNumber}
            </h1>
            <Badge className={st.cls}>{st.label}</Badge>
            <Badge className={sev.cls}>{sev.label}</Badge>
            <Badge className="bg-[#1a2420] text-[#e8ede9] border-[#1e2e25]">{inc.rubrique}</Badge>
          </div>
          <p className="text-sm text-[#7a8f80] mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1"><MapPin size={13} /> Zone ops · {inc.zone}</span>
            <span className="inline-flex items-center gap-1"><Clock size={13} /> signalé {fmtDateTime(inc.reportedAt)}</span>
            {inc.source === 'WHATSAPP' && <span className="inline-flex items-center gap-1"><MessageSquare size={13} /> WhatsApp — {inc.whatsappGroup}</span>}
            {inc.source === 'IA_VISION' && <span className="inline-flex items-center gap-1"><Radio size={13} className="text-[#f5a623]" /> Détecté par IA Vision</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadReport}><FileDown size={15} /> Rapport PDF</Button>
          {canResolve && !closed && (
            <Button variant="outline" onClick={() => setShowEdit(true)}><Pencil size={15} /> Modifier</Button>
          )}
          {canDirection && ['corrige', 'cloture'].includes(inc.status) && (
            <Button variant="outline" onClick={() => setShowReopen(true)}><RotateCcw size={15} /> Rouvrir</Button>
          )}
          {isAdmin && !closed && (
            <Button variant="outline" onClick={() => setShowAssign(true)}><Users size={15} /> Assigner</Button>
          )}
          {canResolve && inc.status !== 'signalement' && !closed && inc.status !== 'corrige' && (
            <Button onClick={() => setShowResolve(true)}><Wrench size={15} /> Résoudre</Button>
          )}
          {isAdmin && !closed && (
            <Button variant="outline" onClick={() => generateSavMut.mutate((inc.ndList ?? []).length > 1 ? 'individuelle' : 'groupee')} disabled={generateSavMut.loading}>
              <Zap size={15} /> Générer mission(s) SAV
            </Button>
          )}
          {canDirection && inc.status === 'corrige' && (
            <Button onClick={() => setShowClose(true)}><CheckCircle2 size={15} /> Clôturer</Button>
          )}
          {closed && <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30 px-3 py-1.5"><Lock size={12} className="mr-1" /> Clôturé</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Détails */}
        <Card className="border-[#1e2e25] bg-[#111916] p-5 lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-[#e8ede9]">Détails de l'incident</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['Description', inc.description ?? inc.annotationOriginale ?? '—'],
              ['Clients impactés', inc.clientsImpacted ?? 0],
              ['N° impactés (ND)', (inc.ndList ?? []).slice(0, 3).join(', ') || '—'],
              ['Équipement', equipment || '—'],
              ['Zone ops', inc.zone ?? '—'],
              ['OLT / adresse', [inc.olt, inc.address].filter(Boolean).join(' · ') || '—'],
              [
                'Coordonnées GPS',
                inc.gpsLatitude != null && inc.gpsLongitude != null
                  ? `${Number(inc.gpsLatitude).toFixed(5)}, ${Number(inc.gpsLongitude).toFixed(5)}`
                  : '—',
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-[#7a8f80]">{k}</p>
                <p className="text-[#e8ede9] mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {inc.ndList && inc.ndList.length > 3 && (
            <p className="text-xs text-[#7a8f80]">+ {inc.ndList.length - 3} autres numéros</p>
          )}
          {inc.actionTaken && (
            <div className="rounded-lg border border-[#0f9d70]/30 bg-[#0f9d70]/[0.06] p-3">
              <p className="text-xs font-semibold text-[#0f9d70] mb-1 flex items-center gap-1.5"><WrenchIcon size={13} /> Action réalisée</p>
              <p className="text-sm text-[#e8ede9]">{inc.actionTaken}</p>
              {inc.resolvedAt && <p className="text-xs text-[#7a8f80] mt-1.5">Résolu le {fmtDateTime(inc.resolvedAt)}</p>}
            </div>
          )}
          {inc.validationNotes && (
            <div className="rounded-lg border border-[#1e2e25] bg-[#0b120e] p-3">
              <p className="text-xs font-semibold text-[#7a8f80] mb-1">Notes de suivi</p>
              <p className="text-sm text-[#e8ede9] whitespace-pre-line">{inc.validationNotes}</p>
            </div>
          )}
          {photoUrls.length > 0 && (
            <div>
              <p className="text-xs text-[#7a8f80] mb-2">Photos ({photoUrls.length})</p>
              <div className="flex gap-2 flex-wrap">
                {photoUrls.map((u: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={absoluteUploadUrl(u)} alt={`photo ${i + 1}`} className="h-20 w-28 object-cover rounded-md border border-[#1e2e25]"
                    onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Assignation + workflow */}
        <Card className="border-[#1e2e25] bg-[#111916] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#e8ede9]">Prise en charge</h3>
          <div>
            <p className="text-xs text-[#7a8f80] mb-1">Équipe assignée</p>
            {teamName ? (
              <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{teamName}</Badge>
            ) : <p className="text-sm text-[#7a8f80]/60">Non assigné</p>}
          </div>
          <div>
            <p className="text-xs text-[#7a8f80] mb-1">Techniciens</p>
            {techNames.length ? (
              <div className="space-y-1">
                {techNames.map((n: string) => <p key={n} className="text-sm text-[#e8ede9]">• {n}</p>)}
              </div>
            ) : <p className="text-sm text-[#7a8f80]/60">—</p>}
          </div>
          <div className="pt-2 border-t border-[#1e2e25] space-y-2 text-xs">
            <TimelineRow label="Signalé" at={inc.reportedAt} />
            <TimelineRow label="Assigné" at={inc.assignedAt} />
            <TimelineRow label="Résolu" at={inc.resolvedAt} />
            <TimelineRow label="Clôturé" at={inc.closedAt} />
          </div>
        </Card>
      </div>

      {/* Modal assignation */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assigner l'incident">
        <AssignForm teams={teamsList} techs={techs} loading={assignMut.loading}
          onSubmit={d => assignMut.mutate(d)} defaultTeamId={inc.assignedTeamId} defaultTechs={inc.assignedTechnicianIds ?? []}
          onCancel={() => setShowAssign(false)} />
      </Modal>

      {/* Modal résolution */}
      <Modal open={showResolve} onClose={() => setShowResolve(false)} title="Résoudre l'incident">
        <form className="space-y-3" onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          resolveMut.mutate({ actionTaken: String(fd.get('actionTaken') || '') });
        }}>
          <Textarea label="Action réalisée *" name="actionTaken" required rows={4}
            placeholder="Remplacement du splitter HS dans le PBO, ressoudure de 4 connecteurs…" />
          <p className="text-xs text-[#7a8f80]">La résolution passe l'incident en « Corrigé » — la clôture reste à la direction.</p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowResolve(false)}>Annuler</Button>
            <Button type="submit" disabled={resolveMut.loading}>
              {resolveMut.loading && <Loader2 size={14} className="animate-spin" />} Confirmer la résolution
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Modifier l'incident" size="lg">
        {showEdit && (
          <EditIncidentForm inc={inc} loading={updateMut.loading}
            onSubmit={d => updateMut.mutate(d)} onCancel={() => setShowEdit(false)} />
        )}
      </Modal>

      <Modal open={showReopen} onClose={() => setShowReopen(false)} title="Rouvrir l'incident">
        <form className="space-y-3" onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          reopenMut.mutate(String(fd.get('reason') || '').trim());
        }}>
          <Textarea label="Motif de réouverture *" name="reason" required minLength={3} rows={3}
            placeholder="Défaut constaté à nouveau, résolution incomplète…" />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowReopen(false)}>Annuler</Button>
            <Button type="submit" disabled={reopenMut.loading}>
              {reopenMut.loading && <Loader2 size={14} className="animate-spin" />} Rouvrir
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={showClose} onClose={() => setShowClose(false)} title="Clôturer l'incident"
        message="Clôture définitive après vérification de la résolution." confirmText="Clôturer"
        onConfirm={() => closeMut.mutate(undefined as any)} />
    </div>
  );
}

function TimelineRow({ label, at }: { label: string; at?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className={'flex items-center gap-1.5 ' + (at ? 'text-[#0f9d70]' : 'text-[#7a8f80]/50')}>
        <span className={'h-1.5 w-1.5 rounded-full ' + (at ? 'bg-[#0f9d70]' : 'bg-[#1e2e25]')} /> {label}
      </span>
      <span className={at ? 'text-[#e8ede9]' : 'text-[#7a8f80]/40'}>{at ? fmtDateTime(at) : '—'}</span>
    </div>
  );
}

function EditIncidentForm({ inc, loading, onSubmit, onCancel }: {
  inc: any; loading: boolean; onSubmit: (d: any) => void; onCancel: () => void;
}) {
  const [f, setF] = useState<Record<string, any>>({
    zone: inc.zone ?? '', olt: inc.olt ?? '', address: inc.address ?? '',
    description: inc.description ?? '', severity: inc.severity ?? 'MINEUR',
    clientsImpacted: inc.clientsImpacted ?? 0, ndList: (inc.ndList ?? []).join(', '),
    pboReference: inc.pboReference ?? '', pboDefaut: inc.pboDefaut ?? PBO_DEFAUTS[0],
    pioType: inc.pioType ?? PIO_TYPES[0], pioEtat: inc.pioEtat ?? PIO_ETATS[0],
    chambreType: inc.chambreType ?? CHAMBRE_TYPES[0], chambreEtat: inc.chambreEtat ?? CHAMBRE_ETATS[0],
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      zone: f.zone.trim(), olt: f.olt, address: f.address, description: f.description,
      severity: f.severity, clientsImpacted: Math.max(0, Number(f.clientsImpacted) || 0),
      ndList: String(f.ndList).split(/[,;\s]+/).map((s: string) => s.trim()).filter(Boolean),
    };
    if (inc.rubrique === 'PBO') Object.assign(payload, { pboReference: f.pboReference, pboDefaut: f.pboDefaut });
    else if (inc.rubrique === 'PIO') Object.assign(payload, { pioType: f.pioType, pioEtat: f.pioEtat });
    else Object.assign(payload, { chambreType: f.chambreType, chambreEtat: f.chambreEtat });
    onSubmit(payload);
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Zone *" value={f.zone} onChange={set('zone')} required minLength={2} />
        <Select label="Sévérité" value={f.severity} onChange={set('severity')}>
          {Object.entries(SEVERITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
        <Input label="OLT" value={f.olt} onChange={set('olt')} />
        <Input label="Adresse" value={f.address} onChange={set('address')} />
        {inc.rubrique === 'PBO' && (<>
          <Input label="Référence PBO" value={f.pboReference} onChange={set('pboReference')} />
          <Select label="Défaut" value={f.pboDefaut} onChange={set('pboDefaut')}>
            {PBO_DEFAUTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </>)}
        {inc.rubrique === 'PIO' && (<>
          <Select label="Type" value={f.pioType} onChange={set('pioType')}>
            {PIO_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select label="État" value={f.pioEtat} onChange={set('pioEtat')}>
            {PIO_ETATS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </>)}
        {inc.rubrique === 'CHAMBRE' && (<>
          <Select label="Type" value={f.chambreType} onChange={set('chambreType')}>
            {CHAMBRE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select label="État" value={f.chambreEtat} onChange={set('chambreEtat')}>
            {CHAMBRE_ETATS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        </>)}
        <Input label="Clients impactés" type="number" min={0} value={f.clientsImpacted} onChange={set('clientsImpacted')} />
        <Input label="ND impactés (séparés par des virgules)" value={f.ndList} onChange={set('ndList')} />
      </div>
      <Textarea label="Description" rows={3} value={f.description} onChange={set('description')} />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Enregistrer
        </Button>
      </div>
    </form>
  );
}

function AssignForm({ teams, techs, loading, onSubmit, defaultTeamId, defaultTechs, onCancel }: {
  teams: any[]; techs: any[]; loading: boolean;
  onSubmit: (d: any) => void; defaultTeamId?: string | null; defaultTechs: string[]; onCancel: () => void;
}) {
  const [teamId, setTeamId] = useState(defaultTeamId ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultTechs));
  const [notes, setNotes] = useState('');

  const teamTechs = techs.filter(t => !teamId || t.teamId === teamId);
  const toggle = (tid: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(tid)) next.delete(tid); else next.add(tid);
    return next;
  });

  return (
    <form className="space-y-3" onSubmit={e => {
      e.preventDefault();
      onSubmit({
        teamId,
        technicianIds: Array.from(selected),
        validationNotes: notes || undefined,
      });
    }}>
      <Select label="Équipe *" value={teamId} onChange={e => { setTeamId(e.target.value); setSelected(new Set()); }} required>
        <option value="">— Sélectionner —</option>
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      <div>
        <p className="text-xs text-[#7a8f80] mb-1.5">Techniciens {teamId ? '(binôme de l’équipe)' : ''}</p>
        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
          {teamTechs.map(t => (
            <button key={t.id} type="button" onClick={() => toggle(t.id)}
              className={
                'rounded-lg border px-2.5 py-2 text-left text-sm transition-all ' +
                (selected.has(t.id) ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:border-[#0f9d70]/40')
              }>
              {t.fullName}
            </button>
          ))}
          {teamTechs.length === 0 && <p className="text-xs text-[#7a8f80]/60 col-span-2">Aucun technicien {teamId ? 'dans cette équipe' : ''}.</p>}
        </div>
      </div>
      <Input label="Notes de validation" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexte, accès, matériel à prévoir…" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={!teamId || loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Assigner
        </Button>
      </div>
    </form>
  );
}
