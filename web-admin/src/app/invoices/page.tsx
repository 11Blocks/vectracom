'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { invoicesService } from '@/services';
import { Receipt, Loader2, Plus, ArrowRight, Wand2, CheckCircle2, Lock } from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  en_correction: { label: 'En correction', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  finalisee: { label: 'Finalisée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  envoyee: { label: 'Envoyée', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { periodStart: `${month}-01`, periodEnd: `${month}-${String(last).padStart(2, '0')}` };
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [showGenerate, setShowGenerate] = useState(false);

  const { data, loading, refetch } = useQuery(() => invoicesService.list(), []);
  const invoices = Array.isArray(data) ? data : [];

  const generateMut = useMutation(
    (p: { periodStart: string; periodEnd: string }) => invoicesService.generate(p.periodStart, p.periodEnd),
    {
      onSuccess: (inv: any) => {
        toast({ title: 'Facture générée', description: `${inv?.invoiceNumber ?? ''} — brouillon prêt à corriger`, variant: 'success' });
        setShowGenerate(false); refetch();
      },
      onError: (e: any) => toast({ title: 'Génération impossible', description: e.message, variant: 'error' }),
    },
  );

  const totals = invoices.reduce((acc: any, i: any) => ({
    ht: acc.ht + Number(i.totalHt ?? 0),
    ttc: acc.ttc + Number(i.totalTtc ?? 0),
    pen: acc.pen + Number(i.penaltiesTotal ?? 0),
  }), { ht: 0, ttc: 0, pen: 0 });
  const drafts = invoices.filter(i => i.status === 'brouillon').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Receipt size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Facturation client</h1>
            <p className="text-xs text-[#7a8f80]">ONECOMIT → SONATEL — missions clôturées valorisées au bordereau 3STB</p>
          </div>
        </div>
        <Button onClick={() => setShowGenerate(true)}><Plus size={15} /> Générer une facture</Button>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Factures</p><p className="text-xl font-bold text-[#e8ede9]">{invoices.length} {drafts > 0 && <span className="text-xs font-normal text-[#f5a623]">· {drafts} brouillon(s)</span>}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Total HT cumulé</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(totals.ht)}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#D9822B] mb-1">Pénalités cumulées</p><p className="text-xl font-bold text-[#D9822B]">-{fmtFCFA(totals.pen)}</p></Card>
        <Card className="p-4 border-[#0f9d70]/30"><p className="text-xs text-[#0f9d70] mb-1">Total TTC cumulé</p><p className="text-xl font-bold text-[#0f9d70]">{fmtFCFA(totals.ttc)}</p></Card>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : invoices.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Receipt size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-1">Aucune facture générée</p>
          <p className="text-xs text-[#7a8f80]/70 mb-4">La génération agrège les missions clôturées du mois, regroupées par type, valorisées au bordereau, pénalités KPI déduites.</p>
          <Button onClick={() => setShowGenerate(true)}><Plus size={15} /> Générer la première facture</Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">N° facture</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Période</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Total HT</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Pénalités</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Total TTC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Finalisée le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {invoices.map((inv: any) => {
                const meta = STATUS_META[inv.status] ?? { label: inv.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
                return (
                  <tr key={inv.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => router.push('/invoices/' + inv.id)}>
                    <td className="px-4 py-3 font-mono text-sm text-[#0f9d70]">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(inv.periodStart)} → {fmtDate(inv.periodEnd)}</td>
                    <td className="px-4 py-3">
                      <Badge className={meta.cls}>{meta.label === 'finalisee' ? <Lock size={10} className="mr-1" /> : null}{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#e8ede9]">{fmtFCFA(inv.totalHt)}</td>
                    <td className="px-4 py-3 text-right text-[#D9822B]">{Number(inv.penaltiesTotal) > 0 ? '-' + fmtFCFA(inv.penaltiesTotal) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0f9d70]">{fmtFCFA(inv.totalTtc)}</td>
                    <td className="px-4 py-3 text-[#7a8f80]">{fmtDate(inv.finalizedAt)}</td>
                    <td className="px-4 py-3 text-right text-[#7a8f80]"><ArrowRight size={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal génération */}
      <GenerateModal open={showGenerate} onClose={() => setShowGenerate(false)} loading={generateMut.loading} existing={invoices} onSubmit={p => generateMut.mutate(p)} />
    </div>
  );
}

function GenerateModal({ open, onClose, loading, existing, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean; existing: any[];
  onSubmit: (p: { periodStart: string; periodEnd: string }) => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { periodStart, periodEnd } = monthRange(month);
  const alreadyExists = existing.some(i => i.periodStart === periodStart && i.periodEnd === periodEnd);

  return (
    <Modal open={open} onClose={onClose} title="Générer une facture">
      <div className="space-y-3">
        <p className="text-sm text-[#7a8f80]">
          La génération agrège les <b className="text-[#e8ede9]">missions clôturées</b> de la période, les regroupe par type
          (Survey, Installation, SAV, TS, INFRA…), applique les prix du bordereau 3STB et déduit les <b className="text-[#D9822B]">pénalités KPI</b> du mois.
          La facture est créée en <b className="text-[#e8ede9]">brouillon</b> — corrigeable ligne par ligne avant finalisation.
        </p>
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Mois de facturation</p>
          <input
            type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="h-9 w-full px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
          <p className="text-xs text-[#7a8f80] mt-1.5">Période : {fmtDate(periodStart)} → {fmtDate(periodEnd)}</p>
        </div>
        {alreadyExists && (
          <p className="text-xs text-[#f5a623] flex items-center gap-1.5 rounded-lg border border-[#f5a623]/30 bg-[#f5a623]/[0.06] px-3 py-2">
            <Wand2 size={13} /> Une facture existe déjà pour cette période exacte — le backend refusera le doublon.
          </p>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={loading || alreadyExists} onClick={() => onSubmit({ periodStart, periodEnd })}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Générer le brouillon
          </Button>
        </div>
      </div>
    </Modal>
  );
}
