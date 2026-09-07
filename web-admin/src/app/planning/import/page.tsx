'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, useToast } from '@/components/ui';
import { useMutation } from '@/hooks/use-query';
import { planningService } from '@/services';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, RefreshCw, AlertTriangle,
  ArrowRight, ChevronLeft, Info, X, CheckSquare, Square,
} from 'lucide-react';

const ACTION_STYLES: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  mise_a_jour: { label: 'Mise à jour', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  ignorée: { label: 'Ignorée', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  invalide: { label: 'Invalide', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMut = useMutation((f: File) => planningService.preview(f), {
    onSuccess: (data: any) => {
      setPreview(data);
      // Importable par défaut : nouvelles + mises à jour
      const importable = (data.rows ?? [])
        .filter((r: any) => r.action === 'nouvelle' || r.action === 'mise_a_jour')
        .map((r: any) => r.dossierNumber);
      setSelected(new Set(importable));
      setStep(2);
    },
    onError: (e: any) => toast({ title: 'Aperçu impossible', description: e.message, variant: 'error' }),
  });

  const confirmMut = useMutation(
    (payload: { fileId: string; selectedRows?: string[] }) => planningService.confirm(payload.fileId, payload.selectedRows),
    {
      onSuccess: (data: any) => { setResult(data); setStep(3); },
      onError: (e: any) => toast({ title: 'Import impossible', description: e.message, variant: 'error' }),
    },
  );

  const onFiles = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      toast({ title: 'Format refusé', description: 'Seuls les fichiers Excel (.xlsx/.xls) sont acceptés', variant: 'error' });
      return;
    }
    setFile(f);
    previewMut.mutate(f);
  }, [previewMut, toast]);

  const stats = preview?.stats ?? {};
  const rows = preview?.rows ?? [];
  const toggle = (dossier: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(dossier)) next.delete(dossier); else next.add(dossier);
      return next;
    });
  };
  const importableAll = rows
    .filter((r: any) => r.action === 'nouvelle' || r.action === 'mise_a_jour')
    .map((r: any) => r.dossierNumber as string);

  const reset = () => {
    setStep(1); setFile(null); setPreview(null); setSelected(new Set()); setResult(null);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Upload size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Import planning SONATEL</h1>
            <p className="text-xs text-[#7a8f80]">Fichier Excel → filtrage ST → aperçu → écriture idempotente</p>
          </div>
        </div>
        <Link href="/planning/import/column-mapping" className="text-sm text-[#0f9d70] hover:underline flex items-center gap-1">
          Configurer le mapping des colonnes <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Fichier' },
          { n: 2, label: 'Aperçu' },
          { n: 3, label: 'Résultat' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ' +
              (step === s.n ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' :
               step > s.n ? 'border-[#0f9d70]/30 text-[#0f9d70]' :
               'border-[#1e2e25] text-[#7a8f80]')
            }>
              <span className={
                'h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ' +
                (step > s.n ? 'bg-[#0f9d70] text-white' : step === s.n ? 'bg-[#0f9d70] text-white' : 'bg-[#1a2420] text-[#7a8f80]')
              }>{step > s.n ? <CheckCircle2 size={12} /> : s.n}</span>
              {s.label}
            </div>
            {i < 2 && <div className={'h-px w-8 ' + (step > s.n ? 'bg-[#0f9d70]/40' : 'bg-[#1e2e25]')} />}
          </div>
        ))}
      </div>

      {/* ── ÉTAPE 1 : FICHIER ── */}
      {step === 1 && (
        <Card className="border-[#1e2e25] bg-[#111916] p-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={
              'flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-16 px-4 text-center cursor-pointer transition-all ' +
              (dragOver ? 'border-[#0f9d70] bg-[#0f9d70]/[0.06]' : 'border-[#1e2e25] hover:border-[#0f9d70]/50 hover:bg-[#0a0f0d]')
            }
          >
            {previewMut.loading ? (
              <>
                <Loader2 size={36} className="text-[#0f9d70] animate-spin mb-3" />
                <p className="text-sm font-medium text-[#e8ede9]">Analyse du fichier…</p>
                <p className="text-xs text-[#7a8f80] mt-1">Filtrage ST, jointure AFFECT, détection doublons</p>
              </>
            ) : (
              <>
                <FileSpreadsheet size={36} className="text-[#0f9d70]/70 mb-3" />
                <p className="text-sm font-medium text-[#e8ede9]">Glissez le fichier Excel SONATEL ici</p>
                <p className="text-xs text-[#7a8f80] mt-1">ou cliquez pour parcourir — .xlsx / .xls, max 20 Mo</p>
                <p className="text-[10px] text-[#7a8f80]/60 mt-3">
                  Onglets reconnus : <b>planning</b> (Demande, Client, Tâche, Zone, Date, OLT, ST) et <b>affect</b> (Equipe, Techniciens)
                </p>
              </>
            )}
            <input
              ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
              onChange={e => onFiles(e.target.files)}
            />
          </div>
        </Card>
      )}

      {/* ── ÉTAPE 2 : APERÇU ── */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-[#e8ede9]">
              <FileSpreadsheet size={16} className="text-[#0f9d70]" />
              <span className="font-medium">{preview.fileName}</span>
              <Badge>{selected.size} sélectionnée(s)</Badge>
            </div>
            <Button variant="secondary" size="sm" onClick={reset}><RefreshCw size={14} /> Autre fichier</Button>
          </div>

          {/* Bannières info */}
          <div className="flex flex-wrap gap-2">
            {!preview.affectSheetFound && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9822B]/40 bg-[#D9822B]/10 px-3 py-1.5 text-xs text-[#D9822B]">
                <AlertTriangle size={13} /> Onglet AFFECT absent — affectation équipe/techniciens ignorée
              </span>
            )}
            {preview.usingDefaultMappings && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e2e25] bg-[#111916] px-3 py-1.5 text-xs text-[#7a8f80]">
                <Info size={13} /> Mapping par défaut SONATEL utilisé
              </span>
            )}
            {preview.subcontractorFilter && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e2e25] bg-[#111916] px-3 py-1.5 text-xs text-[#7a8f80]">
                <Info size={13} /> Filtre ST : « {preview.subcontractorFilter} »
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Lignes totales', value: stats.totalRows, color: 'text-[#e8ede9]' },
              { label: 'Après filtre ST', value: stats.afterSubcontractorFilter, color: 'text-[#e8ede9]' },
              { label: 'Surcharge (SURCH)', value: preview.surchCount ?? 0, color: 'text-[#D9822B]' },
              { label: 'Traitées CRM', value: preview.traiteesCount ?? 0, color: 'text-[#7a8f80]' },
              { label: 'Nouvelles', value: stats.nouvelle, color: 'text-[#0f9d70]' },
              { label: 'Mises à jour', value: stats.mise_a_jour, color: 'text-[#5b8def]' },
              { label: 'Ignorées', value: stats.ignoree, color: 'text-[#7a8f80]' },
              { label: 'Invalides', value: stats.invalide, color: 'text-[#C0392B]' },
            ].map(s => (
              <Card key={s.label} className="p-3">
                <p className="text-[10px] text-[#7a8f80]">{s.label}</p>
                <p className={'text-xl font-bold ' + s.color}>{s.value ?? 0}</p>
              </Card>
            ))}
          </div>

          {/* Tableau des lignes */}
          <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25] max-h-[26rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#1e2e25] bg-[#111916]">
                  <th className="px-3 py-2.5 w-10">
                    <button
                      title="Tout sélectionner (importables)"
                      onClick={() => setSelected(importableAll.length === selected.size ? new Set() : new Set(importableAll))}
                      className="text-[#0f9d70] hover:scale-110 transition-transform"
                    >
                      {importableAll.length === selected.size && importableAll.length > 0 ? <CheckSquare size={16} /> : <Square size={16} className="text-[#7a8f80]" />}
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">N° dossier</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Tâche</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Zone</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                {rows.map((row: any, i: number) => {
                  const isImportable = row.action === 'nouvelle' || row.action === 'mise_a_jour';
                  const a = ACTION_STYLES[row.action] ?? { label: row.action, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
                  return (
                    <tr key={row.dossierNumber ?? i} className={isImportable ? 'hover:bg-[#172019] transition-colors' : 'opacity-50'}>
                      <td className="px-3 py-2 text-center">
                        {isImportable ? (
                          <button onClick={() => toggle(row.dossierNumber)} className={selected.has(row.dossierNumber) ? 'text-[#0f9d70]' : 'text-[#7a8f80]'}>
                            {selected.has(row.dossierNumber) ? <CheckSquare size={15} /> : <Square size={15} />}
                          </button>
                        ) : <X size={14} className="mx-auto text-[#7a8f80]/40" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[#e8ede9]">{row.dossierNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-[#7a8f80] max-w-36 truncate" title={row.client ?? ''}>{row.client ?? '—'}</td>
                      <td className="px-3 py-2 text-[#7a8f80] max-w-36 truncate" title={row.task ?? ''}>{row.task ?? '—'}</td>
                      <td className="px-3 py-2 text-[#7a8f80]">{row.zone ?? '—'}</td>
                      <td className="px-3 py-2 text-[#7a8f80] whitespace-nowrap">{row.dateMission ?? '—'}</td>
                      <td className="px-3 py-2 text-[#7a8f80] max-w-32 truncate" title={(row.technicians ?? []).join(', ')}>{row.team ?? '—'}</td>
                      <td className="px-3 py-2"><Badge className={a.cls}>{a.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#7a8f80]">
              L'écriture est idempotente : un n° de dossier déjà présent est mis à jour, jamais dupliqué.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={reset}><ChevronLeft size={15} /> Annuler</Button>
              <Button
                disabled={selected.size === 0 || confirmMut.loading}
                onClick={() => confirmMut.mutate({ fileId: preview.fileId, selectedRows: Array.from(selected) })}
              >
                {confirmMut.loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Importer {selected.size} mission(s)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : RÉSULTAT ── */}
      {step === 3 && result && (
        <Card className="border-[#1e2e25] bg-[#111916] p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-[#0f9d70] mb-4" />
          <h2 className="text-lg font-bold text-[#e8ede9] mb-1">Import terminé</h2>
          <p className="text-sm text-[#7a8f80] mb-6">{result.fileName}</p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <div className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-6 py-3">
              <p className="text-xs text-[#7a8f80]">Lignes traitées</p>
              <p className="text-2xl font-bold text-[#e8ede9]">{result.selected}</p>
            </div>
            <div className="rounded-lg border border-[#0f9d70]/30 bg-[#0f9d70]/[0.06] px-6 py-3">
              <p className="text-xs text-[#0f9d70]">Missions créées</p>
              <p className="text-2xl font-bold text-[#0f9d70]">{result.created}</p>
            </div>
            <div className="rounded-lg border border-[#5b8def]/30 bg-[#5b8def]/[0.06] px-6 py-3">
              <p className="text-xs text-[#5b8def]">Missions mises à jour</p>
              <p className="text-2xl font-bold text-[#5b8def]">{result.updated}</p>
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}><Upload size={15} /> Importer un autre fichier</Button>
            <Link href="/planning">
              <Button>Voir le planning <ArrowRight size={15} /></Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
