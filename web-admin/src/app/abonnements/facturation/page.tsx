'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, EmptyState, Input, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { saasService } from '@/services';
import { Receipt, Plus, Search, Loader2, Ban, CheckCircle, Package } from 'lucide-react';

function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

const STATUS_CLS: Record<string, string> = {
  paid: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
  pending: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30',
  overdue: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30',
  cancelled: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]',
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showGenerate, setShowGenerate] = useState(false);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(monthBounds);
  const [payForm, setPayForm] = useState({ paymentMethod: 'virement', reference: '' });

  const { data: items, loading, refetch } = useQuery(
    () => saasService.listInvoices(filter ? { status: filter } : undefined),
    [filter],
  );

  const generateMut = useMutation(
    () => saasService.generateInvoice(period.periodStart, period.periodEnd),
    {
      onSuccess: () => { toast({ title: 'Facture générée', variant: 'success' }); setShowGenerate(false); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const payMut = useMutation(
    () => saasService.payInvoice(payTarget.id, payForm.paymentMethod, payForm.reference || undefined),
    {
      onSuccess: () => { toast({ title: 'Paiement enregistré', variant: 'success' }); setPayTarget(null); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const cancelMut = useMutation(
    (id: string) => saasService.cancelInvoice(id),
    {
      onSuccess: () => { toast({ title: 'Facture annulée', variant: 'success' }); setCancelId(null); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const list = (Array.isArray(items) ? items : []).filter((item: any) => {
    if (!search) return true;
    return JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Receipt size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Facturation SaaS</h1>
            <p className="text-xs text-[#7a8f80]">Licences & options — {list.length} facture(s)</p>
          </div>
        </div>
        <Button onClick={() => { setPeriod(monthBounds()); setShowGenerate(true); }}>
          <Plus size={16} /> Générer une facture
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
          <option value="">Tous</option>
          <option value="pending">En attente</option>
          <option value="paid">Payée</option>
          <option value="overdue">En retard</option>
          <option value="cancelled">Annulée</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<Package size={40} className="text-[#7a8f80]/50" />} title="Aucune facture" description="Générez une facture pour la période sélectionnée" />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Début</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Fin</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Total TTC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((item: any) => {
                const canAct = item.status === 'pending' || item.status === 'overdue';
                return (
                  <tr key={item.id} className="hover:bg-[#172019] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#e8ede9]">{item.invoiceNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(item.periodStart)}</td>
                    <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(item.periodEnd)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#e8ede9]">{fmtFCFA(item.totalTtc)}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_CLS[item.status] ?? 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]'}>
                        {item.status ?? '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canAct && (
                          <>
                            <Button size="sm" variant="secondary" className="h-8 px-2 text-xs"
                              onClick={() => { setPayForm({ paymentMethod: 'virement', reference: '' }); setPayTarget(item); }}>
                              <CheckCircle size={13} /> Payer
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-[#7a8f80] hover:text-[#C0392B]"
                              onClick={() => setCancelId(item.id)}>
                              <Ban size={13} /> Annuler
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Générer une facture SaaS">
        <div className="space-y-3">
          <p className="text-xs text-[#7a8f80]">Période de facturation des licences et options actives.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Début *" type="date" value={period.periodStart} onChange={e => setPeriod({ ...period, periodStart: e.target.value })} required />
            <Input label="Fin *" type="date" value={period.periodEnd} onChange={e => setPeriod({ ...period, periodEnd: e.target.value })} required />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>Annuler</Button>
            <Button disabled={generateMut.loading || !period.periodStart || !period.periodEnd} onClick={() => generateMut.mutate()}>
              {generateMut.loading && <Loader2 size={14} className="animate-spin" />} Générer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={`Payer — ${payTarget?.invoiceNumber ?? ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-[#e8ede9]">Montant : <b className="text-[#0f9d70]">{fmtFCFA(payTarget?.totalTtc)}</b></p>
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Mode de paiement</p>
            <select value={payForm.paymentMethod} onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
              className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
          <Input label="Référence (optionnel)" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="N° virement / reçu…" />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setPayTarget(null)}>Fermer</Button>
            <Button disabled={payMut.loading} onClick={() => payMut.mutate()}>
              {payMut.loading && <Loader2 size={14} className="animate-spin" />} Confirmer le paiement
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} title="Annuler la facture"
        message="La facture passera au statut « cancelled ». Cette action ne la supprime pas."
        confirmText="Annuler la facture" danger
        onConfirm={() => cancelId && cancelMut.mutate(cancelId)} />
    </div>
  );
}
