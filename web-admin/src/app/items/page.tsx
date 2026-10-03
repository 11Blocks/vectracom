'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { itemsService } from '@/services';
import { Layers, Loader2, Plus, Pencil, Trash2, Users, X } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  CHEF: 'Chef d’équipe',
  BINOME: 'Binôme',
  STAGIAIRE: 'Stagiaire',
  ACCOMPAGNANT: 'Accompagnant',
  JOURNALIER: 'Journalier',
  CHEF_TIREUR: 'Chef tireur',
  CHEF_RACCORDEUR: 'Chef raccordeur',
};
const ROLE_ORDER = ['CHEF', 'BINOME', 'STAGIAIRE', 'ACCOMPAGNANT', 'CHEF_TIREUR', 'CHEF_RACCORDEUR', 'JOURNALIER'];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, loading, refetch } = useQuery(() => itemsService.list(), []);
  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const saveMut = useMutation((d: any) => itemsService.update(editing?.id, d), {
    onSuccess: () => { toast({ title: 'Item mis à jour', variant: 'success' }); setEditing(null); refetch(); },
    onError: (e: any) => toast({ title: 'Modification impossible', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Layers size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Items (domaines métier)</h1>
            <p className="text-xs text-[#7a8f80]">Composition type d'équipe par domaine — FTTH, INFRA, GC, Déploiement…</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Nouvel item</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : items.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState icon={<Layers size={40} className="text-[#7a8f80]/50" />} title="Aucun item" description="Seedez les 6 domaines métier (FTTH, INFRA, PP_GC, EXT_DENSIF, DEPLOIEMENT, BTS)." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((it: any) => {
            const comp = (it.teamComposition ?? []).slice().sort((a: any, b: any) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
            const total = comp.reduce((s: number, c: any) => s + Number(c.count), 0);
            return (
              <Card key={it.id} className="p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#0f9d70]/15 text-[#0f9d70] border border-[#0f9d70]/30">{it.code}</span>
                    {!it.active && <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">inactif</Badge>}
                  </div>
                  <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Éditer" onClick={() => setEditing(it)}><Pencil size={15} /></button>
                </div>
                <p className="text-sm font-semibold text-[#e8ede9] mt-2 leading-snug">{it.label}</p>
                {(it.missionTypes ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(it.missionTypes ?? []).map((mt: string) => (
                      <span key={mt} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2420] text-[#7a8f80] border border-[#1e2e25]">{mt}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-[#1e2e25]/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-[#7a8f80] flex items-center gap-1"><Users size={11} /> Composition type</p>
                    <span className="text-[10px] text-[#0f9d70] font-semibold">{total} agent(s)</span>
                  </div>
                  {comp.length === 0 ? (
                    <p className="text-xs text-[#7a8f80]/60">Aucune composition définie</p>
                  ) : (
                    <div className="space-y-1">
                      {comp.map((c: any) => (
                        <div key={c.role} className="flex items-center justify-between text-xs">
                          <span className="text-[#7a8f80]">{ROLE_LABELS[c.role] ?? c.role}</span>
                          <span className="font-semibold text-[#e8ede9] tabular-nums">×{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ItemModal initial={editing} onClose={() => setEditing(null)}
          onSubmit={(d) => saveMut.mutate(d)} loading={saveMut.loading} />
      )}
      {showCreate && (
        <ItemModal onClose={() => setShowCreate(false)} loading={false} createMode
          onSubmit={(d) => { itemsService.create(d).then(() => { setShowCreate(false); refetch(); toast({ title: 'Item créé', variant: 'success' }); }).catch((e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' })); }} />
      )}
    </div>
  );
}

function ItemModal({ initial, onClose, onSubmit, loading, createMode }: {
  initial?: any; onClose: () => void; onSubmit: (d: any) => void; loading: boolean; createMode?: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [comp, setComp] = useState<any[]>(initial?.teamComposition ?? [{ role: 'CHEF', count: 1 }]);

  const addRow = () => setComp((p) => [...p, { role: 'BINOME', count: 1 }]);
  const rmRow = (i: number) => setComp((p) => p.filter((_, j) => j !== i));
  const setRow = (i: number, k: string, v: any) => setComp((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <Modal open onClose={onClose} title={createMode ? 'Nouvel item' : 'Éditer la composition'} size="lg">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const cleaned = comp.filter((c: any) => c.role && Number(c.count) > 0).map((c: any) => ({ role: c.role, count: Number(c.count) }));
        onSubmit({ ...(createMode ? { code, label } : { label: label.trim() }), teamComposition: cleaned });
      }}>
        {createMode && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code *" value={code} onChange={(e) => setCode(e.target.value)} placeholder="FTTH" required />
            <Input label="Libellé *" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
        )}
        {!createMode && (
          <Input label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
        )}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider">Composition de l'équipe</p>
            <Button type="button" size="sm" variant="outline" onClick={addRow}><Plus size={13} /> Rôle</Button>
          </div>
          <div className="space-y-2">
            {comp.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={c.role} onChange={(e) => setRow(i, 'role', e.target.value)} className="flex-1">
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
                <Input type="number" min="1" value={String(c.count)} onChange={(e) => setRow(i, 'count', e.target.value)} className="w-24" />
                <button type="button" className="text-[#7a8f80] hover:text-[#C0392B] p-1" onClick={() => rmRow(i)} title="Retirer"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || (createMode && (!code.trim() || !label.trim()))}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
