'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Skeleton, Input, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { planningService } from '@/services';
import { Filter, Plus, Trash2, Loader2, Save, ArrowLeft, Info } from 'lucide-react';

const TARGET_LABELS: Record<string, Record<string, string>> = {
  planning: {
    dossierNumber: 'N° de dossier', client: 'Client', task: 'Tâche', zone: 'Zone',
    dateMission: 'Date mission', olt: 'OLT', produit: 'Produit', subcontractor: 'Sous-traitant (ST)',
  },
  affect: {
    dossierNumber: 'N° de dossier', team: 'Équipe', technicians: 'Techniciens',
    heureDebut: 'Heure début', heureFin: 'Heure fin',
  },
};

type Row = { sheetType: 'planning' | 'affect'; sourceColumnName: string; targetField: string };

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'planning' | 'affect'>('planning');
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const { data, loading } = useQuery(() => planningService.getMappings(), []);

  useEffect(() => {
    if (!data || hydrated) return;
    const flat: Row[] = [
      ...(data.planning ?? []).map((m: any) => ({ ...m, sheetType: 'planning' as const })),
      ...(data.affect ?? []).map((m: any) => ({ ...m, sheetType: 'affect' as const })),
    ];
    setRows(flat);
    setHydrated(true);
  }, [data, hydrated]);

  const saveMut = useMutation((all: Row[]) => planningService.updateMappings(all), {
    onSuccess: () => toast({ title: 'Mapping enregistré', variant: 'success' }),
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const current = rows.filter(r => r.sheetType === tab);
  const targets = Object.keys(TARGET_LABELS[tab]);

  const addRow = () => setRows(prev => [...prev, { sheetType: tab, sourceColumnName: '', targetField: targets[0] }]);
  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(prev => {
      const scoped = prev.filter(r => r.sheetType === tab);
      const globalIndex = prev.indexOf(scoped[i]);
      const next = [...prev];
      next[globalIndex] = { ...next[globalIndex], ...patch };
      return next;
    });
  };
  const removeRow = (i: number) => {
    setRows(prev => {
      const scoped = prev.filter(r => r.sheetType === tab);
      return prev.filter(r => r !== scoped[i]);
    });
  };
  const save = () => {
    const cleaned = rows.filter(r => r.sourceColumnName.trim().length > 0);
    if (cleaned.length === 0) { toast({ title: 'Aucune règle à enregistrer', variant: 'warning' }); return; }
    saveMut.mutate(cleaned);
  };

  const dirtyCount = rows.filter(r => r.sourceColumnName.trim().length > 0).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Filter size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Mapping des colonnes</h1>
            <p className="text-xs text-[#7a8f80]">Colonnes Excel SONATEL → champs VECTRACOM (mémorisé par tenant)</p>
          </div>
        </div>
        <Link href="/planning/import" className="text-sm text-[#0f9d70] hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Retour à l'import
        </Link>
      </div>

      <Tabs
        tabs={[
          { value: 'planning', label: 'Onglet PLANNING', count: current.length },
          { value: 'affect', label: 'Onglet AFFECT' },
        ]}
        active={tab}
        onChange={v => setTab(v as 'planning' | 'affect')}
      />

      <Card className="border-[#1e2e25] bg-[#111916] p-4 space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
          <Info size={14} className="text-[#0f9d70] mt-0.5 shrink-0" />
          <p className="text-xs text-[#7a8f80]">
            Règles appliquées à chaque import. Par défaut : Demande→N° dossier, Client→Client, Tache→Tâche, Zone→Zone, Date→Date mission{tab === 'planning' ? ', OLT→OLT, Produit→Produit, ST→Sous-traitant' : ' (affect : Equipe→Équipe, Techniciens→Techniciens, HeureDebut/HeureFin→horaires)'}.
          </p>
        </div>

        {loading && !hydrated ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : current.length === 0 ? (
          <p className="text-sm text-[#7a8f80] py-6 text-center">Aucune règle — le mapping par défaut SONATEL s'applique.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 px-1">
              <span className="text-[10px] font-medium text-[#7a8f80] uppercase tracking-wide">Colonne Excel (source)</span>
              <span className="text-[10px] font-medium text-[#7a8f80] uppercase tracking-wide">Champ VECTRACOM (cible)</span>
              <span />
            </div>
            {current.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 items-center">
                <Input
                  value={row.sourceColumnName} placeholder="ex. Demande"
                  onChange={e => updateRow(i, { sourceColumnName: e.target.value })}
                />
                <select
                  value={row.targetField}
                  onChange={e => updateRow(i, { targetField: e.target.value })}
                  className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
                >
                  {targets.map(t => <option key={t} value={t}>{TARGET_LABELS[tab][t]}</option>)}
                </select>
                <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => removeRow(i)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[#1e2e25]">
          <Button variant="secondary" size="sm" onClick={addRow}><Plus size={14} /> Ajouter une règle</Button>
          <Button size="sm" onClick={save} disabled={saveMut.loading || dirtyCount === 0}>
            {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer le mapping
          </Button>
        </div>
      </Card>

      <p className="text-xs text-[#7a8f80]/60">
        La cible « N° de dossier » est la clé d'idempotence : deux colonnes sources ne peuvent pas porter le même nom.
      </p>
    </div>
  );
}
