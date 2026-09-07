'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, Select, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { missionsService } from '@/services';
import {
  ArrowLeft, ClipboardList, Loader2, Plus, Trash2, Save, RotateCcw,
  ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';

type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'photos' | 'signature' | 'checklist';

type Field = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

type Step = {
  id: string;
  label: string;
  icon: string;
  blocking?: boolean;
  fields: Field[];
};

type Template = {
  typeName: string;
  label: string;
  description?: string | null;
  steps: Step[];
  requiredPhotos?: Array<{ type: string; label: string; count: number }>;
  isActive?: boolean;
  personalised?: boolean;
};

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Liste' },
  { value: 'photos', label: 'Photos' },
  { value: 'signature', label: 'Signature' },
  { value: 'checklist', label: 'Checklist' },
];

const ICONS = ['shield', 'map-pin', 'wrench', 'camera', 'package', 'check-circle', 'clipboard', 'user'];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const { data, loading, refetch } = useQuery(() => missionsService.templates(), []);
  const templates: Template[] = Array.isArray(data) ? data : [];
  const [selectedType, setSelectedType] = useState<string>('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [resetType, setResetType] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedType && templates.length) setSelectedType(templates[0].typeName);
  }, [templates, selectedType]);

  useEffect(() => {
    const t = templates.find((x) => x.typeName === selectedType);
    if (!t) { setDraft(null); return; }
    setDraft(JSON.parse(JSON.stringify(t)));
    const exp: Record<string, boolean> = {};
    (t.steps ?? []).forEach((s, i) => { exp[s.id] = i === 0; });
    setExpanded(exp);
  }, [selectedType, data]);

  const dirty = useMemo(() => {
    const orig = templates.find((x) => x.typeName === selectedType);
    if (!orig || !draft) return false;
    return JSON.stringify({
      label: orig.label, description: orig.description, steps: orig.steps, isActive: orig.isActive,
    }) !== JSON.stringify({
      label: draft.label, description: draft.description, steps: draft.steps, isActive: draft.isActive,
    });
  }, [templates, draft, selectedType]);

  const saveMut = useMutation(
    () => {
      if (!draft) throw new Error('Aucun template');
      return missionsService.upsertTemplate({
        typeName: draft.typeName,
        label: draft.label,
        description: draft.description ?? undefined,
        steps: draft.steps,
        requiredPhotos: draft.requiredPhotos,
        isActive: draft.isActive !== false,
      });
    },
    {
      onSuccess: () => {
        toast({ title: 'Formulaire enregistré', description: draft?.typeName, variant: 'success' });
        refetch();
      },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const resetMut = useMutation(
    (typeName: string) => missionsService.resetTemplate(typeName),
    {
      onSuccess: () => {
        toast({ title: 'Surcharge supprimée — défauts restaurés', variant: 'success' });
        setResetType(null);
        refetch();
      },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const updateStep = (stepId: string, patch: Partial<Step>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    });
  };

  const updateField = (stepId: string, fieldId: string, patch: Partial<Field>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s) =>
        s.id !== stepId
          ? s
          : { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) },
      ),
    });
  };

  const addStep = () => {
    if (!draft) return;
    const id = uid('step');
    setDraft({
      ...draft,
      steps: [...draft.steps, { id, label: 'Nouvelle étape', icon: 'clipboard', fields: [] }],
    });
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const removeStep = (stepId: string) => {
    if (!draft) return;
    setDraft({ ...draft, steps: draft.steps.filter((s) => s.id !== stepId) });
  };

  const addField = (stepId: string) => {
    if (!draft) return;
    const id = uid('field');
    setDraft({
      ...draft,
      steps: draft.steps.map((s) =>
        s.id !== stepId
          ? s
          : { ...s, fields: [...s.fields, { id, label: 'Nouveau champ', type: 'text', required: false }] },
      ),
    });
  };

  const removeField = (stepId: string, fieldId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      steps: draft.steps.map((s) =>
        s.id !== stepId ? s : { ...s, fields: s.fields.filter((f) => f.id !== fieldId) },
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/parametres" className="text-[#7a8f80] hover:text-[#0f9d70]">
            <ArrowLeft size={18} />
          </Link>
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><ClipboardList size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Formulaires missions</h1>
            <p className="text-xs text-[#7a8f80]">Types · étapes · champs dynamiques (saisie terrain)</p>
          </div>
        </div>
        <div className="flex gap-2">
          {draft?.personalised && (
            <Button variant="outline" size="sm" onClick={() => setResetType(draft.typeName)}>
              <RotateCcw size={14} /> Restaurer défauts
            </Button>
          )}
          <Button size="sm" disabled={!dirty || saveMut.loading} onClick={() => saveMut.mutate(undefined as any)}>
            {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid lg:grid-cols-[240px_1fr] gap-4">
          <Card className="border-[#1e2e25] bg-[#111916] p-2 h-fit max-h-[70vh] overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.typeName}
                onClick={() => setSelectedType(t.typeName)}
                className={
                  'w-full text-left px-2.5 py-2 rounded-md text-xs mb-0.5 transition-colors ' +
                  (selectedType === t.typeName
                    ? 'bg-[#0f9d70] text-white'
                    : 'text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#172019]')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.typeName}</span>
                  {t.personalised && (
                    <Badge className="bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30 text-[9px] px-1">perso</Badge>
                  )}
                </div>
                <p className={'truncate mt-0.5 ' + (selectedType === t.typeName ? 'text-white/70' : 'text-[#7a8f80]/70')}>
                  {t.label}
                </p>
              </button>
            ))}
          </Card>

          {!draft ? (
            <Card className="border-[#1e2e25] bg-[#111916] p-10 text-center text-sm text-[#7a8f80]">
              Sélectionnez un type de mission
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="border-[#1e2e25] bg-[#111916] p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Input
                    label="Libellé"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                  <label className="flex items-center justify-between gap-3 h-10 mt-6 px-3 rounded-lg border border-[#1e2e25] bg-[#0a0f0d]">
                    <span className="text-xs text-[#e8ede9]">Actif</span>
                    <input
                      type="checkbox"
                      className="accent-[#0f9d70]"
                      checked={draft.isActive !== false}
                      onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    />
                  </label>
                </div>
                <Input
                  label="Description"
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
                <p className="text-[11px] text-[#7a8f80]">
                  {(draft.steps ?? []).length} étape(s) ·{' '}
                  {(draft.steps ?? []).reduce((n, s) => n + (s.fields?.length ?? 0), 0)} champ(s)
                  {dirty ? ' · modifications non enregistrées' : ''}
                </p>
              </Card>

              {(draft.steps ?? []).map((step, si) => {
                const open = expanded[step.id] !== false;
                return (
                  <Card key={step.id} className="border-[#1e2e25] bg-[#111916] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e2e25] bg-[#0a0f0d]/40">
                      <GripVertical size={14} className="text-[#7a8f80]/50" />
                      <button
                        type="button"
                        className="text-[#7a8f80] hover:text-[#e8ede9]"
                        onClick={() => setExpanded((e) => ({ ...e, [step.id]: !open }))}
                      >
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <span className="text-[10px] font-mono text-[#0f9d70]">#{si + 1}</span>
                      <input
                        className="flex-1 bg-transparent text-sm font-medium text-[#e8ede9] outline-none"
                        value={step.label}
                        onChange={(e) => updateStep(step.id, { label: e.target.value })}
                      />
                      <label className="flex items-center gap-1 text-[10px] text-[#7a8f80]">
                        <input
                          type="checkbox"
                          className="accent-[#0f9d70]"
                          checked={!!step.blocking}
                          onChange={(e) => updateStep(step.id, { blocking: e.target.checked })}
                        />
                        bloquante
                      </label>
                      <Select
                        value={step.icon}
                        onChange={(e) => updateStep(step.id, { icon: e.target.value })}
                        className="h-7 w-28 text-xs"
                      >
                        {ICONS.map((ic) => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#C0392B]" onClick={() => removeStep(step.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>

                    {open && (
                      <div className="p-3 space-y-2">
                        {(step.fields ?? []).map((field) => (
                          <div key={field.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2.5 space-y-2">
                            <div className="grid sm:grid-cols-[1fr_140px_auto_auto] gap-2 items-end">
                              <Input
                                label="Libellé champ"
                                value={field.label}
                                onChange={(e) => updateField(step.id, field.id, { label: e.target.value })}
                              />
                              <Select
                                label="Type"
                                value={field.type}
                                onChange={(e) => updateField(step.id, field.id, { type: e.target.value as FieldType })}
                              >
                                {FIELD_TYPES.map((ft) => (
                                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                              </Select>
                              <label className="flex items-center gap-1.5 h-10 px-2 text-xs text-[#7a8f80]">
                                <input
                                  type="checkbox"
                                  className="accent-[#0f9d70]"
                                  checked={!!field.required}
                                  onChange={(e) => updateField(step.id, field.id, { required: e.target.checked })}
                                />
                                Requis
                              </label>
                              <Button size="sm" variant="ghost" className="h-10 w-10 p-0 text-[#C0392B]" onClick={() => removeField(step.id, field.id)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                            {(field.type === 'select' || field.type === 'checklist') && (
                              <Input
                                label="Options (virgules)"
                                value={(field.options ?? []).join(', ')}
                                onChange={(e) =>
                                  updateField(step.id, field.id, {
                                    options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                                  })
                                }
                              />
                            )}
                            <p className="text-[10px] font-mono text-[#7a8f80]/60">id: {field.id}</p>
                          </div>
                        ))}
                        <Button size="sm" variant="secondary" onClick={() => addField(step.id)}>
                          <Plus size={14} /> Champ
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}

              <Button variant="outline" onClick={addStep}>
                <Plus size={15} /> Ajouter une étape
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!resetType}
        onClose={() => setResetType(null)}
        onConfirm={() => resetType && resetMut.mutate(resetType)}
        title="Restaurer les défauts ?"
        message="La surcharge tenant pour ce type sera supprimée. Les étapes standard reviendront."
        confirmText="Restaurer"
        danger
      />
    </div>
  );
}
