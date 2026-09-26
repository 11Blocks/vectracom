'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Input, AiBlock, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { iaVisionService, absoluteUploadUrl } from '@/services';
import {
  Eye, Upload, Loader2, Trash2, CheckCircle2, XCircle, Link2, ScanSearch,
  Image as ImageIcon, AlertTriangle, FileText, History,
} from 'lucide-react';

const FLAG_LABELS: Record<string, string> = {
  nettete_insuffisante: 'Netteté insuffisante',
  luminosite_faible: 'Luminosité faible',
  cadrage_incline: 'Cadrage incliné',
  photo_hors_sujet: 'Photo hors sujet',
  resolution_insuffisante: 'Résolution insuffisante (< 480 px)',
  resolution_limitee: 'Résolution limitée (< 720 px)',
  ratio_inhabituel: 'Ratio inhabituel',
  fichier_trop_lourd: 'Fichier trop lourd (> 4 Mo)',
  format_webp_a_verifier: 'Format WebP à vérifier',
  dimensions_illisibles: 'Dimensions illisibles',
  format_inattendu: 'Format inattendu',
  url_non_securisee: 'URL non sécurisée',
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [urlResult, setUrlResult] = useState<any>(null);
  const [lastUpload, setLastUpload] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: analyses, loading, refetch } = useQuery(() => iaVisionService.listAnalyses({ pending: 'true' }), []);
  const { data: feedbacks } = useQuery(() => iaVisionService.listFeedback(), []);
  const { data: uploads, loading: uploadsLoading, refetch: refetchUploads } = useQuery(() => iaVisionService.listUploads(), []);

  const uploadMut = useMutation((file: File) => iaVisionService.upload(file), {
    onSuccess: (res: any) => {
      setLastUpload(res);
      refetchUploads();
      toast({
        title: res.verdict === 'accepte' ? 'Pré-audit : photo acceptable' : 'Pré-audit : photo à reprendre',
        description: `Score ${res.score}/100${res.flags.length ? ' — ' + res.flags.map((f: string) => FLAG_LABELS[f] ?? f).join(', ') : ''}`,
        variant: res.verdict === 'accepte' ? 'success' : 'warning',
      });
    },
    onError: (e: Error) => toast({ title: 'Upload impossible', description: e.message, variant: 'error' }),
  });

  const analyzeMut = useMutation((data: { imageUrl: string; annotation?: string }) => iaVisionService.analyze(data.imageUrl, data.annotation), {
    onSuccess: (res) => { setUrlResult(res); refetch(); toast({ title: 'Analyse IA terminée', variant: 'success' }); },
    onError: (e) => toast({ title: 'Erreur IA', description: e.message, variant: 'error' }),
  });

  const validateMut = useMutation(({ id, status }: { id: string; status: string }) => iaVisionService.validate(id, { validationStatus: status }), {
    onSuccess: () => { toast({ title: 'Validation enregistrée', variant: 'success' }); refetch(); },
    onError: (e) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const deleteUploadMut = useMutation((id: string) => iaVisionService.deleteUpload(id), {
    onSuccess: () => { toast({ title: 'Analyse supprimée', variant: 'success' }); setDeleteId(null); refetchUploads(); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast({ title: 'Format non supporté', description: 'JPEG, PNG ou WebP uniquement.', variant: 'warning' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Fichier trop lourd', description: '8 Mo maximum.', variant: 'warning' });
      return;
    }
    uploadMut.mutate(file);
  };

  const list = Array.isArray(analyses) ? analyses : [];
  const fbList = Array.isArray(feedbacks) ? feedbacks : [];
  const uploadList = Array.isArray(uploads) ? uploads : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><Eye size={20} className="text-[#f5a623]" /> IA Vision</h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            Pré-audit des photos terrain (upload web) + analyse des signalements — l&apos;IA propose, la décision reste humaine
          </p>
        </div>
        <Link href="/ia-vision/feedback"><Button variant="outline" size="sm"><History size={14} /> Feedback & active learning ({fbList.length})</Button></Link>
      </div>

      {/* ── Zone d'upload drag & drop ── */}
      <AiBlock title="Pré-audit photo — déposez une photo terrain">
        <div className="space-y-3">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={
              'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ' +
              (dragOver ? 'border-[#f5a623] bg-[#f5a623]/10' : 'border-[#f5a623]/30 bg-[#f5a623]/[0.03] hover:border-[#f5a623]/60')
            }
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleFiles(e.target.files)} />
            {uploadMut.loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="text-[#f5a623] animate-spin" />
                <p className="text-sm text-[#e8ede9]">Analyse des octets en cours…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="p-3 rounded-xl bg-[#f5a623]/15 text-[#f5a623]"><Upload size={24} /></span>
                <p className="text-sm text-[#e8ede9] font-medium">Glissez une photo ici ou cliquez pour parcourir</p>
                <p className="text-xs text-[#7a8f80]">JPEG, PNG ou WebP · 8 Mo max · netteté, résolution et cadrage vérifiés avant validation terrain</p>
              </div>
            )}
          </div>

          {/* Résultat du dernier upload */}
          {lastUpload && (
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4 rounded-xl border border-[#f5a623]/25 bg-[#f5a623]/[0.04] p-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={absoluteUploadUrl(lastUpload.imageUrl)} alt={lastUpload.originalName}
                  className="w-full h-32 object-cover rounded-lg border border-[#1e2e25]" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {lastUpload.verdict === 'accepte'
                    ? <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30"><CheckCircle2 size={11} className="mr-1" /> acceptable</Badge>
                    : <Badge className="bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30"><XCircle size={11} className="mr-1" /> à reprendre</Badge>}
                  <span className="text-sm font-bold text-[#e8ede9] tabular-nums">{lastUpload.score}/100</span>
                  <span className="text-xs text-[#7a8f80]">{lastUpload.width && lastUpload.height ? `${lastUpload.width}×${lastUpload.height} px` : 'dimensions illisibles'} · {(lastUpload.sizeBytes / 1024).toFixed(0)} Ko</span>
                </div>
                {lastUpload.flags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lastUpload.flags.map((f: string) => (
                      <Badge key={f} className="bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30">
                        <AlertTriangle size={10} className="mr-1" /> {FLAG_LABELS[f] ?? f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#0f9d70]">Aucune anomalie détectée — photo conforme au référentiel.</p>
                )}
                <p className="text-[10px] text-[#7a8f80]">Analyse déterministe (octets réels : dimensions, ratio, poids, format) — branchement Gemini possible. Le verdict est une proposition : la validation reste humaine.</p>
              </div>
            </div>
          )}
        </div>
      </AiBlock>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Historique des pré-audits ── */}
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <h3 className="text-sm font-semibold text-[#e8ede9] p-4 pb-3 flex items-center gap-2">
            <ScanSearch size={15} className="text-[#f5a623]" /> Historique des pré-audits ({uploadList.length})
          </h3>
          {uploadsLoading ? (
            <div className="px-4 pb-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : uploadList.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-[#7a8f80]/70">Aucun pré-audit — déposez une photo ci-dessus.</p>
          ) : (
            <div className="divide-y divide-[#1e2e25]/50 max-h-96 overflow-y-auto">
              {uploadList.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#172019] transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={absoluteUploadUrl(u.imageUrl)} alt={u.originalName} className="h-12 w-12 object-cover rounded-md border border-[#1e2e25] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-[#e8ede9] truncate">{u.originalName}</p>
                      {u.verdict === 'accepte'
                        ? <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30 text-[9px]">{u.score}</Badge>
                        : <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30 text-[9px]">{u.score}</Badge>}
                    </div>
                    <p className="text-[10px] text-[#7a8f80] truncate">
                      {u.width && u.height ? `${u.width}×${u.height}` : '—'} · {new Date(u.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {u.flags.length > 0 && ` · ${u.flags.map((f: string) => FLAG_LABELS[f] ?? f).join(', ')}`}
                    </p>
                  </div>
                  <a href={absoluteUploadUrl(u.imageUrl)} target="_blank" rel="noreferrer" className="text-[#7a8f80] hover:text-[#0f9d70] shrink-0" title="Ouvrir l'image"><ImageIcon size={13} /></a>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#7a8f80] hover:text-[#C0392B] shrink-0" onClick={() => setDeleteId(u.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Analyse par URL (signalements) ── */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2">
            <Link2 size={15} className="text-[#f5a623]" /> Analyser un signalement par URL
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="URL de l'image (https://…)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
              <Input placeholder="Annotation (optionnel)" value={annotation} onChange={e => setAnnotation(e.target.value)} />
            </div>
            <Button variant="ai" onClick={() => analyzeMut.mutate({ imageUrl, annotation: annotation || undefined })} loading={analyzeMut.loading} disabled={!imageUrl}>
              <ScanSearch size={14} /> Analyser (détection + classification)
            </Button>
            {urlResult && (
              <div className="rounded-lg border border-[#f5a623]/20 bg-[#f5a623]/5 p-4 space-y-1">
                <p className="text-sm text-[#f5a623] font-semibold">{urlResult.analysis?.rubriqueDetected || 'Non classé'}</p>
                <p className="text-xs text-[#7a8f80]">Confiance : {Number(urlResult.analysis?.confidenceRubrique) || 0}%</p>
                {urlResult.analysis?.pboReferenceDetected && <p className="text-xs text-[#7a8f80]">Réf : {urlResult.analysis.pboReferenceDetected}</p>}
                {urlResult.analysis?.suggestedMissionType && <p className="text-xs text-[#7a8f80]">Mission suggérée : {urlResult.analysis.suggestedMissionType}</p>}
              </div>
            )}
            <p className="text-[10px] text-[#7a8f80]">Flux mobile : la photo d&apos;un signalement WhatsApp est analysée (détection + rubrique), puis validée par un humain.</p>
          </div>
        </Card>
      </div>

      {/* ── Analyses en attente de validation ── */}
      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <h3 className="text-sm font-semibold text-[#e8ede9] p-4 pb-3">Analyses en attente de validation humaine ({list.length})</h3>
        {loading ? (
          <div className="px-4 pb-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : list.length === 0 ? (
          <div className="px-4 pb-6">
            <EmptyState icon={<FileText size={32} className="text-[#7a8f80]/40" />} title="Aucune analyse en attente" description="Les analyses des signalements apparaissent ici pour validation." />
          </div>
        ) : (
          <div className="divide-y divide-[#1e2e25]/50">
            {list.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#e8ede9] truncate">{a.analysis?.rubriqueDetected ?? 'Non classé'} — {Math.round(Number(a.analysis?.confidenceRubrique ?? 0))}%</p>
                  <p className="text-[10px] text-[#7a8f80] font-mono truncate">{a.imageUrl}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="h-8 px-2 text-xs" onClick={() => validateMut.mutate({ id: a.id, status: 'valide' })}><CheckCircle2 size={12} /> Valider</Button>
                  <Button size="sm" variant="danger" className="h-8 px-2 text-xs" onClick={() => validateMut.mutate({ id: a.id, status: 'rejete' })}><XCircle size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer l'analyse"
        message="Le fichier et son pré-audit seront définitivement supprimés." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteUploadMut.mutate(deleteId)} />
    </div>
  );
}
