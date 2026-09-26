'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, Input, Select, Textarea, useToast, Tabs, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { stockService, serialLifecycle } from '@/services';
import { api } from '@/lib/api';
import { useSessionUser } from '@/components/admin/TenantPicker';
import { Package, Plus, Search, Loader2, Boxes, ArrowRightLeft, Trash2, Eye, Warehouse, Barcode, Link2, FileSpreadsheet, AlertTriangle, Smartphone, Edit, ClipboardList, Undo2 } from 'lucide-react';

const MOVEMENT_META: Record<string, { label: string; cls: string; sign: '+' | '-' | null }> = {
  entree: { label: 'Entrée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30', sign: '+' },
  transfert: { label: 'Transfert', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30', sign: null },
  affectation: { label: 'Affectation équipe', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30', sign: null },
  consommation: { label: 'Consommation', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', sign: '-' },
  echange_sav: { label: 'Échange SAV', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30', sign: null },
  ajustement: { label: 'Ajustement (quantité comptée)', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', sign: null },
  retour: { label: 'Retour', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30', sign: '+' },
  sortie_feraillerie: { label: 'Sortie ferraillerie', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30', sign: '-' },
};
/** Emplacements exigés par type (miroir des règles serveur). */
const MOVEMENT_REQ: Record<string, { from: boolean | 'optional'; to: boolean | 'optional' }> = {
  entree: { from: false, to: true },
  transfert: { from: true, to: true },
  affectation: { from: true, to: true },
  consommation: { from: true, to: false },
  echange_sav: { from: false, to: 'optional' },
  ajustement: { from: false, to: true },
  retour: { from: false, to: true },
  sortie_feraillerie: { from: true, to: false },
};
const CHEF_TYPES = ['consommation', 'retour', 'echange_sav'];
const WH_TYPE_META: Record<string, { label: string; cls: string }> = {
  CENTRAL: { label: 'Dépôt central', cls: 'text-[#0f9d70]' },
  VEHICLE: { label: 'Véhicule', cls: 'text-[#f5a623]' },
  SITE: { label: 'Site', cls: 'text-[#5b8def]' },
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'CONSUMABLE' | 'ASSET' | 'BORDEREAU' | 'PARC' | 'OUTILLAGE'>('CONSUMABLE');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [cancelMv, setCancelMv] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [focusFileRef] = useState(() => ({ current: null as HTMLInputElement | null }));
  const { user } = useSessionUser();
  const role = user?.role as string | undefined;
  const canManage = role === 'admin' || role === 'magasinier';

  const { data: items, loading, error: itemsError, refetch } = useQuery(() => stockService.listItems(), []);
  const { data: warehouses, error: whError } = useQuery(() => stockService.listWarehouses(), []);
  const { data: movements, refetch: refetchMv, error: mvError } = useQuery(() => stockService.listMovements(), []);
  const stockError = itemsError || whError || mvError;

  // Niveaux par article — source de vérité des quantités par emplacement
  const [levelsByItem, setLevelsByItem] = useState<Record<string, any[]>>({});
  const [levelsLoading, setLevelsLoading] = useState(true);
  const itemsList = Array.isArray(items) ? items : [];
  const whList = Array.isArray(warehouses) ? warehouses : [];

  useEffect(() => {
    if (!itemsList.length) { setLevelsLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLevelsLoading(true);
      const entries = await Promise.all(itemsList.map(async (it: any) => {
        try {
          const lv = await api.get(`/stock-items/${it.id}/levels`);
          return [it.id, Array.isArray(lv) ? lv : []] as const;
        } catch { return [it.id, []] as const; }
      }));
      if (!cancelled) {
        setLevelsByItem(Object.fromEntries(entries));
        setLevelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const totalOf = (id: string) => (levelsByItem[id] ?? []).reduce((s, l) => s + Number(l.quantity ?? 0), 0);
  const whName = (id?: string | null) => id ? (whList.find((w: any) => w.id === id)?.name ?? '—') : '—';
  const itemOf = (id?: string | null) => id ? itemsList.find((i: any) => i.id === id) : undefined;

  const deleteMut = useMutation((id: string) => stockService.deleteItem(id), {
    onSuccess: () => { toast({ title: 'Article supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const cancelMut = useMutation(() => stockService.cancelMovement(cancelMv.id, cancelReason.trim()), {
    onSuccess: () => { toast({ title: 'Mouvement annulé — stock rétabli', variant: 'success' }); setCancelMv(null); setCancelReason(''); refetch(); refetchMv(); },
    onError: (e: any) => toast({ title: 'Annulation impossible', description: e.message, variant: 'error' }),
  });

  const focusMut = useMutation((file: File) => stockService.focusImport(file), {
    onSuccess: (r: any) => {
      toast({
        title: 'Import FOCUS terminé',
        description: `${r?.createdItems ?? 0} article(s) créé(s), ${r?.updatedLevels ?? 0} niveau(x) ajusté(s)${r?.errors?.length ? ` — ${r.errors.length} ligne(s) en erreur` : ''}`,
        variant: 'success',
      });
      refetch(); refetchMv();
    },
    onError: (e: any) => toast({ title: 'Import FOCUS impossible', description: e.message, variant: 'error' }),
  });

  const list = itemsList
    .filter(i => i.category === tab)
    .filter(i => !search || `${i.reference} ${i.designation}`.toLowerCase().includes(search.toLowerCase()));
  const lowCount = itemsList.filter(i => totalOf(i.id) <= (i.thresholdAlert ?? 0)).length;
  const mvList = Array.isArray(movements) ? movements : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Package size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Stock</h1>
            <p className="text-xs text-[#7a8f80]">Gestion des articles et équipements — {itemsList.length} références{lowCount > 0 && <span className="text-[#D9822B]"> · {lowCount} en alerte</span>}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            ref={(el) => { focusFileRef.current = el; }}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) focusMut.mutate(f);
              e.target.value = '';
            }}
          />
          {canManage && (
            <>
              <Button variant="outline" size="sm" loading={focusMut.loading} onClick={() => focusFileRef.current?.click()}>
                <FileSpreadsheet size={14} /> Import FOCUS
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowInventory(true)}><ClipboardList size={14} /> Inventaire</Button>
            </>
          )}
          {role !== 'direction' && <Button variant="secondary" onClick={() => setShowMovement(true)}><ArrowRightLeft size={15} /> Enregistrer mouvement</Button>}
          {canManage && tab !== 'BORDEREAU' && tab !== 'PARC' && tab !== 'OUTILLAGE' && <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter article</Button>}
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'CONSUMABLE', label: 'Consommables', count: itemsList.filter(i => i.category === 'CONSUMABLE').length },
          { value: 'ASSET', label: 'Équipements (sérialisés)', count: itemsList.filter(i => i.category === 'ASSET').length },
          { value: 'OUTILLAGE', label: 'Outillage équipes' },
          { value: 'BORDEREAU', label: 'Bordereau de prix' },
          { value: 'PARC', label: 'Parc sérialisé' },
        ]}
        active={tab}
        onChange={v => setTab(v as any)}
      />

      {tab === 'BORDEREAU' ? (
        <BordereauTab />
      ) : tab === 'PARC' ? (
        <SerialFleetTab />
      ) : tab === 'OUTILLAGE' ? (
        <ToolingTab />
      ) : (
        <>
          {/* Barre de recherche */}
          <div className="relative max-w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
            <input
              type="text" placeholder="Rechercher par réf. ou désignation…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
            />
          </div>

          {/* Table articles */}
          {stockError ? (
            <Card className="border-[#C0392B]/40 bg-[#C0392B]/[0.06] p-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-[#C0392B] mb-2" />
              <p className="text-sm text-[#C0392B] mb-1">Stock indisponible</p>
              <p className="text-xs text-[#7a8f80] mb-3">{stockError}</p>
              <p className="text-[10px] text-[#7a8f80] mb-3">Vérifiez l’API sur le port 3100 (pas 3000 / Trackit).</p>
              <Button size="sm" onClick={() => refetch()}><Loader2 size={14} /> Réessayer</Button>
            </Card>
          ) : loading || levelsLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : list.length === 0 ? (
            <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
              <Boxes size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
              <p className="text-sm text-[#7a8f80] mb-4">Aucun article dans cette catégorie</p>
              <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter un article</Button>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2e25] bg-[#111916]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Désignation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Famille</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Qté totale</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Seuil alerte</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                  {list.map((item: any) => {
                    const total = totalOf(item.id);
                    const low = total <= (item.thresholdAlert ?? 0);
                    return (
                      <tr key={item.id} className="hover:bg-[#172019] transition-colors cursor-pointer" onClick={() => setDetailItem(item)}>
                        <td className="px-4 py-3 font-mono text-xs text-[#0f9d70]">{item.reference}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#e8ede9]">{item.designation}</p>
                          {item.unit && <p className="text-xs text-[#7a8f80]">unité : {item.unit}</p>}
                        </td>
                        <td className="px-4 py-3"><Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{item.family}</Badge></td>
                        <td className="px-4 py-3 text-right font-semibold text-[#e8ede9]">{total}</td>
                        <td className="px-4 py-3 text-right text-[#7a8f80]">{item.thresholdAlert ?? '—'}</td>
                        <td className="px-4 py-3">
                          {low
                            ? <Badge className="bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30"><AlertTriangle size={11} className="mr-1" /> Alerte</Badge>
                            : <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30">OK</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setDetailItem(item)} title="Fiche article"><Eye size={14} /></Button>
                            {canManage && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditItem(item)} title="Modifier"><Edit size={14} /></Button>}
                            {role === 'admin' && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(item.id)} title="Supprimer"><Trash2 size={14} /></Button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Emplacements */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><Warehouse size={15} className="text-[#0f9d70]" /> Emplacements ({whList.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {whList.map((w: any) => {
                const meta = WH_TYPE_META[w.type] ?? { label: w.type, cls: 'text-[#7a8f80]' };
                const levels = Object.entries(levelsByItem).flatMap(([itemId, lv]) =>
                  (lv as any[]).filter(l => l.warehouseId === w.id).map(l => ({ itemId, quantity: Number(l.quantity) }))
                );
                const alerts = levels.filter(l => {
                  const it = itemsList.find(i => i.id === l.itemId);
                  return it && l.quantity <= (it.thresholdAlert ?? 0);
                });
                return (
                  <div key={w.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#e8ede9]">{w.name}</span>
                      <Badge className={'bg-[#1a2420] border-[#1e2e25] ' + meta.cls}>{meta.label}</Badge>
                    </div>
                    {levels.length === 0 ? (
                      <p className="text-xs text-[#7a8f80]/60">Aucun article stocké</p>
                    ) : alerts.length === 0 ? (
                      <p className="text-xs text-[#0f9d70]">Aucun article en alerte · {levels.length} référence(s)</p>
                    ) : (
                      <div className="space-y-1">
                        {alerts.slice(0, 3).map(a => {
                          const it = itemsList.find(i => i.id === a.itemId);
                          return <p key={a.itemId} className="text-xs text-[#D9822B] flex items-center gap-1"><AlertTriangle size={11} /> {it?.reference} : {a.quantity} restant(s)</p>;
                        })}
                        {alerts.length > 3 && <p className="text-[10px] text-[#7a8f80]">+ {alerts.length - 3} autre(s)</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mouvements récents */}
          <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e2e25] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><ArrowRightLeft size={15} className="text-[#0f9d70]" /> Mouvements récents</h3>
              {role !== 'direction' && <Button size="sm" variant="secondary" onClick={() => setShowMovement(true)}><Plus size={13} /> Mouvement</Button>}
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2e25] bg-[#111916]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Article</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Qté</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Dépôt source</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Dépôt dest.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Notes</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                  {mvList.slice(0, 50).map((mv: any) => {
                    const meta = MOVEMENT_META[mv.type] ?? { label: mv.type, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', sign: null };
                    const item = itemOf(mv.stockItemId);
                    return (
                      <tr key={mv.id} className={'hover:bg-[#172019] transition-colors ' + (mv.cancelledAt ? 'opacity-50 line-through' : '')}
                        title={mv.cancelledAt ? `Annulé : ${mv.cancelReason ?? ''}` : undefined}>
                        <td className="px-4 py-2.5 text-[#7a8f80] whitespace-nowrap">{mv.createdAt ? new Date(mv.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="px-4 py-2.5"><Badge className={meta.cls}>{meta.label}</Badge></td>
                        <td className="px-4 py-2.5">
                          <p className="font-mono text-xs text-[#0f9d70]">{item?.reference ?? '—'}</p>
                          <p className="text-xs text-[#7a8f80]">{item?.designation ?? ''}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#e8ede9]">{meta.sign}{mv.quantity}</td>
                        <td className="px-4 py-2.5 text-[#7a8f80]">{whName(mv.fromWarehouseId)}</td>
                        <td className="px-4 py-2.5 text-[#7a8f80]">{whName(mv.toWarehouseId)}</td>
                        <td className="px-4 py-2.5 text-[#7a8f80] max-w-48 truncate" title={mv.note ?? ''}>{mv.note ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {canManage && !mv.cancelledAt && !mv.itemSerialId && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setCancelMv(mv)} title="Annuler ce mouvement (stock rétabli)">
                              <Undo2 size={13} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {mvList.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#7a8f80]">Aucun mouvement enregistré</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Création article */}
      <CreateItemModal open={showCreate} onClose={() => setShowCreate(false)} defaultCategory={tab === 'ASSET' ? 'ASSET' : 'CONSUMABLE'} onDone={refetch} />

      {/* Édition article */}
      <EditItemModal item={editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); refetch(); }} />

      {/* Mouvement */}
      <MovementModal open={showMovement} onClose={() => setShowMovement(false)} items={itemsList} warehouses={whList} role={role} onDone={() => { refetch(); refetchMv(); }} />
      {showInventory && (
        <InventoryModal open onClose={() => setShowInventory(false)} items={itemsList} warehouses={whList} levelsByItem={levelsByItem} onDone={() => { refetch(); refetchMv(); }} />
      )}

      {/* Fiche article */}
      <ItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} levels={detailItem ? (levelsByItem[detailItem.id] ?? []) : []} canManage={canManage} warehouses={whList} />

      <Modal open={!!cancelMv} onClose={() => { setCancelMv(null); setCancelReason(''); }} title="Annuler le mouvement">
        {cancelMv && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); cancelMut.mutate(); }}>
            <p className="text-sm text-[#e8ede9]">
              {MOVEMENT_META[cancelMv.type]?.label ?? cancelMv.type} · {itemOf(cancelMv.stockItemId)?.reference ?? ''} · quantité {cancelMv.quantity}
            </p>
            <p className="text-xs text-[#7a8f80]">Les quantités sont remises dans l'état d'avant le mouvement (refusé si le stock a été consommé entre-temps). Le mouvement reste visible, barré.</p>
            <Textarea label="Motif *" rows={2} required minLength={5} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Erreur de saisie, mauvais emplacement…" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCancelMv(null)}>Fermer</Button>
              <Button type="submit" variant="danger" disabled={cancelMut.loading || cancelReason.trim().length < 5}>
                {cancelMut.loading && <Loader2 size={14} className="animate-spin" />} Annuler le mouvement
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer l'article"
        message="Possible uniquement pour un article jamais mouvementé et sans stock (traçabilité)."
        confirmText="Supprimer" danger onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

/* ═════════════════ ONGLET BORDEREAU DE PRIX ═════════════════ */
/**
 * P7 — Parc sérialisé de bout en bout (fichier « Suivi End to End modems F6600 ») :
 * réception SONATEL → équipe → client (ND) → retour défectueux → retour SONATEL.
 */
function SerialFleetTab() {
  const { toast } = useToast();
  const [reference, setReference] = useState('');
  const [fleet, setFleet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[] | null>(null);

  const loadFleet = async (ref: string) => {
    if (!ref.trim()) return;
    setLoading(true);
    try {
      const d = await serialLifecycle.fleet(ref.trim());
      setFleet(d);
    } catch (e: any) {
      toast({ title: 'Parc introuvable', description: e.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (q.trim().length < 3) return;
    try {
      setResults(await serialLifecycle.search(q.trim()));
    } catch (e: any) {
      toast({ title: 'Recherche impossible', description: e.message, variant: 'error' });
    }
  };

  const scrap = async (id: string) => {
    const raw = window.prompt('Montant feraillerie (FCFA, optionnel) :', '');
    if (raw === null) return;
    const amount = raw.trim() ? Number(raw.replace(/\s/g, '')) : undefined;
    try {
      await serialLifecycle.scrapSale(id, Number.isFinite(amount as number) ? amount : undefined);
      toast({ title: 'Sortie feraillerie enregistrée', variant: 'success' });
      if (reference) await loadFleet(reference);
    } catch (e: any) {
      toast({ title: 'Feraillerie impossible', description: e.message, variant: 'error' });
    }
  };

  const STATUS_CLS: Record<string, string> = {
    disponible: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30',
    en_cours: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30',
    defectueux: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30',
    recupere_defectueux: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30',
    recupere_bon: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30',
    feraillerie: 'bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30',
    retourne: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]',
    perdu: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30',
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Scanner / coller un n° de série ou ND client…"
            className="flex-1 h-10 px-3.5 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
          <Button onClick={search}><Search size={15} /> Scanner</Button>
        </div>
        {results && (
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
            {results.length === 0 && <p className="text-xs text-[#7a8f80]/70">Aucun résultat.</p>}
            {results.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                <div>
                  <p className="text-sm font-mono text-[#e8ede9]">{r.serialNumber}</p>
                  <p className="text-[10px] text-[#7a8f80]">{r.reference} — {r.designation}{r.clientNd ? ` · posé chez ${r.clientNd}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {['defectueux', 'recupere_defectueux', 'perdu'].includes(r.status) && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#D9822B]" onClick={() => scrap(r.id)}>Feraillerie</Button>
                  )}
                  <Badge className={STATUS_CLS[r.status] ?? STATUS_CLS.retourne}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48">
            <Input label="Référence de l'article sérialisé" value={reference} onChange={e => setReference(e.target.value)} placeholder="MODEM-F6600" onKeyDown={(e: any) => e.key === 'Enter' && loadFleet(reference)} />
          </div>
          <Button onClick={() => loadFleet(reference)} loading={loading}><Smartphone size={15} /> État du parc</Button>
        </div>

        {fleet && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {['disponible', 'en_cours', 'defectueux', 'recupere_bon', 'recupere_defectueux', 'feraillerie', 'retourne', 'perdu'].map(st => (
                <div key={st} className="p-2.5 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
                  <p className="text-lg font-bold text-[#e8ede9]">{fleet.byStatus[st] ?? 0}</p>
                  <p className="text-[10px] text-[#7a8f80] capitalize">{st.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 max-h-96 overflow-y-auto">
              {fleet.serials.length === 0 && <p className="p-4 text-xs text-[#7a8f80]/70 text-center">Aucun n° de série enregistré — réceptionnez un lot SONATEL.</p>}
              {fleet.serials.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-[#e8ede9]">{s.serialNumber}</p>
                    <p className="text-[10px] text-[#7a8f80] truncate">
                      {s.cartonNumber ? `carton ${s.cartonNumber} · ` : ''}{s.team ? `équipe ${s.team}${s.deliveredToTeamAt ? ` (${s.deliveredToTeamAt})` : ''} · ` : ''}
                      {s.clientNd ? `posé chez ${s.clientNd}${s.installedAt ? ` (${s.installedAt})` : ''}` : ''}
                      {s.returnedToSonatelAt ? ` · retourné SONATEL ${s.returnedToSonatelAt}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {['defectueux', 'recupere_defectueux', 'perdu'].includes(s.status) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#D9822B]" onClick={() => scrap(s.id)}>Feraillerie</Button>
                    )}
                    <Badge className={STATUS_CLS[s.status] ?? STATUS_CLS.retourne}>{s.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ToolingTab() {
  const { data: teams } = useQuery(() => api.get('/teams'), []);
  const [teamId, setTeamId] = useState('');
  const { data, loading, refetch } = useQuery(
    () => serialLifecycle.tooling(teamId || undefined),
    [teamId],
  );
  const list = Array.isArray(data) ? data : [];
  const teamsList = Array.isArray(teams) ? teams : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9]"
        >
          <option value="">Toutes les équipes</option>
          {teamsList.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => refetch()}><Search size={14} /> Actualiser</Button>
        <span className="text-xs text-[#7a8f80]">{list.length} équipement(s) affecté(s)</span>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-10 text-center">
          <p className="text-sm text-[#7a8f80]">Aucun outillage / matériel livré aux équipes.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Série</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Article</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Livré</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs text-[#0f9d70]">{r.serialNumber}</td>
                  <td className="px-4 py-3 text-[#e8ede9]">{r.reference} — {r.designation}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">{r.teamName ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">{r.deliveredAt ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7a8f80]">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BordereauTab() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { data: cats } = useQuery(() => api.get('/price-items/categories'), []);
  const { data, loading } = useQuery(
    () => {
      const params = new URLSearchParams({ priceGrid: 'BORDEREAU_3STB', isActive: 'true' });
      if (search.trim().length >= 2) return api.get(`/price-items/search?q=${encodeURIComponent(search.trim())}`);
      if (category) params.set('category', category);
      const qs = params.toString();
      return api.get('/price-items' + (qs ? '?' + qs : ''));
    },
    [search, category],
  );
  const items = Array.isArray(data) ? data : [];
  const categories = Array.isArray(cats) ? cats : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input type="text" placeholder="Rechercher un item (N°, désignation)…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
        </div>
        <Select value={category} onChange={e => setCategory(e.target.value)} className="w-44">
          <option value="">Toutes catégories</option>
          {categories.map((c: any) => {
            const v = typeof c === 'string' ? c : c.category;
            return <option key={v} value={v}>{v}{typeof c === 'object' && c.count !== undefined ? ` (${c.count})` : ''}</option>;
          })}
        </Select>
        <a href="/invoices/bordereau" className="text-xs text-[#0f9d70] hover:underline ml-auto flex items-center gap-1"><FileSpreadsheet size={13} /> Bordereau actif — {items.length} item(s) · modifier les prix</a>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80] w-16">N°</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Désignation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Unité</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">PU (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {items.map((p: any) => (
                <tr key={p.id} className="hover:bg-[#172019] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0f9d70]">{p.itemNumber}</td>
                  <td className="px-4 py-2.5 text-[#e8ede9]">{p.designation}</td>
                  <td className="px-4 py-2.5"><Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{p.category ?? '—'}</Badge></td>
                  <td className="px-4 py-2.5 text-[#7a8f80]">{p.unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#e8ede9]">{Number(p.unitPrice).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#7a8f80]">Aucun item trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═════════════════ MODAL CRÉATION ARTICLE ═════════════════ */
function CreateItemModal({ open, onClose, defaultCategory, onDone }: {
  open: boolean; onClose: () => void; defaultCategory: string; onDone: () => void;
}) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({ reference: '', designation: '', category: defaultCategory, family: 'FIBRE', unit: '', thresholdAlert: 10 });

  useEffect(() => { if (open) setF({ reference: '', designation: '', category: defaultCategory, family: 'FIBRE', unit: '', thresholdAlert: 10 }); }, [open, defaultCategory]);

  const mut = useMutation((d: any) => stockService.createItem(d), {
    onSuccess: () => { toast({ title: 'Article créé', variant: 'success' }); onClose(); onDone(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un article">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(f); }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Référence *" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} required placeholder="CBL-FTTH-100M" />
          <Input label="Désignation *" value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} required placeholder="Câble fibre optique 100m" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie *" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            <option value="CONSUMABLE">Consommable (quantité)</option>
            <option value="ASSET">Équipement (sérialisé)</option>
          </Select>
          <Select label="Famille *" value={f.family} onChange={e => setF({ ...f, family: e.target.value })}>
            <option value="FIBRE">Fibre</option>
            <option value="CUIVRE">Cuivre</option>
            <option value="OUTILLAGE">Outillage</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unité" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="m, u, boîte…" />
          <Input label="Seuil d'alerte" type="number" min={0} value={f.thresholdAlert} onChange={e => setF({ ...f, thresholdAlert: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditItemModal({ item, onClose, onDone }: { item: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({});

  useEffect(() => {
    if (item) {
      setF({
        reference: item.reference ?? '',
        designation: item.designation ?? '',
        category: item.category ?? 'CONSUMABLE',
        family: item.family ?? 'FIBRE',
        unit: item.unit ?? '',
        thresholdAlert: item.thresholdAlert ?? 10,
      });
    }
  }, [item]);

  const mut = useMutation((d: any) => stockService.updateItem(item.id, d), {
    onSuccess: () => { toast({ title: 'Article mis à jour', variant: 'success' }); onDone(); },
    onError: (e: any) => toast({ title: 'Mise à jour impossible', description: e.message, variant: 'error' }),
  });

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title={`Modifier — ${item.reference}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(f); }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Référence *" value={f.reference ?? ''} onChange={e => setF({ ...f, reference: e.target.value })} required />
          <Input label="Désignation *" value={f.designation ?? ''} onChange={e => setF({ ...f, designation: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie *" value={f.category ?? 'CONSUMABLE'} onChange={e => setF({ ...f, category: e.target.value })}>
            <option value="CONSUMABLE">Consommable (quantité)</option>
            <option value="ASSET">Équipement (sérialisé)</option>
          </Select>
          <Select label="Famille *" value={f.family ?? 'FIBRE'} onChange={e => setF({ ...f, family: e.target.value })}>
            <option value="FIBRE">Fibre</option>
            <option value="CUIVRE">Cuivre</option>
            <option value="OUTILLAGE">Outillage</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unité" value={f.unit ?? ''} onChange={e => setF({ ...f, unit: e.target.value })} />
          <Input label="Seuil d'alerte" type="number" min={0} value={f.thresholdAlert ?? 0} onChange={e => setF({ ...f, thresholdAlert: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════════ MODAL MOUVEMENT ═════════════════ */
function MovementModal({ open, onClose, items, warehouses, onDone, role }: {
  open: boolean; onClose: () => void; items: any[]; warehouses: any[]; onDone: () => void; role?: string;
}) {
  const { toast } = useToast();
  const allowedTypes = Object.keys(MOVEMENT_META).filter(k => role !== 'chef_equipe' || CHEF_TYPES.includes(k));
  const blank = () => ({ type: allowedTypes[0] ?? 'entree', stockItemId: '', itemSerialId: '', quantity: 1, fromWarehouseId: '', toWarehouseId: '', note: '' });
  const [f, setF] = useState<Record<string, any>>(blank);
  const [serials, setSerials] = useState<any[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setF(blank()); }, [open]);

  const item = items.find(i => i.id === f.stockItemId);
  const isAsset = item?.category === 'ASSET';
  useEffect(() => {
    if (!isAsset) { setSerials([]); return; }
    stockService.listSerials(item.id).then((s: any) => setSerials(Array.isArray(s) ? s : [])).catch(() => setSerials([]));
  }, [isAsset, item?.id]);

  const mut = useMutation((d: any) => stockService.createMovement(d), {
    onSuccess: (r: any) => {
      const warn = r?.lowStockWarnings?.length ? ` — alerte seuil : ${r.lowStockWarnings.map((w: any) => w.reference).join(', ')}` : '';
      toast({ title: 'Mouvement enregistré' + warn, variant: 'success' }); onClose(); onDone();
    },
    onError: (e: any) => toast({ title: 'Mouvement refusé', description: e.message, variant: 'error' }),
  });

  const req = MOVEMENT_REQ[f.type] ?? { from: false, to: false };
  const isAdjust = f.type === 'ajustement';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { type: f.type, stockItemId: f.stockItemId, quantity: isAsset ? 1 : Number(f.quantity), note: f.note || undefined };
    if (req.from && f.fromWarehouseId) payload.fromWarehouseId = f.fromWarehouseId;
    if (req.to && f.toWarehouseId) payload.toWarehouseId = f.toWarehouseId;
    if (isAsset && f.itemSerialId) payload.itemSerialId = f.itemSerialId;
    mut.mutate(payload);
  };
  const missing = !f.stockItemId || (req.from === true && !f.fromWarehouseId) || (req.to === true && !f.toWarehouseId) || (isAsset && !f.itemSerialId);

  return (
    <Modal open={open} onClose={onClose} title="Enregistrer un mouvement">
      <form className="space-y-3" onSubmit={submit}>
        <Select label="Type de mouvement *" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
          {allowedTypes.map(k => <option key={k} value={k}>{MOVEMENT_META[k].label}</option>)}
        </Select>
        <Select label="Article *" value={f.stockItemId} onChange={e => setF({ ...f, stockItemId: e.target.value, itemSerialId: '' })} required>
          <option value="">— Sélectionner —</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.reference} — {i.designation}{i.category === 'ASSET' ? ' (sérialisé)' : ''}</option>)}
        </Select>
        {isAsset ? (
          <Select label="Numéro de série *" value={f.itemSerialId} onChange={e => setF({ ...f, itemSerialId: e.target.value })} required>
            <option value="">— Sélectionner —</option>
            {serials.map(s => <option key={s.id} value={s.id}>{s.serialNumber} · {s.status}</option>)}
          </Select>
        ) : (
          <Input label={isAdjust ? 'Quantité comptée (nouveau niveau) *' : 'Quantité *'} type="number" min={isAdjust ? 0 : 1}
            value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} required />
        )}
        {isAdjust && <p className="text-[11px] text-[#7a8f80]">L’ajustement fixe le niveau de l’emplacement à la quantité comptée ; l’écart est tracé.</p>}
        <div className="grid grid-cols-2 gap-3">
          {req.from && (
            <Select label="Emplacement source *" value={f.fromWarehouseId} onChange={e => setF({ ...f, fromWarehouseId: e.target.value })}>
              <option value="">—</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          )}
          {req.to && (
            <Select label={req.to === true ? 'Emplacement destination *' : 'Retour au dépôt (optionnel)'} value={f.toWarehouseId} onChange={e => setF({ ...f, toWarehouseId: e.target.value })}>
              <option value="">—</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          )}
        </div>
        <Textarea label="Note" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} rows={2} placeholder="Mission, commande, motif d'ajustement…" />
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || missing}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════════ INVENTAIRE D'UN EMPLACEMENT ═════════════════ */
function InventoryModal({ open, onClose, items, warehouses, levelsByItem, onDone }: {
  open: boolean; onClose: () => void; items: any[]; warehouses: any[]; levelsByItem: Record<string, any[]>; onDone: () => void;
}) {
  const { toast } = useToast();
  const [warehouseId, setWarehouseId] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const consumables = items.filter(i => i.category !== 'ASSET');
  const levelAt = (itemId: string) => Number((levelsByItem[itemId] ?? []).find((l: any) => l.warehouseId === warehouseId)?.quantity ?? 0);
  const changed = consumables.filter(i => counts[i.id] !== undefined && counts[i.id] !== '' && Number(counts[i.id]) !== levelAt(i.id));

  const mut = useMutation(() => stockService.inventory(
    warehouseId,
    changed.map(i => ({ stockItemId: i.id, countedQuantity: Number(counts[i.id]) })),
    note.trim() || undefined,
  ), {
    onSuccess: (r: any) => { toast({ title: `Inventaire enregistré — ${r?.adjusted ?? 0} ajustement(s)`, variant: 'success' }); onClose(); onDone(); },
    onError: (e: any) => toast({ title: 'Inventaire refusé', description: e.message, variant: 'error' }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Inventaire d'un emplacement" size="lg">
      <div className="space-y-3">
        <Select label="Emplacement *" value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setCounts({}); }}>
          <option value="">— Sélectionner —</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
        {warehouseId && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[#1e2e25]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#111916]">
                <tr className="text-xs text-[#7a8f80]">
                  <th className="px-3 py-2 text-left font-medium">Article</th>
                  <th className="px-3 py-2 text-right font-medium">Théorique</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Compté</th>
                  <th className="px-3 py-2 text-right font-medium">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50">
                {consumables.map(i => {
                  const theo = levelAt(i.id);
                  const c = counts[i.id];
                  const diff = c !== undefined && c !== '' ? Number(c) - theo : null;
                  return (
                    <tr key={i.id}>
                      <td className="px-3 py-1.5"><span className="font-mono text-xs text-[#0f9d70]">{i.reference}</span> <span className="text-xs text-[#7a8f80]">{i.designation}</span></td>
                      <td className="px-3 py-1.5 text-right text-[#e8ede9]">{theo}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input type="number" min={0} value={c ?? ''} placeholder={String(theo)}
                          onChange={e => setCounts({ ...counts, [i.id]: e.target.value })}
                          className="w-24 h-8 rounded-md bg-[#0a0f0d] border border-[#1e2e25] px-2 text-right text-sm text-[#e8ede9]" />
                      </td>
                      <td className={'px-3 py-1.5 text-right font-semibold ' + (diff == null || diff === 0 ? 'text-[#7a8f80]' : diff > 0 ? 'text-[#0f9d70]' : 'text-[#C0392B]')}>
                        {diff == null ? '—' : (diff > 0 ? '+' : '') + diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Input label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="Inventaire mensuel, contrôle surprise…" />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[#7a8f80]">{changed.length} écart(s) — seules les lignes modifiées créent un ajustement. Les articles sérialisés sont exclus.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button disabled={!warehouseId || !changed.length || mut.loading} onClick={() => mut.mutate()}>
              {mut.loading && <Loader2 size={14} className="animate-spin" />} Valider l'inventaire
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ═════════════════ FICHE ARTICLE ═════════════════ */
function ItemDetailModal({ item, onClose, levels, canManage, warehouses = [] }: {
  item: any | null; onClose: () => void; levels: any[]; canManage?: boolean; warehouses?: any[];
}) {
  const { toast } = useToast();
  const whNameOf = (id: string | null | undefined, fallback: string) => (id ? warehouses.find(w => w.id === id)?.name ?? 'Emplacement' : fallback);
  const [serials, setSerials] = useState<any[]>([]);
  const [trace, setTrace] = useState<{ serial: any; events: any[] } | null>(null);
  const [newSerials, setNewSerials] = useState('');
  const [adding, setAdding] = useState(false);

  const loadSerials = async () => {
    if (!item || item.category !== 'ASSET') { setSerials([]); return; }
    try {
      const s = await stockService.listSerials(item.id);
      setSerials(Array.isArray(s) ? s : []);
    } catch { setSerials([]); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setNewSerials(''); loadSerials(); }, [item]);

  const addSerials = async () => {
    const list = Array.from(new Set(newSerials.split(/[\s,;]+/).map(s => s.trim()).filter(s => s.length >= 3)));
    if (!list.length) return;
    setAdding(true);
    let ok = 0; const errors: string[] = [];
    for (const sn of list) {
      try { await stockService.createSerial(item.id, sn); ok++; } catch (e: any) { errors.push(`${sn} : ${e.message}`); }
    }
    setAdding(false); setNewSerials('');
    toast({ title: `${ok} numéro(s) de série ajouté(s)`, description: errors.slice(0, 3).join(' · ') || undefined, variant: errors.length ? 'error' : 'success' });
    loadSerials();
  };

  const loadTrace = async (serial: any) => {
    try {
      const ev: any = await api.get(`/stock-serials/${serial.id}/traceability`);
      setTrace({ serial, events: Array.isArray(ev?.movements) ? ev.movements : [] });
    } catch {
      setTrace({ serial, events: [] });
    }
  };

  if (!item) return null;
  const total = levels.reduce((s, l) => s + Number(l.quantity ?? 0), 0);

  return (
    <>
      <Modal open={!!item} onClose={onClose} title={`${item.reference} — ${item.designation}`} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-[#7a8f80]">Catégorie</p><p className="text-[#e8ede9]">{item.category === 'ASSET' ? 'Sérialisé' : 'Consommable'}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Famille</p><p className="text-[#e8ede9]">{item.family}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Qté totale</p><p className="text-[#e8ede9] font-bold">{total}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Seuil</p><p className="text-[#e8ede9]">{item.thresholdAlert ?? '—'}</p></div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide mb-2 flex items-center gap-1.5"><Warehouse size={13} /> Niveaux par emplacement</h4>
            {levels.length === 0 ? (
              <p className="text-xs text-[#7a8f80]/60">Aucun stock réparti — enregistrez une entrée.</p>
            ) : (
              <div className="space-y-1.5">
                {levels.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                    <span className="text-sm text-[#e8ede9]">{l.warehouse?.name ?? 'Emplacement'}</span>
                    <span className={'text-sm font-bold ' + (Number(l.quantity) <= (item.thresholdAlert ?? 0) ? 'text-[#C0392B]' : 'text-[#0f9d70]')}>{l.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {item.category === 'ASSET' && (
            <div>
              <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide mb-2 flex items-center gap-1.5"><Barcode size={13} /> Numéros de série ({serials.length})</h4>
              {canManage && (
                <div className="flex gap-2 mb-2">
                  <input value={newSerials} onChange={e => setNewSerials(e.target.value)} placeholder="Ajouter des n° de série (séparés par espace, virgule ou retour ligne)"
                    className="flex-1 h-9 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] placeholder:text-[#7a8f80]" />
                  <Button size="sm" disabled={adding || !newSerials.trim()} onClick={addSerials}>{adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter</Button>
                </div>
              )}
              {serials.length > 0 && <p className="text-[10px] text-[#7a8f80] mb-1.5">Un n° ajouté ici n'est dans aucun emplacement : enregistrez ensuite une « Entrée » pour le placer en stock.</p>}
              {serials.length === 0 ? (
                <p className="text-xs text-[#7a8f80]/60">Aucune série enregistrée.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {serials.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                      <div>
                        <p className="text-sm font-mono text-[#e8ede9]">{s.serialNumber}</p>
                        <p className="text-[10px] text-[#7a8f80]">{s.status}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[#0f9d70]" onClick={() => loadTrace(s)}>
                        <Link2 size={12} className="mr-1" /> Traçabilité
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Traçabilité d'une série */}
      <Modal open={!!trace} onClose={() => setTrace(null)} title={`Traçabilité — ${trace?.serial?.serialNumber ?? ''}`}>
        {trace && (
          <div className="space-y-2">
            {trace.events.length === 0 ? (
              <p className="text-sm text-[#7a8f80]">Aucun événement pour cette série.</p>
            ) : trace.events.map((ev: any, i: number) => {
              const meta = MOVEMENT_META[ev.type] ?? { label: ev.type, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
              return (
                <div key={ev.id ?? i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <span className="h-2 w-2 rounded-full bg-[#0f9d70]" />
                    {i < trace.events.length - 1 && <span className="h-8 w-px bg-[#1e2e25]" />}
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={meta.cls}>{meta.label}</Badge>
                      <span className="text-xs text-[#7a8f80]">{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                    </div>
                    <p className="text-xs text-[#e8ede9] mt-1">
                      {whNameOf(ev.fromWarehouseId, 'Entrée')} → {whNameOf(ev.toWarehouseId, 'Sortie du stock')}
                      {ev.cancelledAt && <span className="text-[#C0392B]"> (annulé)</span>}
                    </p>
                    {ev.note && <p className="text-xs text-[#7a8f80] italic">{ev.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
