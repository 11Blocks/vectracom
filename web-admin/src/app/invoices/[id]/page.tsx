'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Textarea, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { invoicesService, invoiceExtras } from '@/services';
import {
  ArrowLeft, Loader2, FileDown, FileSpreadsheet, Edit3, CheckCircle2, Lock,
  AlertTriangle, Receipt, History, Trash2, Save, X, Plus,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  finalisee: { label: 'Finalisée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
};

function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' FCFA';
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [showCorrect, setShowCorrect] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalizeNotes, setFinalizeNotes] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const { data, loading, refetch } = useQuery(() => invoicesService.get(String(id)), [id]);

  const user = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('vectracom_user') || 'null') : null;
  const canEdit = user && ['admin', 'direction', 'super_admin', 'finance_admin', 'support_admin'].includes(user.role);
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  const finalizeMut = useMutation(
    (notes: string) => invoicesService.finalize(String(id), notes || undefined),
    {
      onSuccess: () => { toast({ title: 'Facture finalisée', variant: 'success' }); setShowFinalize(false); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const deleteMut = useMutation(() => invoicesService.delete(String(id)), {
    onSuccess: () => { toast({ title: 'Facture supprimée', variant: 'success' }); router.push('/invoices'); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const [showExtra, setShowExtra] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);

  const doExportAttachement = async () => {
    try {
      setAttachLoading(true);
      const blob = await invoiceExtras.exportAttachement(String(id));
      downloadBlob(blob, `${data?.invoiceNumber ?? 'facture'}-attachement.xlsx`);
      toast({ title: 'Attachement ONCOMIT généré', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    } finally {
      setAttachLoading(false);
    }
  };

  const doExport = async (kind: 'pdf' | 'excel') => {
    try {
      const blob = kind === 'pdf'
        ? await invoicesService.exportPdf(String(id))
        : await invoicesService.exportExcel(String(id));
      downloadBlob(blob, `facture-${data?.invoiceNumber ?? id}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast({ title: kind === 'pdf' ? 'PDF généré' : 'Excel généré', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (!data) return <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center"><p className="text-sm text-[#7a8f80]">Facture introuvable</p></Card>;

  const inv = data;
  const lines = inv.lines ?? [];
  const penalties = inv.penalties ?? [];
  const corrections = inv.corrections ?? [];
  const meta = STATUS_META[inv.status] ?? { label: inv.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
  const isDraft = inv.status === 'brouillon';

  return (
    <div className="space-y-4 max-w-5xl">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => router.push('/invoices')} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-2">
            <ArrowLeft size={15} /> Retour aux factures
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><Receipt size={20} className="text-[#0f9d70]" /> {inv.invoiceNumber}</h1>
            <Badge className={meta.cls}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-[#7a8f80] mt-1">
            Période : {fmtDate(inv.periodStart)} → {fmtDate(inv.periodEnd)}
            {inv.finalizedAt ? ` · finalisée le ${fmtDateTime(inv.finalizedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => doExport('pdf')}><FileDown size={15} /> PDF</Button>{' '}
            <Button variant="outline" size="sm" onClick={doExportAttachement} disabled={attachLoading}>
              <FileSpreadsheet size={14} /> Attachement ONCOMIT
            </Button>
          <Button variant="secondary" onClick={() => doExport('excel')}><FileSpreadsheet size={15} /> Excel</Button>
          {canEdit && isDraft && (
            <>
              <Button variant="outline" onClick={() => setShowCorrect(true)}><Edit3 size={15} /> Corriger des lignes</Button>
              {isDraft && (
              <Button variant="outline" onClick={() => setShowExtra(true)}><Plus size={15} /> Ligne spéciale</Button>
            )}
            <Button onClick={() => setShowFinalize(true)}><CheckCircle2 size={15} /> Finaliser</Button>
            </>
          )}
          {isAdmin && isDraft && (
            <Button variant="ghost" className="text-[#C0392B]" onClick={() => setShowDelete(true)}><Trash2 size={15} /></Button>
          )}
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Total HT</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(inv.totalHt)}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">TVA (18%)</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(inv.totalTva)}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#D9822B] mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Pénalités KPI</p><p className="text-xl font-bold text-[#D9822B]">-{fmtFCFA(inv.penaltiesTotal)}</p></Card>
        <Card className="p-4 border-[#0f9d70]/30"><p className="text-xs text-[#0f9d70] mb-1">Total TTC</p><p className="text-xl font-bold text-[#0f9d70]">{fmtFCFA(inv.totalTtc)}</p></Card>
      </div>

      {/* Lignes */}
      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2e25] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#e8ede9]">Lignes de facturation ({lines.length})</h3>
          {!isDraft && <span className="text-xs text-[#7a8f80] flex items-center gap-1"><Lock size={11} /> Lecture seule</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Type d'item</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Catégorie</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Quantité</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">PU</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50">
              {lines.map((l: any) => (
                <tr key={l.id} className="hover:bg-[#172019] transition-colors">
                  <td className="px-4 py-2.5 text-[#e8ede9] font-medium">{l.itemType}</td>
                  <td className="px-4 py-2.5"><Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{l.category}</Badge></td>
                  <td className="px-4 py-2.5 text-right text-[#7a8f80]">{l.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-[#7a8f80]">{fmtFCFA(l.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right text-[#e8ede9] font-semibold">{fmtFCFA(l.total)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#7a8f80]">Aucune ligne</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pénalités KPI */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#D9822B] mb-3 flex items-center gap-2"><AlertTriangle size={15} /> Pénalités KPI appliquées ({penalties.length})</h3>
          {penalties.length === 0 ? (
            <p className="text-xs text-[#7a8f80]">Aucune pénalité sur cette période — tous les KPI sont au niveau.</p>
          ) : (
            <div className="space-y-2">
              {penalties.map((p: any, i: number) => (
                <div key={p.id ?? i} className="rounded-lg border border-[#D9822B]/30 bg-[#D9822B]/[0.06] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#e8ede9]">{p.kpiName}</span>
                    <span className="text-sm font-bold text-[#D9822B]">-{fmtFCFA(p.penaltyAmount)}</span>
                  </div>
                  <p className="text-xs text-[#7a8f80] mt-0.5">
                    Cible {Number(p.target)}% · Réalisé {Number(p.actual)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Historique des corrections */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><History size={15} className="text-[#7a8f80]" /> Corrections ({corrections.length})</h3>
          {corrections.length === 0 ? (
            <p className="text-xs text-[#7a8f80]">Aucune correction — facture conforme au bordereau.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {corrections.map((c: any, i: number) => (
                <div key={i} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[#e8ede9]">{c.itemType ?? c.lineId?.slice(0, 8) ?? 'Ligne'}</span>
                    <span className="text-xs text-[#7a8f80]">{fmtDateTime(c.correctedAt ?? c.at)}</span>
                  </div>
                  <p className="text-xs text-[#7a8f80] mt-0.5">
                    {c.quantity !== undefined && `Qté → ${c.quantity} `}
                    {c.unitPrice !== undefined && `PU → ${fmtFCFA(c.unitPrice)}`}
                  </p>
                  {c.reason && <p className="text-xs text-[#f5a623] mt-0.5 italic">« {c.reason} »</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal correction */}
      <CorrectModal open={showCorrect} onClose={() => setShowCorrect(false)} lines={lines} invoiceId={String(id)} onDone={refetch} />

      {/* Modal finalisation */}
      <Modal open={showFinalize} onClose={() => setShowFinalize(false)} title="Finaliser la facture">
        <div className="space-y-3">
          <p className="text-sm text-[#7a8f80]">
            La finalisation verrouille définitivement la facture : plus aucune correction possible.
            Le total TTC de <b className="text-[#0f9d70]">{fmtFCFA(inv.totalTtc)}</b> sera déclaré.
          </p>
          <Textarea label="Notes (optionnel)" value={finalizeNotes} onChange={e => setFinalizeNotes(e.target.value)}
            placeholder="Commentaire de finalisation…" rows={3} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowFinalize(false)}>Annuler</Button>
            <Button onClick={() => finalizeMut.mutate(finalizeNotes)} disabled={finalizeMut.loading}>
              {finalizeMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Finaliser
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={showDelete} onClose={() => setShowDelete(false)} title="Supprimer la facture"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteMut.mutate(undefined as any)} />
    </div>
  );
}

/* ═════════════════ MODAL CORRECTION DE LIGNES ═════════════════ */
function CorrectModal({ open, onClose, lines, invoiceId, onDone }: {
  open: boolean; onClose: () => void; lines: any[]; invoiceId: string; onDone: () => void;
}) {
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<string, { quantity?: string; unitPrice?: string }>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [globalReason, setGlobalReason] = useState('');

  const correctMut = useMutation(
    (payload: any[]) => invoicesService.correct(invoiceId, payload),
    {
      onSuccess: () => {
        toast({ title: 'Corrections appliquées', variant: 'success' });
        setEdits({}); setReasons({}); setGlobalReason('');
        onClose(); onDone();
      },
      onError: (e: any) => toast({ title: 'Correction refusée', description: e.message, variant: 'error' }),
    },
  );

  const touched = lines.filter(l => edits[l.id] && ((edits[l.id].quantity ?? '') !== '' || (edits[l.id].unitPrice ?? '') !== ''));

  const submit = () => {
    const payload = touched.map(l => {
      const e = edits[l.id];
      const line: any = { lineId: l.id, correctionReason: reasons[l.id] || globalReason || 'Correction manuelle' };
      if (e.quantity !== undefined && e.quantity !== '') line.quantity = Number(e.quantity);
      if (e.unitPrice !== undefined && e.unitPrice !== '') line.unitPrice = Number(e.unitPrice);
      return line;
    });
    correctMut.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Corriger des lignes" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-[#7a8f80]">
          Modifiez les quantités ou prix unitaires — chaque correction est tracée avec son motif (jamais anonyme).
        </p>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {lines.map(l => {
            const e = edits[l.id] ?? {};
            return (
              <div key={l.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e8ede9]">{l.itemType}</span>
                  <span className="text-xs text-[#7a8f80]">actuel : {l.quantity} × {fmtFCFA(l.unitPrice)}</span>
                </div>
                <div className="grid grid-cols-[6rem_8rem_1fr] gap-2">
                  <Input type="number" min={0} placeholder={`Qté (${l.quantity})`} value={e.quantity ?? ''}
                    onChange={ev => setEdits(p => ({ ...p, [l.id]: { ...p[l.id], quantity: ev.target.value } }))} />
                  <Input type="number" min={0} step="0.01" placeholder={`PU (${Number(l.unitPrice)})`} value={e.unitPrice ?? ''}
                    onChange={ev => setEdits(p => ({ ...p, [l.id]: { ...p[l.id], unitPrice: ev.target.value } }))} />
                  <Input placeholder="Motif de cette ligne…" value={reasons[l.id] ?? ''}
                    onChange={ev => setReasons(p => ({ ...p, [l.id]: ev.target.value }))} />
                </div>
              </div>
            );
          })}
        </div>
        <Input label="Motif global (si non spécifié par ligne)" value={globalReason} onChange={e => setGlobalReason(e.target.value)}
          placeholder="Ex. erreur de saisie bordereau" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#7a8f80]">{touched.length} ligne(s) modifiée(s)</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}><X size={14} /> Annuler</Button>
            <Button onClick={submit} disabled={touched.length === 0 || correctMut.loading}>
              {correctMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Appliquer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}


/* ═════════════════ LIGNE SPÉCIALE (attachement ONCOMIT) ═════════════════ */
function ExtraLineModal({ open, invoiceId, onClose, onDone }: {
  open: boolean; invoiceId: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const { data } = useQuery(() => invoiceExtras.presets(), [], { immediate: open });
  const presets = (data?.presets ?? []) as Array<{ key: string; label: string; defaultQty: number; defaultPu: number; category: string }>;
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const mut = useMutation(
    () => invoiceExtras.addExtra(invoiceId, {
      label,
      quantity: Number(quantity) || 1,
      unitPrice: Number(unitPrice) || 0,
    }),
    {
      onSuccess: () => { toast({ title: 'Ligne spéciale ajoutée', variant: 'success' }); onDone(); onClose(); },
      onError: (e: any) => toast({ title: 'Ajout impossible', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title="Ligne spéciale — attachement ONCOMIT">
      <div className="space-y-3">
        <p className="text-xs text-[#7a8f80]">Presets du fichier réel : charge magasin, régule pénalités, TENUS, MACRON…</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p.key} type="button" onClick={() => { setLabel(p.label); setQuantity(String(p.defaultQty || 1)); setUnitPrice(String(p.defaultPu)); }}
              className="rounded-full border border-[#1e2e25] bg-[#111916] px-2.5 py-1 text-xs text-[#7a8f80] hover:text-[#e8ede9] hover:border-[#0f9d70]/40">
              {p.label} ({p.defaultPu.toLocaleString('fr-FR')} F)
            </button>
          ))}
        </div>
        <Input label="Libellé *" value={label} onChange={e => setLabel(e.target.value)} placeholder="CHARGE MAGASIN MBOUR" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantité *" type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} />
          <Input label="Prix unitaire (F) *" type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => mut.mutate()} disabled={mut.loading || !label.trim()}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Ajouter</Button>
        </div>
      </div>
    </Modal>
  );
}
