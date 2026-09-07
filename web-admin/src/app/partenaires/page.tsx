'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, Modal, Input, Select, Textarea, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { partnersService, stockService } from '@/services';
import { Building2, Plus, Loader2, Edit, Grid3X3 } from 'lucide-react';

const PRICE_GRIDS = [
  { value: 'BORDEREAU_3STB', label: 'Bordereau 3STB' },
  { value: 'GRID_SOFATELCOM', label: 'Grille SOFATELCOM' },
];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [gridPreview, setGridPreview] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(() => partnersService.list(), []);
  const list = Array.isArray(data) ? data : [];

  const { data: priceItems } = useQuery(
    () => gridPreview ? stockService.listPriceItems({ priceGrid: gridPreview }) : Promise.resolve([]),
    [gridPreview],
  );
  const items = Array.isArray(priceItems) ? priceItems : (priceItems?.items ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <Building2 size={20} className="text-[#0f9d70]" /> Partenaires
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {list.length} partenaire(s) — grille tarifaire associée (3STB / SOFATELCOM)
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Nouveau partenaire</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916]">
          <EmptyState icon={<Building2 size={40} className="text-[#7a8f80]/50" />}
            title="Aucun partenaire"
            description="Ajoutez SOFATELCOM, 3STB… avec leur grille de prix."
            action={<Button onClick={() => setShowCreate(true)}><Plus size={15} /> Créer</Button>} />
        </Card>
      ) : (
        <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
          <div className="divide-y divide-[#1e2e25]/50">
            {list.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9] font-medium">{p.name}</p>
                    <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{p.code}</Badge>
                    <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{p.priceGrid}</Badge>
                    {p.exclusiveZone && <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{p.exclusiveZone}</Badge>}
                    {p.active === false && <Badge className="bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30">inactif</Badge>}
                  </div>
                  {p.description && <p className="text-[10px] text-[#7a8f80] mt-0.5 truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]"
                    title="Voir grille" onClick={() => setGridPreview(p.priceGrid)}>
                    <Grid3X3 size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditItem(p)}>
                    <Edit size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {gridPreview && (
        <Card className="border-[#1e2e25] bg-[#111916] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e8ede9]">Grille {gridPreview}</h2>
            <Button size="sm" variant="ghost" onClick={() => setGridPreview(null)}>Fermer</Button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-[#1e2e25]/40">
            {items.length === 0 ? (
              <p className="text-xs text-[#7a8f80] py-4 text-center">Aucun article pour cette grille (seed bordereau).</p>
            ) : items.slice(0, 40).map((it: any) => (
              <div key={it.id ?? it.itemNumber} className="py-2 flex justify-between gap-2 text-xs">
                <span className="text-[#e8ede9]">#{it.itemNumber} {it.designation ?? it.label}</span>
                <span className="text-[#7a8f80] shrink-0">{it.unitPrice != null ? `${Number(it.unitPrice).toLocaleString('fr-FR')} F` : '—'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <PartnerFormModal open={showCreate} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      <PartnerFormModal open={!!editItem} partner={editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); refetch(); }} />
    </div>
  );
}

function PartnerFormModal({ open, partner, onClose, onDone }: { open: boolean; partner?: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    code: '', name: '', priceGrid: 'BORDEREAU_3STB', description: '', exclusiveZone: '', active: true,
  });

  useEffect(() => {
    if (partner) {
      setF({
        code: partner.code ?? '',
        name: partner.name ?? '',
        priceGrid: partner.priceGrid ?? 'BORDEREAU_3STB',
        description: partner.description ?? '',
        exclusiveZone: partner.exclusiveZone ?? '',
        active: partner.active !== false,
      });
    } else if (open) {
      setF({ code: '', name: '', priceGrid: 'BORDEREAU_3STB', description: '', exclusiveZone: '', active: true });
    }
  }, [partner, open]);

  const mut = useMutation(
    () => partner
      ? partnersService.update(partner.id, {
          name: f.name,
          priceGrid: f.priceGrid,
          description: f.description || null,
          exclusiveZone: f.exclusiveZone || null,
          active: f.active,
        })
      : partnersService.create({
          code: f.code,
          name: f.name,
          priceGrid: f.priceGrid,
          description: f.description || undefined,
          exclusiveZone: f.exclusiveZone || undefined,
        }),
    {
      onSuccess: () => { toast({ title: partner ? 'Partenaire mis à jour' : 'Partenaire créé', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={partner ? `Modifier — ${partner.name}` : 'Nouveau partenaire'}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        {!partner && (
          <Input label="Code *" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required placeholder="SOFA" />
        )}
        <Input label="Nom *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="SOFATELCOM" />
        <Select label="Grille tarifaire *" value={f.priceGrid} onChange={(e) => setF({ ...f, priceGrid: e.target.value })}>
          {PRICE_GRIDS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </Select>
        <Input label="Zone exclusive" value={f.exclusiveZone} onChange={(e) => setF({ ...f, exclusiveZone: e.target.value })} placeholder="Mbour" />
        <Textarea label="Description" value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} rows={2} />
        {partner && (
          <label className="flex items-center gap-2 text-sm text-[#e8ede9]">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-[#0f9d70]" />
            Actif
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.name.trim() || (!partner && !f.code.trim())}>
            {mut.loading && <Loader2 size={14} className="animate-spin" />} {partner ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
