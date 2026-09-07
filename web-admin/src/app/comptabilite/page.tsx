'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, StatCard, Input, Select, Textarea, ConfirmDialog, AiBlock, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { accountingService, aiService, techniciansService, vehiclesService, cashBoxService } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import {
  Plus, Search, Trash2, Loader2, Receipt, Camera, Sparkles, Check, X,
  HardHat, Package, TruckIcon, MoreHorizontal, CalendarDays, Wand2, FileImage, Edit,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'main_oeuvre', label: 'Main d’œuvre', icon: HardHat, color: '#0f9d70' },
  { value: 'materiel', label: 'Matériel', icon: Package, color: '#5b8def' },
  { value: 'transport', label: 'Transport', icon: TruckIcon, color: '#f5a623' },
  { value: 'divers', label: 'Divers', icon: MoreHorizontal, color: '#7a8f80' },
] as const;
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

function fmtFCFA(n: any) {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString('fr-FR') + ' FCFA';
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function currentMonth() { return new Date().toISOString().slice(0, 7); }

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [viewTab, setViewTab] = useState<'depenses' | 'caisse' | 'matiere'>('depenses');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editExpense, setEditExpense] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: expenses, loading, refetch } = useQuery(
    () => accountingService.listExpenses(categoryFilter ? { category: categoryFilter } : undefined),
    [categoryFilter],
  );
  const { data: summary, refetch: refetchSummary } = useQuery(
    () => accountingService.summary(month), [month],
  );
  const { data: technicians } = useQuery(() => techniciansService.list(), []);
  const { data: vehicles } = useQuery(() => vehiclesService.list(), []);
  const techs = Array.isArray(technicians) ? technicians : [];
  const vehiclesList = Array.isArray(vehicles) ? vehicles : [];

  const deleteMut = useMutation((id: string) => accountingService.deleteExpense(id), {
    onSuccess: () => { toast({ title: 'Dépense supprimée', variant: 'success' }); setDeleteId(null); refetch(); refetchSummary(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const list = (Array.isArray(expenses) ? expenses : []).filter((x: any) =>
    !search || [x.description, x.category, x.amount].some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())),
  );

  const lines = summary?.lines ?? [];
  const total = summary?.total ?? 0;
  const techName = (id?: string | null) => techs.find((t: any) => t.id === id)?.fullName ?? null;
  const vehicleName = (id?: string | null) => {
    const v: any = vehiclesList.find((x: any) => x.id === id);
    return v ? (v.plate ?? v.name ?? null) : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Receipt size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Comptabilité</h1>
            <p className="text-xs text-[#7a8f80]">Dépenses opérationnelles — saisie terrain en 5 secondes</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Nouvelle dépense</Button>
      </div>

      {/* Onglets P8 : Dépenses | Caisse | Matière */}
      <div className="flex gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1 w-fit">
        {[
          { v: 'depenses', label: 'Dépenses & reçus IA' },
          { v: 'caisse', label: 'Caisse par rubrique' },
          { v: 'matiere', label: 'Comptabilité matière' },
        ].map(t => (
          <button key={t.v} onClick={() => setViewTab(t.v as any)}
            className={'px-3 py-1.5 text-xs font-medium rounded-md transition-all ' + (viewTab === t.v ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
            {t.label}
          </button>
        ))}
      </div>

      {viewTab === 'caisse' && <CashBoxTab month={month} />}
      {viewTab === 'matiere' && <MaterialTab month={month} />}

      {viewTab === 'depenses' && (
      <>
      {/* Synthèse mensuelle par catégorie */}
      <Card className="border-[#1e2e25] bg-[#111916] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
            <CalendarDays size={16} className="text-[#0f9d70]" /> Synthèse mensuelle
          </h3>
          <input
            type="month" value={month} onChange={e => { setMonth(e.target.value); }}
            className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {CATEGORIES.map(cat => {
            const line = lines.find((l: any) => l.category === cat.value);
            const catTotal = line?.total ?? 0;
            const pct = total > 0 ? Math.round((catTotal / total) * 100) : 0;
            const Icon = cat.icon;
            return (
              <div key={cat.value} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: cat.color }} />
                  <span className="text-xs text-[#7a8f80]">{cat.label}</span>
                </div>
                <p className="text-base font-bold text-[#e8ede9]">{fmtFCFA(catTotal)}</p>
                <p className="text-[10px] text-[#7a8f80]/70 mt-0.5">{line?.count ?? 0} dépense(s) · {pct}%</p>
                <div className="mt-2 h-1 rounded-full bg-[#1e2e25] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: cat.color }} />
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-[#0f9d70]/30 bg-[#0f9d70]/[0.06] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Receipt size={14} className="text-[#0f9d70]" />
              <span className="text-xs text-[#0f9d70]">Total {month}</span>
            </div>
            <p className="text-lg font-bold text-[#0f9d70]">{fmtFCFA(total)}</p>
          </div>
        </div>
      </Card>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input
            type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
        </div>
        <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-44">
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </div>

      {/* Table des dépenses */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Receipt size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucune dépense enregistrée</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Catégorie</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Liens</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-[#172019] transition-colors">
                  <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(exp.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-[#1a2420] text-[#e8ede9] border-[#1e2e25]">{CAT_LABEL[exp.category] ?? exp.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#e8ede9] whitespace-nowrap">{fmtFCFA(exp.amount)}</td>
                  <td className="px-4 py-3 text-[#7a8f80] max-w-56 truncate" title={exp.description ?? ''}>
                    {exp.receiptPhotoUrl ? <FileImage size={13} className="inline mr-1 text-[#7a8f80]" /> : null}
                    {exp.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[#7a8f80] text-xs space-x-1 whitespace-nowrap">
                    {techName(exp.technicianId) && <span className="text-[#0f9d70]">{techName(exp.technicianId)}</span>}
                    {vehicleName(exp.vehicleId) && <span className="text-[#f5a623]">{vehicleName(exp.vehicleId)}</span>}
                    {!techName(exp.technicianId) && !vehicleName(exp.vehicleId) && <span className="text-[#7a8f80]/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {exp.aiExtracted
                      ? <Badge className="bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30"><Sparkles size={11} className="mr-1" /> IA</Badge>
                      : <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">Manuelle</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditExpense(exp)} title="Modifier">
                        <Edit size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteId(exp.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateExpenseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        techs={techs}
        vehicles={vehiclesList}
        onCreated={() => { refetch(); refetchSummary(); }}
      />

      <EditExpenseModal
        expense={editExpense}
        onClose={() => setEditExpense(null)}
        techs={techs}
        vehicles={vehiclesList}
        onDone={() => { setEditExpense(null); refetch(); refetchSummary(); }}
      />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer la dépense"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
      </>
    )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  MODAL CRÉATION — avec photo reçu + extraction IA
// ═══════════════════════════════════════════════════════════
function CreateExpenseModal({ open, onClose, techs, vehicles, onCreated }: {
  open: boolean; onClose: () => void; techs: any[]; vehicles: any[]; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({
    category: 'transport', amount: '', description: '', technicianId: '', vehicleId: '', receiptPhotoUrl: '',
  });
  const [extraction, setExtraction] = useState<any | null>(null);

  const extractMut = useMutation((photoUrl: string) => aiService.extractReceipt(photoUrl), {
    onSuccess: (data: any) => setExtraction(data),
    onError: (e: any) => toast({ title: 'Extraction impossible', description: e.message, variant: 'error' }),
  });

  const createMut = useMutation((data: any) => accountingService.createExpense(data), {
    onSuccess: () => {
      toast({ title: 'Dépense enregistrée', variant: 'success' });
      setForm({ category: 'transport', amount: '', description: '', technicianId: '', vehicleId: '', receiptPhotoUrl: '' });
      setExtraction(null);
      onClose(); onCreated();
    },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const applyExtraction = () => {
    if (!extraction) return;
    setForm(prev => ({
      ...prev,
      amount: extraction.amount ?? prev.amount,
      category: extraction.category ?? prev.category,
      receiptPhotoUrl: extraction.photoUrl ?? prev.receiptPhotoUrl,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      category: form.category,
      amount: Number(form.amount),
      description: form.description || undefined,
      receiptPhotoUrl: form.receiptPhotoUrl || undefined,
      technicianId: form.technicianId || undefined,
      vehicleId: form.vehicleId || undefined,
    };
    if (extraction && Number(form.amount) === extraction.amount && form.category === extraction.category) {
      payload.aiExtracted = true;
    }
    createMut.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle dépense" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {/* Étape 1 : photo du reçu */}
        <div className="rounded-lg border border-dashed border-[#1e2e25] bg-[#0a0f0d] p-4 space-y-3">
          <p className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide flex items-center gap-1.5">
            <Camera size={13} /> Photo du reçu (optionnel — saisie en 5 s)
          </p>
          <FileDropzone
            category="receipts"
            value={form.receiptPhotoUrl}
            onChange={url => { setForm(prev => ({ ...prev, receiptPhotoUrl: url })); setExtraction(null); }}
            label="Uploader le reçu"
            accept="image/*"
          />
          <Input
            label="URL du reçu (optionnel)"
            value={form.receiptPhotoUrl}
            onChange={e => { setForm(prev => ({ ...prev, receiptPhotoUrl: e.target.value })); setExtraction(null); }}
            placeholder="https://… ou /uploads/…"
          />
          {form.receiptPhotoUrl && (
            <Button type="button" size="sm" variant="ai" onClick={() => extractMut.mutate(form.receiptPhotoUrl)} disabled={extractMut.loading}>
              {extractMut.loading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Extraire via IA
            </Button>
          )}
        </div>

        {/* Proposition IA — bloc ambre, jamais imposée */}
        {extraction && (
          <AiBlock title="Proposition IA — à valider">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] text-[#f5a623]/70">Montant détecté</p>
                <p className="text-lg font-bold text-[#f5a623]">{extraction.amount !== null ? fmtFCFA(extraction.amount) : 'Non détecté'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#f5a623]/70">Catégorie</p>
                <p className="text-sm font-semibold text-[#f5a623]">{CAT_LABEL[extraction.category] ?? extraction.category}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#f5a623]/70">Confiance</p>
                <p className="text-sm font-semibold text-[#f5a623]">{Math.round((extraction.confidence ?? 0) * 100)}%</p>
              </div>
              {extraction.date && (
                <div>
                  <p className="text-[10px] text-[#f5a623]/70">Date</p>
                  <p className="text-sm text-[#f5a623]">{extraction.date}</p>
                </div>
              )}
              <div className="flex-1" />
              <Button type="button" size="sm" variant="ai" onClick={applyExtraction}>
                <Check size={13} /> Utiliser ces valeurs
              </Button>
              <Button type="button" size="sm" variant="ghost" className="text-[#7a8f80]" onClick={() => setExtraction(null)}>
                <X size={13} /> Ignorer
              </Button>
            </div>
          </AiBlock>
        )}

        {/* Champs principaux */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie *" value={String(form.category ?? '')} onChange={e => setForm({ ...form, category: e.target.value })} required>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Montant (FCFA) *" type="number" min={0} step="1" value={String(form.amount ?? '')}
            onChange={e => setForm({ ...form, amount: e.target.value })} required placeholder="15000" />
        </div>
        <Textarea label="Description" value={String(form.description ?? '')} onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="Carburant camionnette DK-1234-B…" rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Technicien" value={String(form.technicianId ?? '')} onChange={e => setForm({ ...form, technicianId: e.target.value })}>
            <option value="">— Aucun —</option>
            {techs.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
          <Select label="Véhicule" value={String(form.vehicleId ?? '')} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
            <option value="">— Aucun —</option>
            {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.plate ?? v.immatriculation ?? v.name ?? v.id}</option>)}
          </Select>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={createMut.loading || !form.amount}>
            {createMut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditExpenseModal({ expense, onClose, techs, vehicles, onDone }: {
  expense: any | null; onClose: () => void; techs: any[]; vehicles: any[]; onDone: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({
    category: 'divers', amount: '', description: '', technicianId: '', vehicleId: '', receiptPhotoUrl: '',
  });

  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category ?? 'divers',
        amount: expense.amount ?? '',
        description: expense.description ?? '',
        technicianId: expense.technicianId ?? '',
        vehicleId: expense.vehicleId ?? '',
        receiptPhotoUrl: expense.receiptPhotoUrl ?? '',
      });
    }
  }, [expense]);

  const updateMut = useMutation((data: any) => accountingService.updateExpense(expense.id, data), {
    onSuccess: () => { toast({ title: 'Dépense mise à jour', variant: 'success' }); onDone(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  if (!expense) return null;

  return (
    <Modal open={!!expense} onClose={onClose} title="Modifier la dépense" size="lg">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        updateMut.mutate({
          category: form.category,
          amount: Number(form.amount),
          description: form.description || undefined,
          receiptPhotoUrl: form.receiptPhotoUrl || undefined,
          technicianId: form.technicianId || null,
          vehicleId: form.vehicleId || null,
        });
      }}>
        <FileDropzone
          category="receipts"
          value={form.receiptPhotoUrl}
          onChange={url => setForm({ ...form, receiptPhotoUrl: url })}
          label="Photo du reçu"
          accept="image/*"
        />
        <Input label="URL du reçu (optionnel)" value={form.receiptPhotoUrl ?? ''} onChange={e => setForm({ ...form, receiptPhotoUrl: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie *" value={String(form.category ?? '')} onChange={e => setForm({ ...form, category: e.target.value })} required>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Montant (FCFA) *" type="number" min={0} step="1" value={String(form.amount ?? '')}
            onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <Textarea label="Description" value={String(form.description ?? '')} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Technicien" value={String(form.technicianId ?? '')} onChange={e => setForm({ ...form, technicianId: e.target.value })}>
            <option value="">— Aucun —</option>
            {techs.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
          <Select label="Véhicule" value={String(form.vehicleId ?? '')} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
            <option value="">— Aucun —</option>
            {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.plate ?? v.immatriculation ?? v.name ?? v.id}</option>)}
          </Select>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={updateMut.loading || !form.amount}>
            {updateMut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}


/* ═════════════════ CAISSE PAR RUBRIQUE (P8) ═════════════════ */
const RUBRIQUES = [
  { value: 'carburant', label: 'Carburant' },
  { value: 'outils_rechange', label: 'Outils de rechange' },
  { value: 'depannage_vehicule', label: 'Dépannage véhicules' },
  { value: 'salaire_journalier', label: 'Salaires journaliers' },
  { value: 'pret_equipe', label: 'Prêt équipe' },
  { value: 'main_oeuvre', label: 'Main d\'œuvre' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'transport', label: 'Transport' },
  { value: 'divers', label: 'Divers' },
];

function CashBoxTab({ month }: { month: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const { data: sum, loading } = useQuery(() => cashBoxService.summary(month), [month]);
  const { data: entries, refetch } = useQuery(() => cashBoxService.list(month), [month]);
  const entryList = Array.isArray(entries) ? entries : [];

  const repayMut = useMutation(
    ({ id, amount }: { id: string; amount: number }) => cashBoxService.repay(id, amount),
    {
      onSuccess: () => { toast({ title: 'Remboursement enregistré', variant: 'success' }); refetch(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const rubriqueLabel = (r: string) => RUBRIQUES.find(x => x.value === r)?.label ?? r;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 mr-4">
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Total caisse</p>
            <p className="text-lg font-bold text-[#e8ede9] tabular-nums">{(sum?.grandTotal ?? 0).toLocaleString('fr-FR')} F</p>
          </div>
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Saisi manuellement</p>
            <p className="text-lg font-bold text-[#0f9d70] tabular-nums">{(sum?.manualTotal ?? 0).toLocaleString('fr-FR')} F</p>
          </div>
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Auto (véhicules + salaires + dépenses)</p>
            <p className="text-lg font-bold text-[#f5a623] tabular-nums">{(sum?.automaticTotal ?? 0).toLocaleString('fr-FR')} F</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus size={15} /> Saisir</Button>
      </div>

      {loading ? <Skeleton className="h-32" /> : (
        <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 overflow-hidden">
          {(sum?.byRubrique ?? []).map((r: any) => (
            <div key={r.rubrique} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-[#e8ede9]">{rubriqueLabel(r.rubrique)}</span>
              <span className="text-sm font-semibold text-[#e8ede9] tabular-nums">{r.total.toLocaleString('fr-FR')} F</span>
            </div>
          ))}
          {(sum?.byRubrique ?? []).length === 0 && <p className="p-4 text-xs text-[#7a8f80]/70 text-center">Aucune opération sur la période.</p>}
        </div>
      )}

      {/* Lignes saisies (prêts avec remboursement) */}
      <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 overflow-hidden">
        {entryList.length === 0 && <p className="p-4 text-xs text-[#7a8f80]/70 text-center">Aucune ligne saisie.</p>}
        {entryList.map((e: any) => {
          const repaid = Number(e.repaidAmount);
          const total = Number(e.amount);
          const isLoan = e.rubrique === 'pret_equipe';
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-[#e8ede9]">
                  {rubriqueLabel(e.rubrique)} — {Number(e.amount).toLocaleString('fr-FR')} F
                  <span className="text-[10px] text-[#7a8f80] ml-2">{e.type}{e.beneficiary ? ` · ${e.beneficiary}` : ''}</span>
                </p>
                {isLoan && repaid > 0 && (
                  <p className="text-[10px] text-[#0f9d70]">remboursé {repaid.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')} F ({Math.round((repaid / total) * 100)} %)</p>
                )}
              </div>
              {isLoan && repaid < total && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => {
                  const v = window.prompt('Montant du remboursement (FCFA) :', '20000');
                  if (v) repayMut.mutate({ id: e.id, amount: Number(v) });
                }}>
                  Rembourser
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <AddCashEntryModal open={showAdd} month={month} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refetch(); }} />
    </div>
  );
}

function AddCashEntryModal({ open, month, onClose, onDone }: { open: boolean; month: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ type: 'appro', rubrique: 'carburant', amount: '', beneficiary: '', note: '' });

  const mut = useMutation(
    () => cashBoxService.create({
      type: f.type,
      rubrique: f.rubrique,
      amount: Number(f.amount),
      period: month,
      beneficiary: f.beneficiary || undefined,
      note: f.note || undefined,
    }),
    {
      onSuccess: () => { toast({ title: 'Ligne de caisse enregistrée', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open={open} onClose={onClose} title={`Caisse — ${month}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type *" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            <option value="appro">Approvisionnement</option>
            <option value="depense">Dépense</option>
            <option value="remboursement_pret">Remboursement prêt</option>
          </Select>
          <Select label="Rubrique *" value={f.rubrique} onChange={e => setF({ ...f, rubrique: e.target.value })}>
            {RUBRIQUES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <Input label="Montant (FCFA) *" type="number" min="1" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} required placeholder="150000" />
        <Input label="Bénéficiaire" value={f.beneficiary} onChange={e => setF({ ...f, beneficiary: e.target.value })} placeholder="Caisse Mbour / Équipe Alpha…" />
        <Textarea label="Note" rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.amount}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════════ COMPTABILITÉ MATIÈRE (P8) ═════════════════ */
function MaterialTab({ month }: { month: string }) {
  const { data, loading } = useQuery(() => cashBoxService.material(month), [month]);

  if (loading) return <Skeleton className="h-48" />;
  const byType = (data?.byType ?? []) as any[];
  const consos = (data?.consommations ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Mouvements</p>
          <p className="text-lg font-bold text-[#e8ede9]">{data?.movementsCount ?? 0}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center col-span-2">
          <p className="text-[10px] text-[#7a8f80] mb-1">Consommations valorisées (bordereau 2025)</p>
          <p className="text-lg font-bold text-[#D9822B] tabular-nums">{(data?.consommationsValue ?? 0).toLocaleString('fr-FR')} F</p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25] text-center">
          <p className="text-[10px] text-[#7a8f80] mb-1">Articles consommés</p>
          <p className="text-lg font-bold text-[#e8ede9]">{consos.length}</p>
        </div>
      </div>

      {byType.length > 0 && (
        <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50">
          {byType.map((t: any) => (
            <div key={t.type} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-[#e8ede9] capitalize">{t.type.replace('_', ' ')} ({t.count})</span>
              <span className="text-sm text-[#e8ede9] tabular-nums">{t.value.toLocaleString('fr-FR')} F</span>
            </div>
          ))}
        </div>
      )}

      {consos.length > 0 && (
        <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-[#e8ede9] bg-[#111916]">Consommations par article</p>
          {consos.map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-[#e8ede9] truncate">{c.designation}</p>
                <p className="text-[10px] text-[#7a8f80]">{c.reference} · {c.qty} × {c.unitPrice.toLocaleString('fr-FR')} F</p>
              </div>
              <span className="text-sm font-semibold text-[#e8ede9] tabular-nums">{c.value.toLocaleString('fr-FR')} F</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
