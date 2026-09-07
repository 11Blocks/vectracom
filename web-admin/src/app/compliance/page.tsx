'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Textarea, useToast, Tabs, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { complianceService, teamsService, absoluteUploadUrl } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import {
  ShieldCheck, Send, Eye, Loader2, Plus, Trash2, FileCheck2, Bell,
  Building2, HardHat, Recycle, CheckCircle2, XCircle, ListChecks, ChevronRight, FileSpreadsheet,
} from 'lucide-react';

const HABILITATION_DOMAINS = [
  { value: 'deploiement_plaque', label: 'Déploiement Plaque' },
  { value: 'densif_ftth', label: 'Densif FTTH' },
  { value: 'extension_ftth', label: 'Extension FTTH' },
  { value: 'osm', label: 'OSM' },
  { value: 'fttm', label: 'FTTM' },
  { value: 'devoiement', label: 'Dévoiement' },
  { value: 'rehabilitation', label: 'Réhabilitation' },
  { value: 'backbone', label: 'Backbone' },
  { value: 'basculement_upgrade', label: 'Basculement Upgrade' },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  incomplet: { label: 'Incomplet', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  en_attente: { label: 'En attente', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  valide: { label: 'Validé', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  rejete: { label: 'Rejeté', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  a_corriger: { label: 'À corriger', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
};
const PILLARS: Record<string, { label: string; desc: string; icon: any }> = {
  code_conduite: { label: 'Code de Conduite Fournisseur', desc: 'Anti-corruption, droit du travail, RSE', icon: Building2 },
  charte_sst: { label: 'Directives SST', desc: 'EPI, travaux en hauteur, habilitations', icon: HardHat },
  dechets_d3e: { label: 'Gestion des déchets D3E', desc: 'Recyclage câbles, tourets, équipements', icon: Recycle },
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState('dossiers');
  const [detail, setDetail] = useState<any | null>(null);
  const [showCreateRecord, setShowCreateRecord] = useState(false);

  const { data: records, loading, refetch } = useQuery(() => complianceService.listRecords(), []);
  const { data: teams } = useQuery(() => teamsService.list(), []);
  const { data: docs, refetch: refetchDocs } = useQuery(() => complianceService.listDocuments(), []);
  const { data: summary } = useQuery(() => complianceService.contractSummary(), []);
  const teamsList = Array.isArray(teams) ? teams : [];
  const recList = Array.isArray(records) ? records : [];
  const docList = Array.isArray(docs) ? docs : [];
  const recTeamIds = new Set(recList.map((r: any) => r.teamId));

  const relanceMut = useMutation(
    (r: any) => complianceService.updateRecord(r.id, {
      observations: `${r.observations ? r.observations + '\n' : ''}[Relance envoyée le ${new Date().toLocaleDateString('fr-FR')}]`,
    }),
    {
      onSuccess: () => { toast({ title: 'Relance envoyée', description: 'Tracée dans les observations du dossier', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const createRecordMut = useMutation((teamId: string) => complianceService.createRecord(teamId), {
    onSuccess: () => { toast({ title: 'Dossier créé', variant: 'success' }); setShowCreateRecord(false); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const export3stbMut = useMutation(
    async () => {
      const blob = await complianceService.exportValidation3stb();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VALIDATION-3STB-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    {
      onSuccess: () => toast({ title: 'Export VALIDATION 3STB', variant: 'success' }),
      onError: (e: any) => toast({ title: 'Export impossible', description: e.message, variant: 'error' }),
    },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ShieldCheck size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Conformité SONATEL</h1>
            <p className="text-xs text-[#7a8f80]">Gestion des dossiers de conformité et documents réglementaires</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => export3stbMut.mutate()} loading={export3stbMut.loading}>
            <FileSpreadsheet size={14} /> VALIDATION 3STB
          </Button>
          <Button variant="secondary" onClick={() => relanceMut.mutate(recList.find((r: any) => r.status === 'incomplet' || r.status === 'a_corriger'))} disabled={relanceMut.loading || !recList.some((r: any) => r.status === 'incomplet' || r.status === 'a_corriger')}>
            <Send size={15} /> Envoyer relance
          </Button>
        </div>
      </div>

      {/* 3 piliers contractuels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(summary?.pillars ?? []).map((p: any) => {
          const meta = PILLARS[p.pillar] ?? { label: p.pillar, desc: '', icon: FileCheck2 };
          const Icon = meta.icon;
          return (
            <Card key={p.pillar} className={'p-4 ' + (p.signed ? 'border-[#0f9d70]/30' : 'border-[#D9822B]/40')}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className={'p-2 rounded-lg ' + (p.signed ? 'bg-[#0f9d70]/15 text-[#0f9d70]' : 'bg-[#D9822B]/15 text-[#D9822B]')}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#e8ede9]">{meta.label}</p>
                    <p className="text-xs text-[#7a8f80] mt-0.5">{meta.desc}</p>
                  </div>
                </div>
                {p.signed
                  ? <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30"><CheckCircle2 size={11} className="mr-1" /> Signé</Badge>
                  : <Badge className="bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30"><XCircle size={11} className="mr-1" /> À signer</Badge>}
              </div>
            </Card>
          );
        })}
      </div>

      <Tabs
        tabs={[
          { value: 'dossiers', label: 'Dossiers équipe', count: recList.length },
          { value: 'documents', label: 'Documents entreprise', count: docList.length },
          { value: 'checklists', label: 'Checklists' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ── DOSSIERS ÉQUIPE ── */}
      {tab === 'dossiers' && (
        loading ? <Skeleton className="h-64" /> : recList.length === 0 ? (
          <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
            <ShieldCheck size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
            <p className="text-sm text-[#7a8f80] mb-4">Aucun dossier de conformité — créez-en un par équipe</p>
            <Button onClick={() => setShowCreateRecord(true)}><Plus size={15} /> Créer un dossier</Button>
          </Card>
        ) : (
          <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e2e25]">
              <h3 className="text-sm font-semibold text-[#e8ede9]">Statut des dossiers par équipe</h3>
              <p className="text-xs text-[#7a8f80] mt-0.5">Suivi de la conformité des documents pour chaque équipe terrain</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2e25] bg-[#111916]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Observations</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Dernière MAJ</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                  {recList.map((r: any) => {
                    const meta = STATUS_META[r.status] ?? { label: r.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
                    const needsAction = r.status === 'incomplet' || r.status === 'a_corriger' || r.status === 'rejete';
                    return (
                      <tr key={r.id} className="hover:bg-[#172019] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-[#e8ede9]">{r.team?.name ?? '—'}</td>
                        <td className="px-4 py-2.5"><Badge className={meta.cls}>{meta.label}</Badge></td>
                        <td className="px-4 py-2.5 text-[#7a8f80] max-w-64 truncate" title={r.observations ?? ''}>{r.observations ?? '—'}</td>
                        <td className="px-4 py-2.5 text-[#7a8f80]">{fmtDate(r.updatedAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setDetail(r)}>
                              <Eye size={13} className="mr-1" /> Voir détail
                            </Button>
                            {needsAction && (
                              <Button size="sm" variant="secondary" className="h-8 px-2 text-xs" disabled={relanceMut.loading} onClick={() => relanceMut.mutate(r)}>
                                <Send size={12} className="mr-1" /> Relancer
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {teamsList.some((t: any) => !recTeamIds.has(t.id)) && (
              <div className="px-4 py-2.5 border-t border-[#1e2e25] text-right">
                <Button size="sm" variant="ghost" className="text-xs text-[#0f9d70]" onClick={() => setShowCreateRecord(true)}>
                  <Plus size={13} /> Créer un dossier pour une équipe non couverte
                </Button>
              </div>
            )}
          </Card>
        )
      )}

      {/* ── DOCUMENTS ENTREPRISE ── */}
      {tab === 'documents' && <DocumentsTab docs={docList} onChanged={() => { refetch(); refetchDocs(); }} />}

      {/* ── CHECKLISTS (renvoi éditeur dédié) ── */}
      {tab === 'checklists' && (
        <Card className="border-[#1e2e25] bg-[#111916] p-8 text-center">
          <ListChecks size={36} className="mx-auto text-[#0f9d70]/60 mb-3" />
          <p className="text-sm text-[#e8ede9] mb-1">Éditeur de checklists paramétrables</p>
          <p className="text-xs text-[#7a8f80] mb-4">Par type de mission (FTTH, SAV, INFRA, OSM…) — jamais codées en dur, condition de revente à d'autres sous-traitants.</p>
          <Button onClick={() => router.push('/compliance/checklists')}>Ouvrir l'éditeur <ChevronRight size={14} /></Button>
        </Card>
      )}

      <RecordDetailModal record={detail} onClose={() => setDetail(null)} onDone={refetch} />

      <Modal open={showCreateRecord} onClose={() => setShowCreateRecord(false)} title="Créer un dossier de conformité">
        <div className="space-y-3">
          <p className="text-sm text-[#7a8f80]">Sélectionnez l'équipe — le dossier démarre au statut « Incomplet ».</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {teamsList.filter((t: any) => !recTeamIds.has(t.id)).map((t: any) => (
              <button key={t.id} onClick={() => createRecordMut.mutate(t.id)}
                className="w-full rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2.5 text-left text-sm text-[#e8ede9] hover:border-[#0f9d70]/50 transition-colors">
                {t.name}
                {t.zone && <span className="text-xs text-[#7a8f80] ml-2">· {t.zone}</span>}
              </button>
            ))}
            {teamsList.every((t: any) => recTeamIds.has(t.id)) && (
              <p className="text-xs text-[#7a8f80]">Toutes les équipes ont déjà un dossier.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═════════════════ DÉTAIL DOSSIER ═════════════════ */
function RecordDetailModal({ record, onClose, onDone }: { record: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState('incomplet');
  const [obs, setObs] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [step, setStep] = useState('documentaire');

  useEffect(() => {
    if (record) {
      setStatus(record.status);
      setObs(record.observations ?? '');
      setDomains(record.habilitationDomains ?? []);
      setStep(record.validationStep ?? 'documentaire');
    }
  }, [record]);

  const toggleDomain = (d: string) =>
    setDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const habMut = useMutation(
    () => complianceService.updateHabilitation(record.id, { habilitationDomains: domains, validationStep: step }),
    {
      onSuccess: () => { toast({ title: 'Habilitation enregistrée', description: 'Format VALIDATION EQUIPES 3STB.', variant: 'success' }); onDone(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const mut = useMutation(
    (d: any) => complianceService.updateRecord(record.id, d),
    {
      onSuccess: () => { toast({ title: 'Dossier mis à jour', variant: 'success' }); onClose(); onDone(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  if (!record) return null;

  return (
    <Modal open={!!record} onClose={onClose} title={`Dossier — ${record.team?.name ?? ''}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-[#7a8f80]">Équipe</p><p className="text-[#e8ede9]">{record.team?.name ?? '—'}</p></div>
          <div><p className="text-xs text-[#7a8f80]">Type</p><p className="text-[#e8ede9]">{record.team?.type ?? '—'}</p></div>
        </div>
        <div>
        <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25]">
          <p className="text-xs font-semibold text-[#e8ede9] mb-2">Domaines d'habilitation — format VALIDATION EQUIPES 3STB</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {HABILITATION_DOMAINS.map(d => (
              <button key={d.value} type="button" onClick={() => toggleDomain(d.value)}
                className={'rounded-lg border p-2 text-left text-xs transition-all ' + (domains.includes(d.value) ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] bg-[#0a0f0d] text-[#7a8f80] hover:border-[#0f9d70]/40')}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 mt-3">
            <div className="flex-1">
              <p className="text-[10px] text-[#7a8f80] mb-1">Étape de validation SONATEL (3 niveaux)</p>
              <div className="flex gap-1">
                {['documentaire', 'physique', 'competences'].map(st => (
                  <button key={st} type="button" onClick={() => setStep(st)}
                    className={'flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-all ' + (step === st ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80]')}>
                    {st === 'competences' ? 'compétences' : st}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => habMut.mutate()} loading={habMut.loading}>Enregistrer</Button>
          </div>
        </div>
                  <p className="text-xs text-[#7a8f80] mb-1.5">Statut du dossier</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <button key={k} onClick={() => setStatus(k)}
                className={'rounded-lg border px-1 py-2 text-[11px] font-medium transition-all ' + (status === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <Textarea label="Observations (pièces manquantes, remarques SONATEL…)" value={obs} onChange={e => setObs(e.target.value)} rows={4} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={mut.loading} onClick={() => mut.mutate({ status, observations: obs })}>
            {mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═════════════════ DOCUMENTS ENTREPRISE ═════════════════ */
function DocumentsTab({ docs, onChanged }: { docs: any[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, any>>({ docType: 'code_conduite', fileUrl: '', signed: false });

  const addMut = useMutation((d: any) => complianceService.addDocument(d), {
    onSuccess: () => { toast({ title: 'Document ajouté', variant: 'success' }); setShowAdd(false); setF({ docType: 'code_conduite', fileUrl: '', signed: false }); onChanged(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const signMut = useMutation(
    ({ id, signed }: any) => complianceService.updateDocument(id, { signed, signedAt: signed ? new Date().toISOString().slice(0, 10) : null }),
    {
      onSuccess: () => { toast({ title: 'Document mis à jour', variant: 'success' }); onChanged(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const delMut = useMutation((id: string) => complianceService.deleteDocument(id), {
    onSuccess: () => { toast({ title: 'Document supprimé', variant: 'success' }); setDeleteId(null); onChanged(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <Card className="border-[#1e2e25] bg-[#111916] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#e8ede9]">Documents contractuels de l'entreprise</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={13} /> Ajouter</Button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-[#7a8f80] py-6 text-center">Aucun document — ajoutez les 3 piliers : Code de Conduite, Directives SST, Déchets D3E.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => {
            const p = PILLARS[d.docType] ?? { label: d.docType, desc: '', icon: FileCheck2 };
            const Icon = p.icon;
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={16} className="text-[#7a8f80] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#e8ede9] truncate">{p.label}</p>
                    <p className="text-[10px] text-[#7a8f80]">{d.signedAt ? `signé le ${fmtDate(d.signedAt)}` : 'non signé'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={absoluteUploadUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-[#0f9d70] hover:underline">Voir</a>
                  <Button size="sm" variant={d.signed ? 'outline' : 'primary'} className="h-7 px-2 text-xs"
                    disabled={signMut.loading} onClick={() => signMut.mutate({ id: d.id, signed: !d.signed })}>
                    {d.signed ? 'Annuler signature' : 'Marquer signé'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(d.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un document contractuel">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PILLARS).map(([k, p]) => {
              const Icon = p.icon;
              return (
                <button key={k} onClick={() => setF({ ...f, docType: k })}
                  className={'rounded-lg border p-3 text-center transition-all ' + (f.docType === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
                  <Icon size={16} className="mx-auto mb-1" />
                  <span className="text-[11px] font-medium">{p.label}</span>
                </button>
              );
            })}
          </div>
          <FileDropzone category="compliance" value={f.fileUrl} onChange={url => setF({ ...f, fileUrl: url })} label="Uploader le document" />
          <Input label="URL du document (optionnel)" value={f.fileUrl} onChange={e => setF({ ...f, fileUrl: e.target.value })} placeholder="https://… ou /uploads/…" />
          <label className="flex items-center gap-2 text-sm text-[#e8ede9] cursor-pointer">
            <input type="checkbox" checked={f.signed} onChange={e => setF({ ...f, signed: e.target.checked })}
              className="h-4 w-4 accent-[#0f9d70]" />
            Déjà signé
          </label>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button disabled={addMut.loading || !f.fileUrl} onClick={() => addMut.mutate(f)}>
              {addMut.loading && <Loader2 size={14} className="animate-spin" />} Ajouter
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le document"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteId && delMut.mutate(deleteId)} />
    </Card>
  );
}
