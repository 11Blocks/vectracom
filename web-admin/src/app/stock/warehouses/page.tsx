'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, TableCell, Input, Select, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { stockService } from '@/services';
import { Plus, Search, Edit, Trash2, Loader2, Package, Building2 } from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Record<string, any>>({ name: '', type: 'CENTRAL', zone: '' });

  const { data: items, loading, refetch } = useQuery(() => stockService.listWarehouses(), []);

  const createMut = useMutation(
    (data: any) => stockService.createWarehouse(data),
    {
      onSuccess: () => { toast({ title: 'Emplacement créé', variant: 'success' }); setShowCreate(false); setForm({ name: '', type: 'CENTRAL', zone: '' }); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const updateMut = useMutation(
    (data: any) => stockService.updateWarehouse(editItem.id, data),
    {
      onSuccess: () => { toast({ title: 'Emplacement mis à jour', variant: 'success' }); setEditItem(null); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const deleteMut = useMutation(
    (id: string) => stockService.deleteWarehouse(id),
    {
      onSuccess: () => { toast({ title: 'Emplacement supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
      onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
    },
  );

  const list = (Array.isArray(items) ? items : []).filter((item: any) => {
    if (!search) return true;
    return JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Building2 size={20} /></span>
          <h1 className="text-xl font-bold text-[#e8ede9]">Emplacements</h1>
          <span className="text-sm text-[#7a8f80]">({list.length})</span>
        </div>
        <Button onClick={() => { setForm({ name: '', type: 'CENTRAL', zone: '' }); setShowCreate(true); }}>
          <Plus size={16} /> Créer
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
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Package size={40} className="text-[#7a8f80]/50 mb-3" />
            <p className="text-sm font-medium text-[#7a8f80]">Aucun emplacement</p>
            <p className="text-xs text-[#7a8f80]/60 mt-1">Créez votre premier dépôt, véhicule ou site</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}><Plus size={16} /> Créer</Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Zone</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((item: any) => (
                <tr key={item.id} className="hover:bg-[#172019] transition-colors">
                  <TableCell>{item.name ?? '—'}</TableCell>
                  <TableCell><Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{item.type ?? '—'}</Badge></TableCell>
                  <TableCell>{item.zone ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]"
                        onClick={() => setEditItem(item)} title="Modifier">
                        <Edit size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]"
                        onClick={() => setDeleteId(item.id)} title="Supprimer">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer un emplacement">
        <form onSubmit={e => { e.preventDefault(); createMut.mutate(form); }} className="space-y-3">
          <Input label="Nom *" type="text" value={String(form.name ?? '')} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Dépôt Central Dakar" />
          <Select label="Type" value={String(form.type ?? '')} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="CENTRAL">CENTRAL</option>
            <option value="VEHICLE">VEHICLE</option>
            <option value="SITE">SITE</option>
          </Select>
          <Input label="Zone" type="text" value={String(form.zone ?? '')} onChange={e => setForm({ ...form, zone: e.target.value })} placeholder="Dakar" />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button type="submit" disabled={createMut.loading}>{createMut.loading && <Loader2 size={14} className="animate-spin" />} Créer</Button>
          </div>
        </form>
      </Modal>

      <EditWarehouseModal
        item={editItem}
        onClose={() => setEditItem(null)}
        loading={updateMut.loading}
        onSubmit={data => updateMut.mutate(data)}
      />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmer la suppression"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function EditWarehouseModal({ item, onClose, loading, onSubmit }: {
  item: any | null; onClose: () => void; loading: boolean; onSubmit: (d: any) => void;
}) {
  const [form, setForm] = useState({ name: '', type: 'CENTRAL', zone: '' });

  useEffect(() => {
    if (item) setForm({ name: item.name ?? '', type: item.type ?? 'CENTRAL', zone: item.zone ?? '' });
  }, [item]);

  if (!item) return null;

  return (
    <Modal open={!!item} onClose={onClose} title={`Modifier — ${item.name}`}>
      <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
        <Input label="Nom *" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="CENTRAL">CENTRAL</option>
          <option value="VEHICLE">VEHICLE</option>
          <option value="SITE">SITE</option>
        </Select>
        <Input label="Zone" type="text" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
