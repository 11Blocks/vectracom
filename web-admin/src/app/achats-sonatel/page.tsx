'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, ConfirmDialog, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { purchasesService, stockService } from '@/services';
import { ShoppingCart, Loader2, Plus, Pencil, CheckCircle2, XCircle, AlertTriangle, FileCheck2 } from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente SONATEL', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  valide_sonatel: { label: 'Validé SONATEL', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  refuse: { label: 'Refusé', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  facture: { label: 'Facturé', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
};

const fmt = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [validateTarget, setValidateTarget] = useState<any | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<any | null>(null);

  const { data, loading, refetch } = useQuery(() => purchasesService.list(), []);
  const { data: pertesData } = useQuery(() => purchasesService.pertes(), []);
  const { data: itemsData } = useQuery(() => stockService.listItems(), []);
  const items = useMemo(() => (Array.isArray(itemsData) ? itemsData : []), [itemsData]);

  const createMut = useMutation((d: any) => purchasesService.create(d), {
    onSuccess: () => { toast({ title: 'Achat enregistré (en attente SONATEL)', variant: 'success' }); setShowCreate(false); refetch(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });
  const updateMut = useMutation((d: any) => purchasesService.update(editing?.id, d), {
    onSuccess: () => { toast({ title: 'Achat modifié', variant: 'success' }); setEditing(null); refetch(); },
    onError: (e: any) => toast({ title: 'Modification impossible', description: e.message, variant: 'error' }),
  });
  const statusMut = useMutation(({ id, status }: { id: string; status: string }) => purchasesService.setStatus(id, status), {
    onSuccess: () => { toast({ title: 'Statut mis à jour', variant: 'success' }); setValidateTarget(null); setRefuseTarget(null); refetch(); },
    onError: (e: any) => toast({ title: 'Action refusée', description: e.message, variant: 'error' }),
  });

  const list = Array.isArray(data) ? data : [];
  const filtered = status ? list.filter((p: any) => p.status === status) : list;
  const pertes = (pertesData as any) ?? { seuilPct: 10, totalPertes: 0, depassements: [] };
  const depassements = pertes.depassements ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ShoppingCart size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Achats SONATEL</h1>
            <p className="text-xs text-[#7a8f80]">Matériel acheté par ONECOMIT — validation SONATEL avant facturation</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Nouvel achat</Button>
      </div>

      {/* Pertes matériel + seuil sanction */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
            <AlertTriangle size={15} className={depassements.length > 0 ? 'text-[#C0392B]' : 'text-[#0f9d70]'} />
            Pertes matériel — seuil contractuel {pertes.seuilPct} %
          </h3>
          <span className="text-sm text-[#7a8f80]">Total pertes : <span className="font-bold text-[#C0392B]">{fmt(pertes.totalPertes)}</span> unités</span>
        </div>
        {depassements.length === 0 ? (
          <p className="text-xs text-[#0f9d70]">Aucun article ne dépasse le seuil de {pertes.seuilPct} % — conforme.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#C0392B] font-semibold">{depassements.length} article(s) en dépassement → risque de sanction SONATEL :</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {depassements.map((d: any) => (
                <div key={d.stockItemId} className="p-2.5 rounded-lg border border-[#C0392B]/40 bg-[#C0392B]/10">
                  <p className="text-xs font-medium text-[#e8ede9]">{d.designation} <span className="font-mono text-[#7a8f80]">({d.reference})</span></p>
                  <p className="text-[10px] text-[#C0392B] mt-0.5">pertes {d.pertes} / entrées {d.entrees} = {d.taux} % &gt; {pertes.seuilPct} %</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-52">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState icon={<ShoppingCart size={40} className="text-[#7a8f80]/50" />} title="Aucun achat" description="Enregistrez un achat de matériel manquant — il sera soumis à validation SONATEL." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Désignation</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Qté</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">PU</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Motif</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-2 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-[#172019]/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#e8ede9]">{p.designation}</p>
                    {p.itemReference && <p className="text-[10px] text-[#7a8f80] font-mono">{p.itemReference}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-[#e8ede9] tabular-nums">{p.quantity}</td>
                  <td className="px-4 py-3 text-right text-[#7a8f80] tabular-nums">{fmt(p.unitCost)} F</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#e8ede9] tabular-nums">{fmt(p.totalCost)} F</td>
                  <td className="px-4 py-3 text-[#7a8f80] max-w-44 truncate">{p.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-center"><Badge className={STATUS_META[p.status]?.cls ?? ''}>{STATUS_META[p.status]?.label ?? p.status}</Badge></td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'en_attente' && (
                        <>
                          <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Modifier" onClick={() => setEditing(p)}><Pencil size={14} /></button>
                          <button className="text-[#0f9d70] p-1" title="Valider SONATEL" onClick={() => setValidateTarget(p)}><CheckCircle2 size={14} /></button>
                          <button className="text-[#7a8f80] hover:text-[#C0392B] p-1" title="Refuser" onClick={() => setRefuseTarget(p)}><XCircle size={14} /></button>
                        </>
                      )}
                      {p.status === 'valide_sonatel' && (
                        <button className="text-[#5b8def] p-1" title="Marquer facturé" onClick={() => statusMut.mutate({ id: p.id, status: 'facture' })}><FileCheck2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <PurchaseModal items={items} onClose={() => setShowCreate(false)} onSubmit={(d) => createMut.mutate(d)} loading={createMut.loading} />
      )}
      {editing && (
        <PurchaseModal items={items} initial={editing} onClose={() => setEditing(null)} onSubmit={(d) => updateMut.mutate(d)} loading={updateMut.loading} />
      )}
      <ConfirmDialog open={!!validateTarget} onClose={() => setValidateTarget(null)} title="Valider l'achat (SONATEL)"
        message={`Valider l'achat de ${validateTarget?.quantity} × « ${validateTarget?.designation} » pour facturation au donneur d'ordre ?`}
        confirmText="Valider SONATEL" onConfirm={() => validateTarget && statusMut.mutate({ id: validateTarget.id, status: 'valide_sonatel' })} />
      <ConfirmDialog open={!!refuseTarget} onClose={() => setRefuseTarget(null)} title="Refuser l'achat"
        message={`Refuser l'achat de « ${refuseTarget?.designation} » ?`} confirmText="Refuser" danger
        onConfirm={() => refuseTarget && statusMut.mutate({ id: refuseTarget.id, status: 'refuse' })} />
    </div>
  );
}

function PurchaseModal({ items, initial, onClose, onSubmit, loading }: {
  items: any[]; initial?: any; onClose: () => void; onSubmit: (d: any) => void; loading: boolean;
}) {
  const [f, setF] = useState({
    stockItemId: initial?.stockItemId ?? '',
    designation: initial?.designation ?? '',
    quantity: initial ? String(initial.quantity) : '1',
    unitCost: initial ? String(initial.unitCost) : '',
    reason: initial?.reason ?? '',
    note: initial?.note ?? '',
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.designation.trim() && Number(f.quantity) > 0 && Number(f.unitCost) >= 0;

  return (
    <Modal open onClose={onClose} title={initial ? 'Modifier l’achat' : 'Nouvel achat matériel'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ stockItemId: f.stockItemId || null, designation: f.designation.trim(), quantity: Number(f.quantity), unitCost: Number(f.unitCost), reason: f.reason.trim() || undefined, note: f.note.trim() || undefined }); }}>
        <Select label="Article référencé (optionnel)" value={f.stockItemId} onChange={(e) => set('stockItemId', e.target.value)}>
          <option value="">— Aucun —</option>
          {items.map((it: any) => <option key={it.id} value={it.id}>{it.reference} · {it.designation}</option>)}
        </Select>
        <Input label="Désignation *" value={f.designation} onChange={(e) => set('designation', e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantité *" type="number" min="1" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} required />
          <Input label="Prix unitaire (FCFA) *" type="number" min="0" value={f.unitCost} onChange={(e) => set('unitCost', e.target.value)} required />
        </div>
        <Input label="Motif de l'achat" value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Manquant stock, casse terrain, urgence…" />
        <Input label="Note" value={f.note} onChange={(e) => set('note', e.target.value)} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !valid}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : initial ? <Pencil size={14} /> : <Plus size={14} />} {initial ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
