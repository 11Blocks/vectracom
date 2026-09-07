'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { iaVisionService } from '@/services';
import { BrainCircuit, Loader2, RefreshCw, Check, X, ArrowRight, Sparkles } from 'lucide-react';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState('all');

  const { data, loading, refetch } = useQuery(
    () => iaVisionService.listFeedback(tab === 'pending' ? { processed: 'false' } : tab === 'processed' ? { processed: 'true' } : undefined),
    [tab],
  );
  const feedbacks = Array.isArray(data) ? data : [];

  const processMut = useMutation(() => iaVisionService.processFeedback(), {
    onSuccess: (res: any) => {
      toast({ title: 'Feedback traité', description: `${res?.processed ?? 0} correction(s) intégrée(s) au jeu d'entraînement`, variant: 'success' });
      refetch();
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const retrainMut = useMutation(() => iaVisionService.retrain(), {
    onSuccess: (res: any) => {
      toast({ title: 'Réentraînement lancé', description: res?.message ?? res?.status ?? 'Précision recalculée', variant: 'success' });
      refetch();
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const validated = feedbacks.filter((f: any) => f.humanValidation).length;
  const corrected = feedbacks.filter((f: any) => !f.humanValidation).length;
  const precision = feedbacks.length > 0 ? Math.round((validated / feedbacks.length) * 100) : null;
  const pending = feedbacks.filter((f: any) => !f.isProcessedForTraining).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#f5a623]/15 text-[#f5a623]"><BrainCircuit size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Active Learning — IA Vision</h1>
            <p className="text-xs text-[#7a8f80]">Les corrections humaines alimentent le réentraînement — l'IA gagne en précision chaque mois</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ai" onClick={() => processMut.mutate()} disabled={processMut.loading || pending === 0}>
            {processMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Traiter le feedback ({pending})
          </Button>
          <Button onClick={() => retrainMut.mutate()} disabled={retrainMut.loading}>
            {retrainMut.loading ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />} Réentraîner
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Corrections totales</p><p className="text-2xl font-bold text-[#e8ede9]">{feedbacks.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#0f9d70] mb-1">Validées sans correction</p><p className="text-2xl font-bold text-[#0f9d70]">{validated}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#D9822B] mb-1">Corrigées par l'humain</p><p className="text-2xl font-bold text-[#D9822B]">{corrected}</p></Card>
        <Card className="p-4 border-[#f5a623]/30"><p className="text-xs text-[#f5a623] mb-1 flex items-center gap-1"><Sparkles size={11} /> Précision IA</p><p className="text-2xl font-bold text-[#f5a623]">{precision !== null ? `${precision}%` : '—'}</p></Card>
      </div>

      {/* Boucle Active Learning */}
      <Card className="border-[#f5a623]/30 bg-[#111916] p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a8f80]">
          {['Photo → IA Vision', 'Proposition (confiance %)', 'Validation humaine', 'Correction enregistrée', 'Réentraînement'].map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              {i > 0 && <ArrowRight size={12} className="text-[#1e2e25]" />}
              <span className="rounded-full border border-[#1e2e25] px-2.5 py-1">{step}</span>
            </span>
          ))}
        </div>
      </Card>

      <Tabs
        tabs={[
          { value: 'all', label: 'Toutes', count: feedbacks.length },
          { value: 'pending', label: 'À traiter' },
          { value: 'processed', label: 'Intégrées' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : feedbacks.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <BrainCircuit size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucun feedback — validez ou corrigez des analyses IA Vision pour alimenter la boucle</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((f: any) => (
            <Card key={f.id} className="border-[#1e2e25] bg-[#111916] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Badge className="bg-[#1a2420] text-[#e8ede9] border-[#1e2e25]">{f.aiDetectedRubrique ?? '—'}</Badge>
                    {f.humanValidation
                      ? <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30"><Check size={10} className="mr-1" />Validée</Badge>
                      : <Badge className="bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30"><X size={10} className="mr-1" />Corrigée</Badge>}
                    {f.isProcessedForTraining
                      ? <Badge className="bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30">Intégrée au training</Badge>
                      : <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">En attente</Badge>}
                    <span className="text-xs text-[#7a8f80]">{fmtDate(f.correctedAt ?? f.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-[#f5a623]/25 bg-[#f5a623]/[0.04] px-2.5 py-1.5">
                      <span className="text-[#f5a623]/70">IA : </span>
                      <span className="text-[#e8ede9]">{f.aiDetectedRubrique}{f.aiDetectedDefaut ? ` / ${f.aiDetectedDefaut}` : ''}{f.aiDetectedReference ? ` (${f.aiDetectedReference})` : ''}</span>
                      {f.aiConfidence !== null && f.aiConfidence !== undefined && <span className="text-[#f5a623] ml-1">· {Number(f.aiConfidence)}%</span>}
                    </div>
                    <div className="rounded-lg border border-[#0f9d70]/25 bg-[#0f9d70]/[0.04] px-2.5 py-1.5">
                      <span className="text-[#0f9d70]/80">Humain : </span>
                      <span className="text-[#e8ede9]">{f.humanCorrectionRubrique ?? f.aiDetectedRubrique}{f.humanCorrectionDefaut ? ` / ${f.humanCorrectionDefaut}` : ''}{f.humanCorrectionReference ? ` (${f.humanCorrectionReference})` : ''}</span>
                    </div>
                  </div>
                  {f.correctionReason && <p className="text-xs text-[#7a8f80] italic mt-1.5">Motif : {f.correctionReason}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
