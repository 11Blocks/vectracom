'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { complianceService } from '@/services';
import { ListChecks, Plus, Loader2, Trash2, Pencil, Check, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MISSION_TYPES = ['INSTALLATION', 'SURVEY', 'SURVEY_OSM', 'SAV', 'INFRA', 'OSM', 'GC', 'PLANTATION', 'DEVOIEMENT', 'DEPLOIEMENT', 'DENSIFICATION'];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<any | null>(null); // null = liste, {} = nouveau
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(() => complianceService.listChecklists(), []);
  const checklists = Array.isArray(data) ? data : [];

  const deleteMut = useMutation((id: string) => complianceService.deleteChecklist(id), {
    onSuccess: () => { toast({ title: 'Checklist supprimée', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ListChecks size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Checklists de conformité</h1>
            <p className="text-xs text-[#7a8f80]">Paramétrables par type de mission — jamais codées en dur</p>
          </div>
        </div>
        {!editing && <Button onClick={() => setEditing({ missionType: 'INSTALLATION', items: [{ label: '', required: true }] })}><Plus size={15} /> Nouvelle checklist</Button>}
      </div>

      {editing !== null ? (
        <ChecklistEditor
          checklist={editing}
          onBack={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch(); }}
        />
      ) : loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : checklists.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <ListChecks size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-4">Aucune checklist — créez la première (ex. « Checklist SONATEL FTTH »)</p>
          <Button onClick={() => setEditing({ missionType: 'INSTALLATION', items: [{ label: '', required: true }] })}><Plus size={15} /> Nouvelle checklist</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {checklists.map((c: any) => (
            <Card key={c.id} className="border-[#1e2e25] bg-[#111916] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30">{c.missionType}</Badge>
                    <span className="text-xs text-[#7a8f80]">{(c.items ?? []).length} item(s) · {(c.items ?? []).filter((i: any) => i.required).length} obligatoire(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(c.items ?? []).slice(0, 6).map((item: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-[#1e2e25] bg-[#0a0f0d] px-2 py-0.5 text-xs text-[#e8ede9]">
                        {item.required ? <Check size={10} className="text-[#0f9d70]" /> : <X size={10} className="text-[#7a8f80]" />}
                        {item.label}
                      </span>
                    ))}
                    {(c.items ?? []).length > 6 && <span className="text-xs text-[#7a8f80] self-center">+{(c.items ?? []).length - 6}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="secondary" className="h-8 px-2 text-xs" onClick={() => setEditing(c)}><Pencil size={13} /> Éditer</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(c.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer la checklist"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function ChecklistEditor({ checklist, onBack, onSaved }: {
  checklist: any; onBack: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const isNew = !checklist.id;
  const [missionType, setMissionType] = useState(checklist.missionType ?? 'INSTALLATION');
  const [items, setItems] = useState<any[]>(
    (checklist.items ?? []).length ? checklist.items : [{ label: '', required: true }]
  );

  const saveMut = useMutation(
    (d: any) => isNew ? complianceService.createChecklist(d) : complianceService.updateChecklist(checklist.id, d.items),
    {
      onSuccess: () => { toast({ title: 'Checklist enregistrée', variant: 'success' }); onSaved(); },
      onError: (e: any) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
    },
  );

  const update = (i: number, patch: any) => setItems(prev => prev.map((x, j) => j === i ? { ...x, ...patch } : x));
  const valid = items.filter(i => i.label.trim().length >= 2).length === items.length && items.length > 0;

  const submit = () => {
    const payload = { missionType, items: items.map(i => ({ label: i.label.trim(), required: !!i.required })) };
    saveMut.mutate(payload);
  };

  return (
    <Card className="border-[#1e2e25] bg-[#111916] p-4 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9]">
        <ArrowLeft size={14} /> Retour à la liste
      </button>

      <div>
        <p className="text-xs text-[#7a8f80] mb-1.5">Type de mission *</p>
        {isNew ? (
          <div className="flex flex-wrap gap-1.5">
            {MISSION_TYPES.map(t => (
              <button key={t} onClick={() => setMissionType(t)}
                className={'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ' + (missionType === t ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
                {t}
              </button>
            ))}
          </div>
        ) : (
          <Badge className="bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30">{missionType}</Badge>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-[#7a8f80] uppercase tracking-wide">Items de la checklist</p>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => update(i, { required: !item.required })}
              title={item.required ? 'Obligatoire' : 'Optionnel'}
              className={'h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 transition-all ' + (item.required ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80]')}>
              {item.required ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
            </button>
            <Input value={item.label} onChange={e => update(i, { label: e.target.value })} placeholder="ex. CNI du technicien" />
            <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-[#7a8f80] hover:text-[#C0392B] shrink-0"
              onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setItems(prev => [...prev, { label: '', required: true }])}>
          <Plus size={13} /> Ajouter un item
        </Button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#1e2e25]">
        <p className="text-xs text-[#7a8f80]">{items.length} item(s), {items.filter(i => i.required).length} obligatoire(s)</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack}>Annuler</Button>
          <Button onClick={submit} disabled={saveMut.loading || !valid}>
            {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}
