'use client';

import { Button, Input, Select } from '@/components/ui';
import { INVOICE_CATEGORIES } from '@/lib/invoice-meta';
import { Plus, Trash2 } from 'lucide-react';

export type DraftLine = { itemType: string; category: string; quantity: string; unitPrice: string; unit: string };

export const emptyLine = (): DraftLine => ({ itemType: '', category: 'AUTRE', quantity: '1', unitPrice: '', unit: '' });

export function linesValid(lines: DraftLine[]) {
  return lines.every(l => l.itemType.trim().length >= 2 && Number(l.quantity) > 0 && l.unitPrice !== '' && Number(l.unitPrice) >= 0);
}

export function toLinePayload(l: DraftLine) {
  return {
    itemType: l.itemType.trim(),
    category: l.category,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    ...(l.unit.trim() ? { unit: l.unit.trim() } : {}),
  };
}

export function LinesEditor({ lines, setLines }: { lines: DraftLine[]; setLines: (l: DraftLine[]) => void }) {
  const update = (i: number, patch: Partial<DraftLine>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_7rem_5rem_4rem_7rem_2rem] gap-2 text-[11px] text-[#7a8f80] px-1">
        <span>Désignation *</span><span>Catégorie</span><span>Qté *</span><span>Unité</span><span>PU (FCFA) *</span><span />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_7rem_5rem_4rem_7rem_2rem] gap-2 items-center">
          <Input value={l.itemType} onChange={e => update(i, { itemType: e.target.value })} placeholder="Prestation, fourniture…" />
          <Select value={l.category} onChange={e => update(i, { category: e.target.value })}>
            {INVOICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input type="number" min="0.001" step="0.001" value={l.quantity} onChange={e => update(i, { quantity: e.target.value })} />
          <Input value={l.unit} onChange={e => update(i, { unit: e.target.value })} placeholder="u" />
          <Input type="number" min="0" step="1" value={l.unitPrice} onChange={e => update(i, { unitPrice: e.target.value })} />
          <button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
            className="text-[#7a8f80] hover:text-[#C0392B] disabled:opacity-30" title="Retirer la ligne"><Trash2 size={15} /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => setLines([...lines, emptyLine()])}><Plus size={13} /> Ajouter une ligne</Button>
    </div>
  );
}
