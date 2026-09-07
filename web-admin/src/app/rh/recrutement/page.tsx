'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, Textarea, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { recruitmentService, absoluteUploadUrl } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import {
  UserPlus, Loader2, Trash2, ArrowRight, Phone, Mail, FileText, CalendarDays,
  Award, ChevronLeft, Briefcase,
} from 'lucide-react';

const STATUSES = [
  { value: 'nouveau', label: 'Nouveau', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  { value: 'entretien', label: 'Entretien', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  { value: 'test_technique', label: 'Test technique', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  { value: 'retenu', label: 'Retenu', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  { value: 'rejete', label: 'Rejeté', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
];
const POSITIONS = [
  { value: 'technicien', label: 'Technicien' },
  { value: 'chauffeur', label: 'Chauffeur' },
  { value: 'magasinier', label: 'Magasinier' },
  { value: 'administratif', label: 'Administratif' },
  { value: 'chef_equipe', label: "Chef d'équipe" },
];
const SOURCES = [
  { value: 'candidature_spontanee', label: 'Candidature spontanée' },
  { value: 'recommandation', label: 'Recommandation' },
  { value: 'annonce', label: 'Annonce' },
  { value: 'pole_emploi', label: 'Pôle emploi' },
  { value: 'autre', label: 'Autre' },
];
const DOC_TYPES = ['CV', 'CNI', 'Diplôme', 'Attestation', 'Permis', 'Autre'];

/** Prochaine étape du pipeline pour un statut donné. */
const NEXT_STATUS: Record<string, string> = {
  nouveau: 'entretien',
  entretien: 'test_technique',
  test_technique: 'retenu',
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
const posLabel = (v: string) => POSITIONS.find(p => p.value === v)?.label ?? v;
const srcLabel = (v: string) => SOURCES.find(s => s.value === v)?.label ?? v;

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(() => recruitmentService.list(), []);
  const list = Array.isArray(data) ? data : [];

  const deleteMut = useMutation((id: string) => recruitmentService.remove(id), {
    onSuccess: () => { toast({ title: 'Candidat supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-1">
            <ChevronLeft size={14} /> RH
          </button>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><UserPlus size={20} className="text-[#0f9d70]" /> Recrutement</h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {list.length} candidat(s) · pipeline : nouveau → entretien → test technique → retenu/rejeté
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}><UserPlus size={15} /> Ajouter un candidat</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<UserPlus size={40} className="text-[#7a8f80]/50" />}
            title="Aucun candidat"
            description="Ajoutez vos candidatures (techniciens, chauffeurs, magasiniers) et suivez leur progression."
            action={<Button onClick={() => setShowCreate(true)}><UserPlus size={15} /> Premier candidat</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {STATUSES.map(st => {
            const column = list.filter(c => c.status === st.value);
            return (
              <div key={st.value} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Badge className={st.cls}>{st.label}</Badge>
                  <span className="text-xs text-[#7a8f80]">{column.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {column.map(c => (
                    <button key={c.id} onClick={() => setDetail(c)}
                      className="w-full text-left rounded-lg border border-[#1e2e25] bg-[#111916] p-3 hover:border-[#0f9d70]/40 transition-colors space-y-1.5">
                      <p className="text-sm text-[#e8ede9] font-medium truncate">{c.fullName}</p>
                      <p className="text-[10px] text-[#7a8f80] flex items-center gap-1"><Briefcase size={9} /> {posLabel(c.position)}</p>
                      {c.interviewDate && <p className="text-[10px] text-[#5b8def] flex items-center gap-1"><CalendarDays size={9} /> {fmtDate(c.interviewDate)}</p>}
                      {c.testScore != null && (
                        <p className={'text-[10px] flex items-center gap-1 ' + (c.testScore >= 70 ? 'text-[#0f9d70]' : 'text-[#D9822B]')}>
                          <Award size={9} /> test {c.testScore}/100
                        </p>
                      )}
                      {c.documents?.length > 0 && (
                        <p className="text-[10px] text-[#7a8f80] flex items-center gap-1"><FileText size={9} /> {c.documents.length} pièce(s)</p>
                      )}
                    </button>
                  ))}
                  {column.length === 0 && <p className="text-[10px] text-[#7a8f80]/40 text-center py-4">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateCandidateModal open={showCreate} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      <CandidateDetailModal candidate={detail} onClose={() => setDetail(null)} onDone={() => { setDetail(null); refetch(); }} onAskDelete={(id) => { setDetail(null); setDeleteId(id); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le candidat"
        message="La candidature et ses pièces seront définitivement supprimées." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

/* ═════════════════ CRÉATION ═════════════════ */
function CreateCandidateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ fullName: '', position: 'technicien', phone: '', email: '', source: 'candidature_spontanee', interviewDate: '', notes: '' });

  const mut = useMutation(
    () => recruitmentService.create({
      fullName: f.fullName,
      position: f.position,
      phone: f.phone || undefined,
      email: f.email || undefined,
      source: f.source,
      interviewDate: f.interviewDate || undefined,
      notes: f.notes || undefined,
    }),
    {
      onSuccess: () => { toast({ title: 'Candidat ajouté', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
    },
  );

  const submit = (e: React.FormEvent) => { e.preventDefault(); mut.mutate(); };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau candidat">
      <form className="space-y-3" onSubmit={submit}>
        <Input label="Nom complet *" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} required placeholder="Ndiaye Moussa" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Poste *" value={f.position} onChange={e => setF({ ...f, position: e.target.value })}>
            {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
          <Select label="Source" value={f.source} onChange={e => setF({ ...f, source: e.target.value })}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Input label="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" />
          <Input label="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="candidat@…" />
        </div>
        <Input label="Date d'entretien" type="date" value={f.interviewDate} onChange={e => setF({ ...f, interviewDate: e.target.value })} />
        <Textarea label="Notes" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Expérience FTTH, binôme actuel…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || f.fullName.trim().length < 3}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════════ FICHE CANDIDAT ═════════════════ */
function CandidateDetailModal({ candidate, onClose, onDone, onAskDelete }: {
  candidate: any | null; onClose: () => void; onDone: () => void; onAskDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState({
    status: candidate?.status ?? 'nouveau',
    interviewDate: candidate?.interviewDate?.slice(0, 10) ?? '',
    testScore: candidate?.testScore != null ? String(candidate.testScore) : '',
    notes: candidate?.notes ?? '',
    docType: 'CV', docName: '', docUrl: '',
  });

  const updateMut = useMutation(
    (patch: any) => recruitmentService.update(candidate.id, patch),
    {
      onSuccess: () => { toast({ title: 'Candidature mise à jour', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Mise à jour impossible', description: e.message, variant: 'error' }),
    },
  );

  if (!candidate) return null;
  const next = NEXT_STATUS[f.status];

  const saveStage = () => updateMut.mutate({
    status: f.status,
    interviewDate: f.interviewDate || null,
    testScore: f.testScore !== '' ? Number(f.testScore) : null,
    notes: f.notes,
  });

  return (
    <Modal open={!!candidate} onClose={onClose} title={candidate.fullName} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-[#7a8f80]">Poste</p><p className="text-[#e8ede9]">{posLabel(candidate.position)}</p></div>
          <div><p className="text-xs text-[#7a8f80]">Source</p><p className="text-[#e8ede9]">{srcLabel(candidate.source)}</p></div>
          <div><p className="text-xs text-[#7a8f80]">Téléphone</p><p className="text-[#e8ede9] flex items-center gap-1"><Phone size={11} /> {candidate.phone ?? '—'}</p></div>
          <div><p className="text-xs text-[#7a8f80]">Email</p><p className="text-[#e8ede9] flex items-center gap-1 truncate"><Mail size={11} /> {candidate.email ?? '—'}</p></div>
        </div>

        {/* Pièces du dossier */}
        <div>
          <p className="text-xs font-semibold text-[#e8ede9] mb-2">Pièces du dossier ({(candidate.documents ?? []).length})</p>
          {(candidate.documents ?? []).length === 0 ? (
            <p className="text-xs text-[#7a8f80]/70">Aucune pièce — CV, CNI, diplôme, attestation…</p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {(candidate.documents ?? []).map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                  <p className="text-xs text-[#e8ede9]"><FileText size={11} className="inline mr-1.5 text-[#0f9d70]" />{d.type} — {d.name}</p>
                  <a href={absoluteUploadUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-[#0f9d70] hover:underline">Voir</a>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-[6rem_1fr] gap-2 items-end">
              <Select value={f.docType} onChange={e => setF({ ...f, docType: e.target.value })}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input placeholder="Nom du fichier" value={f.docName} onChange={e => setF({ ...f, docName: e.target.value })} />
            </div>
            <FileDropzone category="hr" value={f.docUrl} onChange={url => setF({ ...f, docUrl: url })} label="Uploader le document" />
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Input placeholder="URL du document (optionnel)" value={f.docUrl} onChange={e => setF({ ...f, docUrl: e.target.value })} />
              <Button size="sm" variant="secondary" disabled={!f.docName || !f.docUrl}
                onClick={() => updateMut.mutate({ documentType: f.docType, documentName: f.docName, documentUrl: f.docUrl })}>
                <FileText size={13} /> Ajouter
              </Button>
            </div>
          </div>
        </div>

        {/* Étape du pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <Select label="Statut" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Input label="Entretien" type="date" value={f.interviewDate} onChange={e => setF({ ...f, interviewDate: e.target.value })} />
          <Input label="Score test /100" type="number" min={0} max={100} value={f.testScore} onChange={e => setF({ ...f, testScore: e.target.value })} />
          <div className="flex gap-2">
            {next && (
              <Button size="sm" onClick={() => { setF(p => ({ ...p, status: next })); updateMut.mutate({ status: next }); }}>
                <ArrowRight size={13} /> {STATUSES.find(s => s.value === next)?.label}
              </Button>
            )}
          </div>
        </div>
        <Textarea label="Notes" rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Retours d'entretien, références…" />

        <div className="flex items-center justify-between pt-1">
          <Button variant="danger" size="sm" onClick={() => onAskDelete(candidate.id)}><Trash2 size={13} /> Supprimer</Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
            <Button size="sm" onClick={saveStage} loading={updateMut.loading}>Enregistrer</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
