'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useSessionUser } from '@/components/admin/TenantPicker';
import { priceItemsService } from '@/services';
import { ArrowLeft, Copy, CheckCircle2, Loader2, Plus, Search, Trash2, FileSpreadsheet, Save, X } from 'lucide-react';

const GRIDS: Record<string, string> = {
  BORDEREAU_3STB: 'Bordereau 3STB (travaux)',
  GRID_SOFATELCOM: 'Prestations SOFATELCOM',
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const { user } = useSessionUser();
  const isAdmin = !!user && ['admin', 'super_admin'].includes(user.role);
  const [grid, setGrid] = useState('BORDEREAU_3STB');
  const [version, setVersion] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ itemNumber: number; value: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [modal, setModal] = useState<'' | 'add' | 'duplicate' | 'activate'>('');

  const { data: versionsData, refetch: refetchVersions } = useQuery(() => priceItemsService.versions(), []);
  const versions = (Array.isArray(versionsData) ? versionsData : []).filter((v: any) => v.priceGrid === grid);
  const selected = versions.find((v: any) => v.version === version);

  useEffect(() => {
    if (!versions.length) return;
    if (!versions.some((v: any) => v.version === version)) {
      setVersion((versions.find((v: any) => v.current) ?? versions[0]).version);
    }
  }, [versionsData, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, refetch } = useQuery(
    () => (version ? priceItemsService.list({ priceGrid: grid, version }) : Promise.resolve([])),
    [grid, version],
  );
  const items = useMemo(() => {
    const all = Array.isArray(data) ? data : [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((p: any) => String(p.itemNumber) === q || [p.designation, p.category, p.subCategory].some(v => String(v ?? '').toLowerCase().includes(q))) : all;
  }, [data, search]);

  const refresh = () => { refetch(); refetchVersions(); };
  const updateMut = useMutation((itemNumber: number, body: Record<string, unknown>) => priceItemsService.update(itemNumber, version, grid, body), {
    onSuccess: () => { toast({ title: 'Prix mis à jour', variant: 'success' }); setEditing(null); refresh(); },
    onError: (e: any) => toast({ title: 'Modification refusée', description: e.message, variant: 'error' }),
  });
  const removeMut = useMutation((itemNumber: number) => priceItemsService.remove(itemNumber, version, grid), {
    onSuccess: () => { toast({ title: 'Item supprimé', variant: 'success' }); setRemoveTarget(null); refresh(); },
    onError: (e: any) => toast({ title: 'Suppression impossible', description: e.message, variant: 'error' }),
  });
  const activateMut = useMutation(() => priceItemsService.activateVersion(grid, version), {
    onSuccess: () => { toast({ title: `Version ${version} active`, description: 'Utilisée pour les prochaines factures générées', variant: 'success' }); setModal(''); refresh(); },
    onError: (e: any) => toast({ title: 'Activation impossible', description: e.message, variant: 'error' }),
  });

  const saveEdit = () => {
    if (!editing) return;
    const value = Number(editing.value);
    if (!(value >= 0)) return;
    updateMut.mutate(editing.itemNumber, { unitPrice: value });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/invoices" className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-2"><ArrowLeft size={15} /> Facturation</Link>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2"><FileSpreadsheet size={20} className="text-[#0f9d70]" /> Bordereau de prix</h1>
          <p className="text-sm text-[#7a8f80] mt-1">Prix unitaires utilisés à la génération des factures (version active la plus récente de chaque grille).</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal('add')} disabled={!version}><Plus size={14} /> Item</Button>
            <Button variant="outline" size="sm" onClick={() => setModal('duplicate')} disabled={!version}><Copy size={14} /> Nouvelle version</Button>
            {selected && !selected.current && (
              <Button size="sm" onClick={() => setModal('activate')}><CheckCircle2 size={14} /> Activer {version}</Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={grid} onChange={e => { setGrid(e.target.value); setVersion(''); }} className="w-60">
          {Object.entries(GRIDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={version} onChange={e => setVersion(e.target.value)} className="w-56">
          {versions.length === 0 && <option value="">Aucune version</option>}
          {versions.map((v: any) => (
            <option key={v.version} value={v.version}>Version {v.version} — {v.count} items{v.current ? ' (active)' : ''}</option>
          ))}
        </Select>
        {selected && (selected.current
          ? <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">Version active</Badge>
          : <Badge className="bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30">Version inactive — non utilisée pour facturer</Badge>)}
        <div className="relative flex-1 min-w-48 max-w-80 ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input type="text" placeholder="N°, désignation, catégorie…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
        </div>
      </div>

      {loading ? <Skeleton className="h-64" /> : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2e25]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80] w-16">N°</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Désignation</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Catégorie</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Unité</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#7a8f80]">PU (FCFA)</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-[#7a8f80]">Actif</th>
                  {isAdmin && <th className="px-2 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50">
                {items.map((p: any) => (
                  <tr key={p.id} className={'hover:bg-[#172019] ' + (p.isActive ? '' : 'opacity-60')}>
                    <td className="px-4 py-2 font-mono text-xs text-[#0f9d70]">{p.itemNumber}</td>
                    <td className="px-4 py-2 text-[#e8ede9]">{p.designation}</td>
                    <td className="px-4 py-2 text-xs text-[#7a8f80]">{p.category ?? '—'}{p.subCategory ? ` · ${p.subCategory}` : ''}</td>
                    <td className="px-4 py-2 text-[#7a8f80]">{p.unit}</td>
                    <td className="px-4 py-2 text-right">
                      {editing?.itemNumber === p.itemNumber ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus type="number" min="0" value={editing.value}
                            onChange={e => setEditing({ itemNumber: p.itemNumber, value: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                            className="w-28 h-8 px-2 rounded-md bg-[#0a0f0d] border border-[#0f9d70]/50 text-right text-sm text-[#e8ede9]" />
                          <button className="text-[#0f9d70]" onClick={saveEdit} disabled={updateMut.loading} title="Enregistrer"><Save size={14} /></button>
                          <button className="text-[#7a8f80]" onClick={() => setEditing(null)} title="Annuler"><X size={14} /></button>
                        </span>
                      ) : (
                        <button disabled={!isAdmin} onClick={() => setEditing({ itemNumber: p.itemNumber, value: String(Number(p.unitPrice)) })}
                          className={'font-semibold text-[#e8ede9] ' + (isAdmin ? 'hover:text-[#0f9d70] hover:underline decoration-dotted' : '')}
                          title={isAdmin ? 'Cliquer pour modifier' : undefined}>
                          {Number(p.unitPrice).toLocaleString('fr-FR')}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={!!p.isActive} disabled={!isAdmin || updateMut.loading}
                        onChange={e => updateMut.mutate(p.itemNumber, { isActive: e.target.checked })} />
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2 text-right">
                        <button className="text-[#7a8f80] hover:text-[#C0392B]" title="Supprimer" onClick={() => setRemoveTarget(p)}><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#7a8f80]">Aucun item</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal === 'add' && <AddItemModal grid={grid} version={version} onClose={() => setModal('')} onDone={() => { setModal(''); refresh(); }} />}
      {modal === 'duplicate' && (
        <DuplicateModal grid={grid} fromVersion={version} onClose={() => setModal('')}
          onDone={(v) => { setModal(''); refetchVersions(); setVersion(v); }} />
      )}
      <ConfirmDialog open={modal === 'activate'} onClose={() => setModal('')} title={`Activer la version ${version}`}
        message="Les autres versions de cette grille deviennent inactives. Les factures déjà générées ne changent pas ; les prochaines générations utiliseront ces prix."
        confirmText="Activer" onConfirm={() => activateMut.mutate()} />
      <ConfirmDialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} title={`Supprimer l’item ${removeTarget?.itemNumber ?? ''}`}
        message="Préférez décocher « Actif » pour conserver l’historique. Les factures existantes ne sont pas modifiées." confirmText="Supprimer" danger
        onConfirm={() => removeTarget && removeMut.mutate(removeTarget.itemNumber)} />
    </div>
  );
}

function AddItemModal({ grid, version, onClose, onDone }: { grid: string; version: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ itemNumber: '', designation: '', unit: 'U', unitPrice: '', category: '', subCategory: '' });
  const mut = useMutation(() => priceItemsService.create({
    itemNumber: Number(f.itemNumber), designation: f.designation.trim(), unit: f.unit.trim(), unitPrice: Number(f.unitPrice),
    ...(f.category.trim() ? { category: f.category.trim() } : {}),
    ...(f.subCategory.trim() ? { subCategory: f.subCategory.trim() } : {}),
    version, priceGrid: grid,
  }), {
    onSuccess: () => { toast({ title: 'Item ajouté', variant: 'success' }); onDone(); },
    onError: (e: any) => toast({ title: 'Ajout impossible', description: e.message, variant: 'error' }),
  });
  return (
    <Modal open onClose={onClose} title={`Nouvel item — ${GRIDS[grid] ?? grid} v${version}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-3 gap-3">
          <Input label="N° *" type="number" min="1" value={f.itemNumber} onChange={e => setF({ ...f, itemNumber: e.target.value })} required />
          <Input label="Unité *" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} required />
          <Input label="PU (FCFA) *" type="number" min="0" value={f.unitPrice} onChange={e => setF({ ...f, unitPrice: e.target.value })} required />
        </div>
        <Input label="Désignation *" value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} required minLength={3} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Catégorie" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
          <Input label="Sous-catégorie" value={f.subCategory} onChange={e => setF({ ...f, subCategory: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

function DuplicateModal({ grid, fromVersion, onClose, onDone }: { grid: string; fromVersion: string; onClose: () => void; onDone: (v: string) => void }) {
  const { toast } = useToast();
  const [toVersion, setToVersion] = useState(String(new Date().getFullYear() + (fromVersion === String(new Date().getFullYear()) ? 1 : 0)));
  const [pct, setPct] = useState('0');
  const mut = useMutation(() => priceItemsService.duplicateVersion({ priceGrid: grid, fromVersion, toVersion: toVersion.trim(), percentChange: Number(pct) || 0 }), {
    onSuccess: (r: any) => { toast({ title: `Version ${toVersion} créée`, description: `${r?.items ?? 0} items copiés (inactive)`, variant: 'success' }); onDone(toVersion.trim()); },
    onError: (e: any) => toast({ title: 'Duplication impossible', description: e.message, variant: 'error' }),
  });
  return (
    <Modal open onClose={onClose} title="Nouvelle version tarifaire">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <p className="text-sm text-[#7a8f80]">
          Copie la version <b className="text-[#e8ede9]">{fromVersion}</b> ({GRIDS[grid] ?? grid}). La nouvelle version reste inactive :
          ajustez les prix puis activez-la.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nom de la version *" value={toVersion} onChange={e => setToVersion(e.target.value)} required maxLength={20} />
          <Input label="Variation globale (%)" type="number" step="0.1" min="-90" max="500" value={pct} onChange={e => setPct(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !toVersion.trim()}>{mut.loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Créer</Button>
        </div>
      </form>
    </Modal>
  );
}
