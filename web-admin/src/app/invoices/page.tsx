'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, Textarea, useToast, Pager, usePagination } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useSessionUser } from '@/components/admin/TenantPicker';
import { invoicesService, clientsService } from '@/services';
import { INVOICE_KIND_LABELS, INVOICE_STATUS_META, fmtDay, fmtFCFA, invoiceStatusMeta, todayIso } from '@/lib/invoice-meta';
import { DraftLine, LinesEditor, emptyLine, linesValid, toLinePayload } from '@/components/invoices/LinesEditor';
import { Receipt, Loader2, Plus, ArrowRight, Wand2, CheckCircle2, FilePlus2, Users, Pencil, AlertTriangle, FileSpreadsheet } from 'lucide-react';

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
  const { user } = useSessionUser();
  const isAdmin = !!user && ['admin', 'super_admin'].includes(user.role);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  const pager = usePagination(50, `${statusFilter}|${clientFilter}`);
  const { data, loading, refetch: refetchPage } = useQuery(
    () => invoicesService.page({
      status: statusFilter && statusFilter !== 'en_retard' ? statusFilter : undefined,
      overdue: statusFilter === 'en_retard' ? 'true' : undefined,
      clientId: clientFilter || undefined,
      ...pager.params,
    }),
    [statusFilter, clientFilter, pager.offset, pager.limit],
  );
  const { data: summary, refetch: refetchSummary } = useQuery(() => invoicesService.summary(clientFilter || undefined), [clientFilter]);
  const refetch = () => { refetchPage(); refetchSummary(); };
  const filtered: any[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const { data: clientsData, refetch: refetchClients } = useQuery(() => clientsService.list(), []);
  const clients: any[] = Array.isArray(clientsData) ? clientsData : [];

  const generateMut = useMutation(
    (p: { periodStart: string; periodEnd: string; clientId?: string }) => invoicesService.generate(p.periodStart, p.periodEnd, p.clientId),
    {
      onSuccess: (inv: any) => {
        toast({ title: 'Facture générée', description: `${inv?.missionCount ?? 0} mission(s) — brouillon prêt à corriger`, variant: 'success' });
        setShowGenerate(false);
        refetch();
        if (inv?.id) router.push('/invoices/' + inv.id);
      },
      onError: (e: any) => toast({ title: 'Génération impossible', description: e.message, variant: 'error' }),
    },
  );

  const stats = {
    issuedTtc: summary?.issuedTtc ?? 0,
    paid: summary?.paid ?? 0,
    remaining: summary?.remaining ?? 0,
    overdue: summary?.overdue ?? 0,
    drafts: summary?.drafts ?? 0,
  };

  const countBy = (k: string) => (k === 'en_retard' ? stats.overdue : summary?.byStatus?.[k] ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Receipt size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Facturation client</h1>
            <p className="text-xs text-[#7a8f80]">Factures issues des missions validées, factures manuelles, encaissements et avoirs</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push('/invoices/bordereau')}><FileSpreadsheet size={15} /> Bordereau de prix</Button>
          <Button variant="secondary" onClick={() => setShowClients(true)}><Users size={15} /> Clients ({clients.length})</Button>
          {isAdmin && <Button variant="outline" onClick={() => setShowManual(true)}><FilePlus2 size={15} /> Facture manuelle</Button>}
          {isAdmin && <Button onClick={() => setShowGenerate(true)}><Plus size={15} /> Générer depuis les missions</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4"><p className="text-xs text-[#7a8f80] mb-1">Facturé (émis, TTC)</p><p className="text-xl font-bold text-[#e8ede9]">{fmtFCFA(stats.issuedTtc)}</p>
          {stats.drafts > 0 && <p className="text-xs text-[#f5a623] mt-0.5">{stats.drafts} brouillon(s) en cours</p>}</Card>
        <Card className="p-4"><p className="text-xs text-[#0f9d70] mb-1">Encaissé</p><p className="text-xl font-bold text-[#0f9d70]">{fmtFCFA(stats.paid)}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#D9822B] mb-1">Reste à encaisser</p><p className="text-xl font-bold text-[#D9822B]">{fmtFCFA(stats.remaining)}</p></Card>
        <Card className={'p-4 ' + (stats.overdue ? 'border-[#C0392B]/40' : '')}><p className="text-xs text-[#C0392B] mb-1 flex items-center gap-1"><AlertTriangle size={12} /> En retard</p><p className="text-xl font-bold text-[#C0392B]">{stats.overdue}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {['', ...Object.keys(INVOICE_STATUS_META), 'en_retard'].map(k => {
          const count = k ? countBy(k) : summary?.total ?? 0;
          if (k && !count && statusFilter !== k) return null;
          const label = !k ? 'Toutes' : k === 'en_retard' ? 'En retard' : INVOICE_STATUS_META[k].label;
          return (
            <button key={k || 'all'} onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
              className={'rounded-lg border px-3 py-1.5 text-sm transition-colors ' + (statusFilter === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
              {label} <span className="text-xs opacity-70">({count})</span>
            </button>
          );
        })}
        {clients.length > 1 && (
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            className="ml-auto h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9]">
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Receipt size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-1">{summary?.total ? 'Aucune facture pour ce filtre' : 'Aucune facture'}</p>
          <p className="text-xs text-[#7a8f80]/70 mb-4">Générez la facture du mois depuis les missions validées, ou créez une facture manuelle à lignes libres.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                {['N°', 'Client', 'Type', 'Période / date', 'Statut', 'Total TTC', 'Reste dû', 'Échéance', ''].map((h, i) => (
                  <th key={i} className={'px-4 py-3 text-xs font-medium text-[#7a8f80] ' + (i >= 5 && i <= 6 ? 'text-right' : 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {filtered.map((inv: any) => {
                const meta = invoiceStatusMeta(inv.status);
                return (
                  <tr key={inv.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => router.push('/invoices/' + inv.id)}>
                    <td className="px-4 py-3 font-mono text-sm text-[#0f9d70] whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-[#e8ede9] max-w-44 truncate">{inv.clientName ?? '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80]">{INVOICE_KIND_LABELS[inv.kind] ?? inv.kind}</td>
                    <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">
                      {inv.kind === 'periodique' ? `${fmtDay(inv.periodStart)} → ${fmtDay(inv.periodEnd)}` : fmtDay(inv.issueDate ?? inv.periodStart)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Badge className={meta.cls}>{meta.label}</Badge>
                        {inv.overdue && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30">En retard</Badge>}
                      </div>
                    </td>
                    <td className={'px-4 py-3 text-right font-semibold ' + (Number(inv.totalTtc) < 0 ? 'text-[#C0392B]' : 'text-[#e8ede9]')}>{fmtFCFA(inv.totalTtc)}</td>
                    <td className="px-4 py-3 text-right text-[#D9822B]">{Number(inv.remaining) > 0 ? fmtFCFA(inv.remaining) : '—'}</td>
                    <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDay(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-[#7a8f80]"><ArrowRight size={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager className="border-t border-[#1e2e25] bg-[#111916]" total={total} offset={pager.offset} limit={pager.limit}
            onChange={pager.setOffset} onLimitChange={pager.setLimit} />
        </div>
      )}

      <GenerateModal open={showGenerate} onClose={() => setShowGenerate(false)} loading={generateMut.loading}
        clients={clients} onSubmit={p => generateMut.mutate(p)} />
      <ManualInvoiceModal open={showManual} onClose={() => setShowManual(false)} clients={clients}
        onDone={(id) => { setShowManual(false); refetch(); router.push('/invoices/' + id); }} />
      <ClientsModal open={showClients} onClose={() => setShowClients(false)} clients={clients} canEdit={isAdmin}
        onChanged={() => { refetchClients(); refetch(); }} />
    </div>
  );
}

function GenerateModal({ open, onClose, loading, clients, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean; clients: any[];
  onSubmit: (p: { periodStart: string; periodEnd: string; clientId?: string }) => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [clientId, setClientId] = useState('');
  const { periodStart, periodEnd } = monthRange(month);

  return (
    <Modal open={open} onClose={onClose} title="Générer une facture depuis les missions">
      <div className="space-y-3">
        <p className="text-sm text-[#7a8f80]">
          La génération reprend les <b className="text-[#e8ede9]">missions validées et pas encore facturées</b> de la période,
          les regroupe par prestation et les valorise à la grille tarifaire. Chaque mission n’est facturée qu’une fois.
          La facture est créée en <b className="text-[#e8ede9]">brouillon</b>, modifiable jusqu’à son émission.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Mois</p>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="h-10 w-full px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
          </div>
          <Select label="Client" value={clientId} onChange={e => setClientId(e.target.value)}>
            <option value="">SONATEL (par défaut)</option>
            {clients.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <p className="text-xs text-[#7a8f80]">Période : {fmtDay(periodStart)} → {fmtDay(periodEnd)}</p>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button disabled={loading} onClick={() => onSubmit({ periodStart, periodEnd, clientId: clientId || undefined })}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Générer le brouillon
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ManualInvoiceModal({ open, onClose, clients, onDone }: {
  open: boolean; onClose: () => void; clients: any[]; onDone: (id: string) => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState({ clientId: '', title: '', issueDate: todayIso(), dueDate: '', discountAmount: '', notes: '' });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const valid = linesValid(lines);
  const subtotal = lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)), 0);

  const mut = useMutation(() => invoicesService.createManual({
    clientId: f.clientId || undefined,
    title: f.title || undefined,
    issueDate: f.issueDate || undefined,
    dueDate: f.dueDate || undefined,
    discountAmount: f.discountAmount ? Number(f.discountAmount) : undefined,
    notes: f.notes || undefined,
    lines: lines.map(toLinePayload),
  }), {
    onSuccess: (inv: any) => { toast({ title: 'Facture manuelle créée', description: 'Brouillon — vérifiez puis émettez', variant: 'success' }); onDone(inv.id); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle facture manuelle" size="xl">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Client" value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })}>
            <option value="">— Choisir —</option>
            {clients.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Objet" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Travaux ponctuels…" />
          <Input label="Date de facture" type="date" value={f.issueDate} onChange={e => setF({ ...f, issueDate: e.target.value })} />
          <Input label="Échéance (sinon délai client)" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
        </div>
        <LinesEditor lines={lines} setLines={setLines} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Remise (FCFA, HT)" type="number" min="0" value={f.discountAmount} onChange={e => setF({ ...f, discountAmount: e.target.value })} />
          <div className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3 text-sm">
            <p className="text-xs text-[#7a8f80]">Sous-total des lignes</p>
            <p className="text-lg font-bold text-[#e8ede9]">{fmtFCFA(subtotal - (Number(f.discountAmount) || 0))} <span className="text-xs font-normal text-[#7a8f80]">HT</span></p>
          </div>
        </div>
        <Textarea label="Notes (imprimées sur la facture)" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!valid || mut.loading}>
            {mut.loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Créer le brouillon
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const EMPTY_CLIENT = { name: '', code: '', ninea: '', rccm: '', address: '', city: '', contactName: '', email: '', phone: '', paymentTermsDays: '', notes: '' };

function ClientsModal({ open, onClose, clients, canEdit, onChanged }: {
  open: boolean; onClose: () => void; clients: any[]; canEdit: boolean; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<Record<string, string>>(EMPTY_CLIENT);

  const startEdit = (c: any | null) => {
    setEditing(c ?? {});
    setF(c ? Object.fromEntries(Object.keys(EMPTY_CLIENT).map(k => [k, c[k] == null ? '' : String(c[k])])) : EMPTY_CLIENT);
  };

  const saveMut = useMutation(() => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
      if (k === 'paymentTermsDays') { if (v !== '') payload[k] = Number(v); else if (editing?.id) payload[k] = null; }
      else if (v.trim() !== '') payload[k] = v.trim();
      else if (editing?.id && k !== 'name') payload[k] = null;
    }
    return editing?.id ? clientsService.update(editing.id, payload) : clientsService.create(payload);
  }, {
    onSuccess: () => { toast({ title: 'Client enregistré', variant: 'success' }); setEditing(null); onChanged(); },
    onError: (e: any) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
  });
  const toggleMut = useMutation((c: any) => clientsService.update(c.id, { active: !c.active }), {
    onSuccess: () => onChanged(),
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Clients facturés" size="lg">
      {editing ? (
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveMut.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Raison sociale *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required minLength={2} />
            <Input label="Code" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="SONATEL" />
            <Input label="NINEA" value={f.ninea} onChange={e => setF({ ...f, ninea: e.target.value })} />
            <Input label="RCCM" value={f.rccm} onChange={e => setF({ ...f, rccm: e.target.value })} />
            <Input label="Adresse" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
            <Input label="Ville" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} />
            <Input label="Contact" value={f.contactName} onChange={e => setF({ ...f, contactName: e.target.value })} />
            <Input label="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
            <Input label="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
            <Input label="Délai de paiement (jours)" type="number" min="0" max="365" value={f.paymentTermsDays} onChange={e => setF({ ...f, paymentTermsDays: e.target.value })} placeholder="30" />
          </div>
          <Textarea label="Notes" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Retour</Button>
            <Button type="submit" disabled={saveMut.loading || f.name.trim().length < 2}>
              {saveMut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {canEdit && <Button size="sm" onClick={() => startEdit(null)}><Plus size={13} /> Nouveau client</Button>}
          <div className="divide-y divide-[#1e2e25] rounded-lg border border-[#1e2e25] max-h-96 overflow-y-auto">
            {clients.length === 0 && <p className="p-4 text-sm text-[#7a8f80]">Aucun client — SONATEL SA est créé automatiquement à la première facture périodique.</p>}
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className={'text-sm font-medium ' + (c.active ? 'text-[#e8ede9]' : 'text-[#7a8f80] line-through')}>{c.name} {c.code && <span className="text-xs text-[#7a8f80]">({c.code})</span>}</p>
                  <p className="text-xs text-[#7a8f80] truncate">
                    {[c.ninea && `NINEA ${c.ninea}`, c.city, c.email, c.paymentTermsDays != null && `${c.paymentTermsDays} j`].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(c)} title="Modifier"><Pencil size={13} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate(c)}>{c.active ? 'Désactiver' : 'Réactiver'}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
