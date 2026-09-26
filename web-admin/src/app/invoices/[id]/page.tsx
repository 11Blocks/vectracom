'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, Textarea, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useSessionUser } from '@/components/admin/TenantPicker';
import { invoicesService, invoiceExtras, clientsService } from '@/services';
import {
  INVOICE_CATEGORIES, INVOICE_KIND_LABELS, PAYMENT_METHODS, fmtDay, fmtFCFA, invoiceStatusMeta, todayIso,
} from '@/lib/invoice-meta';
import { DraftLine, LinesEditor, emptyLine, linesValid, toLinePayload } from '@/components/invoices/LinesEditor';
import {
  ArrowLeft, Loader2, FileDown, FileSpreadsheet, CheckCircle2, Lock, AlertTriangle, Receipt, History, Trash2,
  Save, X, Plus, Pencil, Send, Wallet, Ban, ClipboardList, Building2, User,
} from 'lucide-react';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { id } = useParams();
  const invoiceId = String(id);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useSessionUser();
  const isAdmin = !!user && ['admin', 'super_admin'].includes(user.role);
  const canEdit = isAdmin;

  const [modal, setModal] = useState<'' | 'header' | 'lines' | 'finalize' | 'payment' | 'cancel' | 'delete' | 'missions'>('');
  const [editLine, setEditLine] = useState<any | null>(null);
  const [removeLineId, setRemoveLineId] = useState<string | null>(null);
  const [finalizeNotes, setFinalizeNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const { data, loading, refetch } = useQuery(() => invoicesService.preview(invoiceId), [invoiceId]);
  const close = () => setModal('');
  const onError = (title: string) => (e: any) => toast({ title, description: e.message, variant: 'error' });

  const finalizeMut = useMutation((notes: string) => invoicesService.finalize(invoiceId, notes || undefined), {
    onSuccess: (inv: any) => { toast({ title: 'Facture émise', description: inv?.invoiceNumber, variant: 'success' }); close(); refetch(); },
    onError: onError('Émission impossible'),
  });
  const sendMut = useMutation(() => invoicesService.send(invoiceId), {
    onSuccess: () => { toast({ title: 'Facture marquée envoyée', variant: 'success' }); refetch(); },
    onError: onError('Erreur'),
  });
  const cancelMut = useMutation((reason: string) => invoicesService.cancel(invoiceId, reason), {
    onSuccess: (d: any) => { toast({ title: 'Avoir émis', description: d?.invoice?.invoiceNumber, variant: 'success' }); close(); refetch(); },
    onError: onError('Annulation impossible'),
  });
  const deleteMut = useMutation(() => invoicesService.delete(invoiceId), {
    onSuccess: () => { toast({ title: 'Brouillon supprimé', variant: 'success' }); router.push('/invoices'); },
    onError: onError('Suppression impossible'),
  });
  const removeLineMut = useMutation((lineId: string) => invoiceExtras.removeLine(invoiceId, lineId), {
    onSuccess: () => { toast({ title: 'Ligne supprimée', variant: 'success' }); setRemoveLineId(null); refetch(); },
    onError: onError('Suppression impossible'),
  });
  const removePaymentMut = useMutation((paymentId: string) => invoicesService.removePayment(invoiceId, paymentId), {
    onSuccess: () => { toast({ title: 'Encaissement supprimé', variant: 'success' }); refetch(); },
    onError: onError('Erreur'),
  });

  const doExport = async (kind: 'pdf' | 'excel' | 'attachement') => {
    try {
      const blob = kind === 'pdf' ? await invoicesService.exportPdf(invoiceId)
        : kind === 'excel' ? await invoicesService.exportExcel(invoiceId)
          : await invoiceExtras.exportAttachement(invoiceId);
      const number = data?.invoice?.invoiceNumber ?? invoiceId;
      downloadBlob(blob, kind === 'pdf' ? `${number}.pdf` : kind === 'excel' ? `${number}.xlsx` : `${number}-attachement.xlsx`);
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    }
  };

  if (loading && !data) return <Skeleton className="h-64" />;
  if (!data?.invoice) return <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center"><p className="text-sm text-[#7a8f80]">Facture introuvable</p></Card>;

  const inv = data.invoice;
  const t = data.totals;
  const lines: any[] = data.lines ?? [];
  const penalties: any[] = data.penalties ?? [];
  const payments: any[] = data.payments ?? [];
  const corrections: any[] = inv.corrections ?? [];
  const meta = invoiceStatusMeta(inv.status);
  const editable = !!data.editable;
  const payable = ['finalisee', 'envoyee', 'partiellement_payee'].includes(inv.status) && inv.kind !== 'avoir';
  const issued = !editable && inv.status !== 'annulee' && inv.kind !== 'avoir';

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => router.push('/invoices')} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-2">
            <ArrowLeft size={15} /> Retour aux factures
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><Receipt size={20} className="text-[#0f9d70]" /> {inv.invoiceNumber}</h1>
            <Badge className={meta.cls}>{meta.label}</Badge>
            <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{INVOICE_KIND_LABELS[inv.kind] ?? inv.kind}</Badge>
            {data.overdue && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30">En retard</Badge>}
          </div>
          <p className="text-sm text-[#7a8f80] mt-1">
            {inv.title ? `${inv.title} · ` : ''}Période {fmtDay(inv.periodStart)} → {fmtDay(inv.periodEnd)}
            {inv.missionCount ? ` · ${inv.missionCount} mission(s)` : ''}
          </p>
          {editable && <p className="text-xs text-[#f5a623] mt-1">Brouillon : numéro définitif attribué à l’émission.</p>}
          {editable && lines.some(l => Number(l.unitPrice) === 0 && Number(l.quantity) > 0) && (
            <p className="text-xs text-[#C0392B] mt-1">
              Des lignes sont à 0 FCFA (prix absent du <Link className="underline" href="/invoices/bordereau">bordereau</Link>) : corrigez-les avant d’émettre.
            </p>
          )}
          {inv.status === 'annulee' && (
            <p className="text-xs text-[#C0392B] mt-1">
              Annulée le {fmtDateTime(inv.cancelledAt)} — {inv.cancelReason}
              {data.creditNote && <> · avoir <Link className="underline" href={'/invoices/' + data.creditNote.id}>{data.creditNote.invoiceNumber}</Link></>}
            </p>
          )}
          {inv.kind === 'avoir' && inv.creditedInvoiceId && (
            <p className="text-xs text-[#7a8f80] mt-1">Avoir sur <Link className="underline text-[#0f9d70]" href={'/invoices/' + inv.creditedInvoiceId}>la facture d’origine</Link></p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => doExport('pdf')}><FileDown size={14} /> PDF</Button>
          <Button variant="secondary" size="sm" onClick={() => doExport('excel')}><FileSpreadsheet size={14} /> Excel</Button>
          {inv.kind === 'periodique' && <Button variant="secondary" size="sm" onClick={() => doExport('attachement')}><FileSpreadsheet size={14} /> Attachement</Button>}
          {canEdit && editable && (
            <>
              <Button variant="outline" size="sm" onClick={() => setModal('header')}><Pencil size={14} /> Entête</Button>
              <Button variant="outline" size="sm" onClick={() => setModal('lines')}><Plus size={14} /> Lignes</Button>
              <Button size="sm" onClick={() => setModal('finalize')}><CheckCircle2 size={14} /> Émettre</Button>
            </>
          )}
          {canEdit && inv.status === 'finalisee' && inv.kind !== 'avoir' && (
            <Button variant="outline" size="sm" onClick={() => sendMut.mutate()} disabled={sendMut.loading}><Send size={14} /> Marquer envoyée</Button>
          )}
          {isAdmin && payable && <Button size="sm" onClick={() => setModal('payment')}><Wallet size={14} /> Encaisser</Button>}
          {isAdmin && issued && Number(inv.amountPaid) === 0 && (
            <Button variant="ghost" size="sm" className="text-[#C0392B]" onClick={() => setModal('cancel')}><Ban size={14} /> Annuler (avoir)</Button>
          )}
          {isAdmin && editable && (
            <Button variant="ghost" size="sm" className="text-[#C0392B]" onClick={() => setModal('delete')} title="Supprimer le brouillon"><Trash2 size={14} /></Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-[#7a8f80] flex items-center gap-1.5"><Building2 size={12} /> Émetteur</p>
          <p className="text-sm font-semibold text-[#e8ede9]">{data.company?.name ?? '—'}</p>
          <p className="text-xs text-[#7a8f80]">{[data.company?.address, data.company?.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</p>
          <p className="text-xs text-[#7a8f80]">{[data.company?.ninea && `NINEA ${data.company.ninea}`, data.company?.rccm && `RCCM ${data.company.rccm}`].filter(Boolean).join(' · ') || 'NINEA / RCCM non renseignés'}</p>
          {data.company?.bankAccount && <p className="text-xs text-[#7a8f80]">{data.company.bankName} {data.company.bankAccount}</p>}
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-[#7a8f80] flex items-center gap-1.5"><User size={12} /> Client</p>
          <p className="text-sm font-semibold text-[#e8ede9]">{data.client?.name ?? 'Non défini'}</p>
          <p className="text-xs text-[#7a8f80]">{[data.client?.address, data.client?.city].filter(Boolean).join(', ') || '—'}</p>
          <p className="text-xs text-[#7a8f80]">{data.client?.ninea ? `NINEA ${data.client.ninea}` : ''}</p>
        </Card>
        <Card className="p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[#7a8f80]">Date</span><span className="text-[#e8ede9]">{fmtDay(inv.issueDate)}</span></div>
          <div className="flex justify-between"><span className="text-[#7a8f80]">Échéance</span><span className={data.overdue ? 'text-[#C0392B]' : 'text-[#e8ede9]'}>{fmtDay(inv.dueDate)}</span></div>
          <div className="flex justify-between"><span className="text-[#7a8f80]">Envoyée</span><span className="text-[#e8ede9]">{fmtDateTime(inv.sentAt)}</span></div>
          <div className="flex justify-between"><span className="text-[#7a8f80]">Taux TVA</span><span className="text-[#e8ede9]">{Math.round(t.tvaRate * 10000) / 100} %</span></div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Total HT</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(t.totalHt)}</p>
          {t.discount !== 0 && <p className="text-xs text-[#7a8f80]">lignes {fmtFCFA(t.linesTotal)} · remise −{fmtFCFA(t.discount)}</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">TVA</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(t.totalTva)}</p>
          {t.penaltiesTotal !== 0 && <p className="text-xs text-[#D9822B]">pénalités KPI −{fmtFCFA(t.penaltiesTotal)}</p>}
        </Card>
        <Card className="p-4 border-[#0f9d70]/30"><p className="text-xs text-[#0f9d70] mb-1">Net à payer</p><p className={'text-xl font-bold ' + (t.totalTtc < 0 ? 'text-[#C0392B]' : 'text-[#0f9d70]')}>{fmtFCFA(t.totalTtc)}</p></Card>
        <Card className="p-4">
          <p className="text-xs text-[#D9822B] mb-1">Reste dû</p><p className="text-xl font-bold text-[#D9822B]">{fmtFCFA(t.remaining)}</p>
          {t.amountPaid > 0 && <p className="text-xs text-[#0f9d70]">encaissé {fmtFCFA(t.amountPaid)}</p>}
        </Card>
      </div>

      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2e25] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#e8ede9]">Lignes ({lines.length})</h3>
          <div className="flex items-center gap-3">
            {inv.kind === 'periodique' && inv.missionCount > 0 && (
              <button className="text-xs text-[#0f9d70] hover:underline flex items-center gap-1" onClick={() => setModal('missions')}><ClipboardList size={12} /> Missions facturées</button>
            )}
            {!editable && <span className="text-xs text-[#7a8f80] flex items-center gap-1"><Lock size={11} /> Lecture seule</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Désignation</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Catégorie</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Qté</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">PU</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Total</th>
                {canEdit && editable && <th className="px-2 py-2.5 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50">
              {lines.map((l: any) => (
                <tr key={l.id} className="hover:bg-[#172019] transition-colors">
                  <td className="px-4 py-2.5 text-[#e8ede9]">
                    {l.itemType}
                    {l.isCorrected && <span className="ml-2 text-[10px] text-[#f5a623]" title={l.correctionReason ?? ''}>corrigée</span>}
                    {Number(l.unitPrice) === 0 && Number(l.quantity) > 0 && inv.kind !== 'avoir' && (
                      <span className="ml-2 text-[10px] text-[#C0392B]" title="Aucun prix trouvé au bordereau : corrigez le PU ou complétez le bordereau">prix manquant</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{l.category}</Badge></td>
                  <td className="px-4 py-2.5 text-right text-[#7a8f80]">{Number(l.quantity).toLocaleString('fr-FR')}{l.unit ? ` ${l.unit}` : ''}</td>
                  <td className="px-4 py-2.5 text-right text-[#7a8f80]">{fmtFCFA(l.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right text-[#e8ede9] font-semibold">{fmtFCFA(l.total)}</td>
                  {canEdit && editable && (
                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                      <button className="p-1 text-[#7a8f80] hover:text-[#0f9d70]" title="Modifier" onClick={() => setEditLine(l)}><Pencil size={13} /></button>
                      <button className="p-1 text-[#7a8f80] hover:text-[#C0392B]" title="Supprimer" onClick={() => setRemoveLineId(l.id)}><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#7a8f80]">Aucune ligne</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><Wallet size={15} className="text-[#0f9d70]" /> Encaissements ({payments.length})</h3>
          {payments.length === 0 ? <p className="text-xs text-[#7a8f80]">{payable ? 'Aucun encaissement enregistré.' : 'Encaissement possible après émission.'}</p> : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#0f9d70]">{fmtFCFA(p.amount)}</p>
                    <p className="text-xs text-[#7a8f80]">{fmtDay(p.paidAt)} · {PAYMENT_METHODS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</p>
                  </div>
                  {isAdmin && inv.status !== 'annulee' && (
                    <button className="text-[#7a8f80] hover:text-[#C0392B]" title="Supprimer l'encaissement" disabled={removePaymentMut.loading}
                      onClick={() => { if (confirm('Supprimer cet encaissement ?')) removePaymentMut.mutate(p.id); }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#D9822B] mb-3 flex items-center gap-2"><AlertTriangle size={15} /> Pénalités KPI ({penalties.length})</h3>
          {penalties.length === 0 ? <p className="text-xs text-[#7a8f80]">Aucune pénalité appliquée (menu KPI SONATEL → pénalités, tant que la facture est en brouillon).</p> : (
            <div className="space-y-2">
              {penalties.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-[#D9822B]/30 bg-[#D9822B]/[0.06] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#e8ede9]">{p.kpiName}</span>
                    <span className="text-sm font-bold text-[#D9822B]">−{fmtFCFA(p.penaltyAmount)}</span>
                  </div>
                  <p className="text-xs text-[#7a8f80]">Cible {Number(p.target)} · Réalisé {Number(p.actual)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="border-[#1e2e25] bg-[#111916] p-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><History size={15} className="text-[#7a8f80]" /> Historique ({corrections.length})</h3>
          {corrections.length === 0 ? <p className="text-xs text-[#7a8f80]">Aucune modification depuis la génération.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...corrections].reverse().map((c: any, i: number) => (
                <div key={i} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                  <p className="text-xs text-[#7a8f80]">{fmtDateTime(c.at)}</p>
                  {(c.changes ?? []).map((ch: any, j: number) => (
                    <p key={j} className="text-xs text-[#e8ede9] mt-0.5">
                      <b>{ch.itemType}</b> : {String(ch.from ?? '—')} → {String(ch.to ?? '—')}
                      {ch.reason && <span className="text-[#f5a623] italic"> « {ch.reason} »</span>}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {inv.notes && <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Notes</p><p className="text-sm text-[#e8ede9] whitespace-pre-line">{inv.notes}</p></Card>}

      {modal === 'header' && <HeaderModal open onClose={close} data={data} invoiceId={invoiceId} onDone={() => { close(); refetch(); }} />}
      <AddLinesModal open={modal === 'lines'} onClose={close} invoiceId={invoiceId} onDone={() => { close(); refetch(); }} />
      <EditLineModal line={editLine} invoiceId={invoiceId} onClose={() => setEditLine(null)} onDone={() => { setEditLine(null); refetch(); }} />
      <PaymentModal open={modal === 'payment'} onClose={close} invoiceId={invoiceId} remaining={t.remaining} onDone={() => { close(); refetch(); }} />
      <MissionsModal open={modal === 'missions'} onClose={close} invoiceId={invoiceId} />

      <Modal open={modal === 'finalize'} onClose={close} title="Émettre la facture">
        <div className="space-y-3">
          <p className="text-sm text-[#7a8f80]">
            L’émission attribue le <b className="text-[#e8ede9]">numéro définitif</b> (numérotation continue), fige les coordonnées du client
            et verrouille la facture. Net à payer : <b className="text-[#0f9d70]">{fmtFCFA(t.totalTtc)}</b>.
            Une erreur après émission se corrige par un avoir.
          </p>
          <Textarea label="Notes (optionnel)" value={finalizeNotes} onChange={e => setFinalizeNotes(e.target.value)} rows={3} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={close}>Annuler</Button>
            <Button onClick={() => finalizeMut.mutate(finalizeNotes)} disabled={finalizeMut.loading}>
              {finalizeMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Émettre
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'cancel'} onClose={close} title="Annuler par avoir">
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); cancelMut.mutate(cancelReason.trim()); }}>
          <p className="text-sm text-[#7a8f80]">
            Un <b className="text-[#e8ede9]">avoir total</b> (montants négatifs) est émis avec son propre numéro. La facture passe « annulée »
            et ses missions redeviennent facturables.
          </p>
          <Textarea label="Motif *" rows={3} required minLength={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={close}>Retour</Button>
            <Button type="submit" variant="danger" disabled={cancelMut.loading || cancelReason.trim().length < 3}>
              {cancelMut.loading && <Loader2 size={14} className="animate-spin" />} Émettre l’avoir
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={modal === 'delete'} onClose={close} title="Supprimer le brouillon"
        message="Le brouillon est supprimé et ses missions redeviennent facturables." confirmText="Supprimer" danger
        onConfirm={() => deleteMut.mutate()} />
      <ConfirmDialog open={!!removeLineId} onClose={() => setRemoveLineId(null)} title="Supprimer la ligne"
        message="La suppression est tracée dans l’historique de la facture." confirmText="Supprimer" danger
        onConfirm={() => removeLineId && removeLineMut.mutate(removeLineId)} />
    </div>
  );
}

function HeaderModal({ open, onClose, data, invoiceId, onDone }: {
  open: boolean; onClose: () => void; data: any; invoiceId: string; onDone: () => void;
}) {
  const { toast } = useToast();
  const inv = data?.invoice ?? {};
  const { data: clientsData } = useQuery(() => clientsService.list(), [], { immediate: open });
  const clients: any[] = Array.isArray(clientsData) ? clientsData : [];
  const [f, setF] = useState<Record<string, string>>(() => ({
    clientId: inv.clientId ?? '',
    title: inv.title ?? '',
    issueDate: inv.issueDate ?? '',
    dueDate: inv.dueDate ?? '',
    periodStart: inv.periodStart ?? '',
    periodEnd: inv.periodEnd ?? '',
    discountAmount: String(Number(inv.discountAmount ?? 0)),
    tvaPct: inv.tvaRate != null ? String(Math.round(Number(inv.tvaRate) * 10000) / 100) : '',
    notes: inv.notes ?? '',
  }));
  const mut = useMutation(() => invoicesService.updateHeader(invoiceId, {
    clientId: f.clientId || null,
    title: f.title || null,
    issueDate: f.issueDate || null,
    dueDate: f.dueDate || null,
    periodStart: f.periodStart || undefined,
    periodEnd: f.periodEnd || undefined,
    discountAmount: Number(f.discountAmount) || 0,
    tvaRate: f.tvaPct === '' ? null : Number(f.tvaPct) / 100,
    notes: f.notes || null,
  }), {
    onSuccess: () => { toast({ title: 'Entête mise à jour', variant: 'success' }); onDone(); },
    onError: (e: any) => toast({ title: 'Modification refusée', description: e.message, variant: 'error' }),
  });
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Entête de la facture" size="lg">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Client" value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })}>
            <option value="">— Aucun (SONATEL par défaut pour les factures missions) —</option>
            {clients.filter(c => c.active || c.id === f.clientId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Objet" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <Input label="Date de facture (sinon jour d’émission)" type="date" value={f.issueDate} onChange={e => setF({ ...f, issueDate: e.target.value })} />
          <Input label="Échéance (sinon délai client)" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
          <Input label="Début de période" type="date" value={f.periodStart} onChange={e => setF({ ...f, periodStart: e.target.value })} />
          <Input label="Fin de période" type="date" value={f.periodEnd} onChange={e => setF({ ...f, periodEnd: e.target.value })} />
          <Input label="Remise HT (FCFA)" type="number" min="0" value={f.discountAmount} onChange={e => setF({ ...f, discountAmount: e.target.value })} />
          <Input label="Taux TVA (%) — vide : Paramètres" type="number" min="0" max="100" step="0.01" value={f.tvaPct} onChange={e => setF({ ...f, tvaPct: e.target.value })} />
        </div>
        <Textarea label="Notes" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddLinesModal({ open, onClose, invoiceId, onDone }: { open: boolean; onClose: () => void; invoiceId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const { data } = useQuery(() => invoiceExtras.presets(), [], { immediate: open });
  const presets = (data?.presets ?? []) as Array<{ key: string; label: string; defaultQty: number; defaultPu: number; category: string }>;
  const mut = useMutation(async () => {
    for (const l of lines) {
      const p = toLinePayload(l);
      await invoiceExtras.addExtra(invoiceId, { label: p.itemType, quantity: p.quantity, unitPrice: p.unitPrice, category: p.category, unit: (p as any).unit });
    }
  }, {
    onSuccess: () => { toast({ title: `${lines.length} ligne(s) ajoutée(s)`, variant: 'success' }); setLines([emptyLine()]); onDone(); },
    onError: (e: any) => toast({ title: 'Ajout impossible', description: e.message, variant: 'error' }),
  });
  const applyPreset = (p: typeof presets[number]) => {
    const line: DraftLine = { itemType: p.label, category: p.category, quantity: String(p.defaultQty || 1), unitPrice: String(p.defaultPu), unit: '' };
    const last = lines[lines.length - 1];
    setLines(last && !last.itemType.trim() ? [...lines.slice(0, -1), line] : [...lines, line]);
  };
  return (
    <Modal open={open} onClose={onClose} title="Ajouter des lignes" size="xl">
      <div className="space-y-3">
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-[#7a8f80] mr-1 self-center">Lignes types :</span>
            {presets.map(p => (
              <button key={p.key} type="button" onClick={() => applyPreset(p)}
                className="rounded-full border border-[#1e2e25] bg-[#111916] px-2.5 py-1 text-xs text-[#7a8f80] hover:text-[#e8ede9] hover:border-[#0f9d70]/40">
                {p.label} ({p.defaultPu.toLocaleString('fr-FR')} F)
              </button>
            ))}
          </div>
        )}
        <LinesEditor lines={lines} setLines={setLines} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}><X size={14} /> Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.loading || !linesValid(lines)}>
            {mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditLineModal({ line, invoiceId, onClose, onDone }: { line: any | null; invoiceId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const [key, setKey] = useState<string | null>(null);
  if (line && key !== line.id) {
    setKey(line.id);
    setF({ label: line.itemType, category: line.category, quantity: String(Number(line.quantity)), unitPrice: String(Number(line.unitPrice)), reason: '' });
  }
  const mut = useMutation(() => {
    const payload: any = { lineId: line.id, correctionReason: f.reason.trim() };
    if (f.label.trim() !== line.itemType) payload.label = f.label.trim();
    if (f.category !== line.category) payload.category = f.category;
    if (Number(f.quantity) !== Number(line.quantity)) payload.quantity = Number(f.quantity);
    if (Number(f.unitPrice) !== Number(line.unitPrice)) payload.unitPrice = Number(f.unitPrice);
    return invoicesService.correct(invoiceId, [payload]);
  }, {
    onSuccess: () => { toast({ title: 'Ligne corrigée', variant: 'success' }); setKey(null); onDone(); },
    onError: (e: any) => toast({ title: 'Correction refusée', description: e.message, variant: 'error' }),
  });
  if (!line) return null;
  const total = Math.round((Number(f.quantity) || 0) * (Number(f.unitPrice) || 0));
  return (
    <Modal open={!!line} onClose={() => { setKey(null); onClose(); }} title="Modifier la ligne">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <Input label="Désignation" value={f.label ?? ''} onChange={e => setF({ ...f, label: e.target.value })} required minLength={2} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Catégorie" value={f.category ?? ''} onChange={e => setF({ ...f, category: e.target.value })}>
            {INVOICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Quantité" type="number" min="0" step="0.001" value={f.quantity ?? ''} onChange={e => setF({ ...f, quantity: e.target.value })} required />
          <Input label="PU (FCFA)" type="number" min="0" step="1" value={f.unitPrice ?? ''} onChange={e => setF({ ...f, unitPrice: e.target.value })} required />
        </div>
        <p className="text-xs text-[#7a8f80]">Nouveau total : <b className="text-[#e8ede9]">{fmtFCFA(total)}</b> (avant : {fmtFCFA(line.total)})</p>
        <Input label="Motif de la correction *" value={f.reason ?? ''} onChange={e => setF({ ...f, reason: e.target.value })} required minLength={3} placeholder="Erreur de quantité, prix négocié…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => { setKey(null); onClose(); }}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || (f.reason ?? '').trim().length < 3}>
            {mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, invoiceId, remaining, onDone }: {
  open: boolean; onClose: () => void; invoiceId: string; remaining: number; onDone: () => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState({ amount: '', paidAt: todayIso(), method: 'virement', reference: '', note: '' });
  const mut = useMutation(() => invoicesService.addPayment(invoiceId, {
    amount: Number(f.amount), paidAt: f.paidAt, method: f.method,
    ...(f.reference.trim() ? { reference: f.reference.trim() } : {}),
    ...(f.note.trim() ? { note: f.note.trim() } : {}),
  }), {
    onSuccess: () => { toast({ title: 'Encaissement enregistré', variant: 'success' }); setF({ ...f, amount: '', reference: '', note: '' }); onDone(); },
    onError: (e: any) => toast({ title: 'Encaissement refusé', description: e.message, variant: 'error' }),
  });
  return (
    <Modal open={open} onClose={onClose} title="Enregistrer un encaissement">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <p className="text-xs text-[#7a8f80]">Reste à encaisser : <b className="text-[#D9822B]">{fmtFCFA(remaining)}</b></p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Input label="Montant (FCFA) *" type="number" min="1" max={remaining || undefined} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} required />
            <button type="button" className="text-[11px] text-[#0f9d70] hover:underline" onClick={() => setF({ ...f, amount: String(remaining) })}>Solder ({fmtFCFA(remaining)})</button>
          </div>
          <Input label="Date *" type="date" value={f.paidAt} onChange={e => setF({ ...f, paidAt: e.target.value })} required />
          <Select label="Mode" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Référence" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="N° virement / chèque" />
        </div>
        <Input label="Note" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !(Number(f.amount) > 0)}>
            {mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MissionsModal({ open, onClose, invoiceId }: { open: boolean; onClose: () => void; invoiceId: string }) {
  const { data, loading } = useQuery(() => invoicesService.missions(invoiceId), [invoiceId], { immediate: open });
  const missions: any[] = Array.isArray(data) ? data : [];
  return (
    <Modal open={open} onClose={onClose} title={`Missions facturées (${missions.length})`} size="lg">
      {loading ? <Skeleton className="h-40" /> : (
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#1e2e25] rounded-lg border border-[#1e2e25]">
          {missions.map(m => (
            <Link key={m.id} href={'/missions/' + m.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#172019]">
              <span className="text-sm text-[#e8ede9] truncate">{m.clientSite}</span>
              <span className="text-xs text-[#7a8f80] whitespace-nowrap">{m.typeTache} · {fmtDay(m.dateMission)}{m.sonatelDossierNumber ? ` · #${m.sonatelDossierNumber}` : ''}</span>
            </Link>
          ))}
          {missions.length === 0 && <p className="p-4 text-sm text-[#7a8f80]">Aucune mission rattachée.</p>}
        </div>
      )}
    </Modal>
  );
}
