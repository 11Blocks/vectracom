'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Modal, Card, Skeleton, StatCard, Input, Select, Textarea, ConfirmDialog, AiBlock, useToast, Pager, usePagination } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { accountingService, aiService, techniciansService, vehiclesService, cashBoxService } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import { downloadCsv } from '@/lib/csv';
import {
  Plus, Search, Trash2, Loader2, Receipt, Camera, Sparkles, Check, X, Download, Ban, Wallet,
  HardHat, Package, TruckIcon, MoreHorizontal, CalendarDays, Wand2, FileImage, Edit, Fuel, Wrench, Users, Coins,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'main_oeuvre', label: 'Main d’œuvre', icon: HardHat, color: '#0f9d70' },
  { value: 'materiel', label: 'Matériel', icon: Package, color: '#5b8def' },
  { value: 'transport', label: 'Transport', icon: TruckIcon, color: '#f5a623' },
  { value: 'carburant', label: 'Carburant', icon: Fuel, color: '#D9822B' },
  { value: 'outils_rechange', label: 'Outils de rechange', icon: Wrench, color: '#8e7cc3' },
  { value: 'depannage_vehicule', label: 'Dépannage véhicule', icon: TruckIcon, color: '#C0392B' },
  { value: 'salaire_journalier', label: 'Salaire journalier', icon: Users, color: '#27ae60' },
  { value: 'pret_equipe', label: 'Prêt équipe', icon: Coins, color: '#e67e22' },
  { value: 'divers', label: 'Divers', icon: MoreHorizontal, color: '#7a8f80' },
] as const;
const MAIN_CATEGORIES = ['main_oeuvre', 'materiel', 'transport', 'carburant'];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
function todayIso() { return new Date().toISOString().slice(0, 10); }
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

  const q = useDebounced(search.trim());
  const pager = usePagination(50, `${month}|${categoryFilter}|${q}`);
  const filters = { month, category: categoryFilter || undefined, search: q || undefined };
  const { data: expenses, loading, refetch } = useQuery(
    () => accountingService.pageExpenses({ ...filters, ...pager.params }),
    [categoryFilter, month, q, pager.offset, pager.limit],
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

  const list: any[] = expenses?.items ?? [];
  const expenseCount = expenses?.total ?? 0;
  const exportCsv = async () => {
    try {
      const all: any[] = (await accountingService.pageExpenses({ ...filters, limit: '5000' })).items;
      downloadCsv(`depenses-${month}.csv`, [
        ['Date', 'Catégorie', 'Montant', 'Description', 'Technicien', 'Véhicule', 'Source'],
        ...all.map((x: any) => [x.expenseDate ?? '', CAT_LABEL[x.category] ?? x.category, Number(x.amount), x.description ?? '', techName(x.technicianId) ?? '', vehicleName(x.vehicleId) ?? '', x.aiExtracted ? 'IA' : 'Manuelle']),
      ]);
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    }
  };

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
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#7a8f80] flex items-center gap-1.5"><CalendarDays size={14} /> Mois</label>
          <input
            type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }}
            className="h-9 px-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
          />
          <Button onClick={() => setShowCreate(true)}><Plus size={16} /> Nouvelle dépense</Button>
        </div>
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
            <CalendarDays size={16} className="text-[#0f9d70]" /> Synthèse {month} (date des reçus)
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {CATEGORIES.filter(cat => MAIN_CATEGORIES.includes(cat.value) || lines.some((l: any) => l.category === cat.value && l.total > 0)).map(cat => {
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
        <span className="text-xs text-[#7a8f80]">
          {expenseCount.toLocaleString('fr-FR')} dépense(s){!categoryFilter && !q ? ` · ${fmtFCFA(total)}` : ''}
        </span>
        <Button variant="secondary" size="sm" className="ml-auto" disabled={expenseCount === 0} onClick={exportCsv}><Download size={14} /> CSV</Button>
      </div>

      {/* Table des dépenses */}
      {loading && !expenses ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Receipt size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">{categoryFilter || q ? 'Aucune dépense ne correspond aux filtres' : `Aucune dépense sur ${month}`}</p>
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
                  <td className="px-4 py-3 text-[#7a8f80] whitespace-nowrap">{fmtDate(exp.expenseDate ?? exp.createdAt)}</td>
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
          <Pager className="border-t border-[#1e2e25] bg-[#111916]" total={expenseCount} offset={pager.offset} limit={pager.limit}
            onChange={pager.setOffset} onLimitChange={pager.setLimit} />
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
    category: 'transport', amount: '', expenseDate: todayIso(), description: '', technicianId: '', vehicleId: '', receiptPhotoUrl: '',
  });
  const [extraction, setExtraction] = useState<any | null>(null);

  const extractMut = useMutation((photoUrl: string) => aiService.extractReceipt(photoUrl), {
    onSuccess: (data: any) => setExtraction(data),
    onError: (e: any) => toast({ title: 'Extraction impossible', description: e.message, variant: 'error' }),
  });

  const createMut = useMutation((data: any) => accountingService.createExpense(data), {
    onSuccess: () => {
      toast({ title: 'Dépense enregistrée', variant: 'success' });
      setForm({ category: 'transport', amount: '', expenseDate: todayIso(), description: '', technicianId: '', vehicleId: '', receiptPhotoUrl: '' });
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
      expenseDate: /^\d{4}-\d{2}-\d{2}/.test(String(extraction.date ?? '')) && String(extraction.date).slice(0, 10) <= todayIso()
        ? String(extraction.date).slice(0, 10) : prev.expenseDate,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      category: form.category,
      amount: Number(form.amount),
      expenseDate: form.expenseDate || undefined,
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
          <Input label="Montant (FCFA) *" type="number" min={1} step="1" value={String(form.amount ?? '')}
            onChange={e => setForm({ ...form, amount: e.target.value })} required placeholder="15000" />
          <Input label="Date du reçu *" type="date" max={todayIso()} value={String(form.expenseDate ?? '')}
            onChange={e => setForm({ ...form, expenseDate: e.target.value })} required />
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
        amount: expense.amount != null ? String(Number(expense.amount)) : '',
        expenseDate: expense.expenseDate ?? todayIso(),
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
          expenseDate: form.expenseDate || undefined,
          description: form.description || null,
          receiptPhotoUrl: form.receiptPhotoUrl || null,
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
          <Input label="Montant (FCFA) *" type="number" min={1} step="1" value={String(form.amount ?? '')}
            onChange={e => setForm({ ...form, amount: e.target.value })} required />
          <Input label="Date du reçu *" type="date" max={todayIso()} value={String(form.expenseDate ?? '')}
            onChange={e => setForm({ ...form, expenseDate: e.target.value })} required />
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

const CASH_TYPE_META: Record<string, { label: string; cls: string; sign: 1 | -1 }> = {
  appro: { label: 'Appro', cls: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30', sign: 1 },
  remboursement_pret: { label: 'Remboursement', cls: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30', sign: 1 },
  depense: { label: 'Sortie', cls: 'bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30', sign: -1 },
};

function CashBoxTab({ month }: { month: string }) {
  const [modal, setModal] = useState<'' | 'add'>('');
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [cancelEntry, setCancelEntry] = useState<any | null>(null);
  const [repayEntry, setRepayEntry] = useState<any | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const role = (() => { try { return JSON.parse(localStorage.getItem('vectracom_user') || 'null')?.role; } catch { return null; } })();
  const canWrite = role === 'admin' || role === 'super_admin';

  const { data: sum, loading, refetch: refetchSum } = useQuery(() => cashBoxService.summary(month), [month]);
  const { data: entries, refetch: refetchEntries } = useQuery(() => cashBoxService.list(month), [month]);
  const allEntries = Array.isArray(entries) ? entries : [];
  const entryList = allEntries.filter((e: any) => showCancelled || !e.cancelledAt);
  const refetch = () => { refetchSum(); refetchEntries(); };
  const rubriqueLabel = (r: string) => r === 'approvisionnement' ? 'Approvisionnement' : (RUBRIQUES.find(x => x.value === r)?.label ?? r);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25]">
            <p className="text-[10px] text-[#7a8f80] mb-1">Solde d’ouverture</p>
            <p className="text-lg font-bold text-[#e8ede9] tabular-nums">{fmtFCFA(sum?.openingBalance ?? 0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25]">
            <p className="text-[10px] text-[#7a8f80] mb-1">Entrées (appro + remboursements)</p>
            <p className="text-lg font-bold text-[#0f9d70] tabular-nums">+{fmtFCFA(sum?.inflows?.total ?? 0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25]">
            <p className="text-[10px] text-[#7a8f80] mb-1">Sorties de caisse</p>
            <p className="text-lg font-bold text-[#D9822B] tabular-nums">−{fmtFCFA(sum?.cashSpending ?? 0)}</p>
          </div>
          <div className={'p-3 rounded-lg border ' + ((sum?.closingBalance ?? 0) < 0 ? 'bg-[#C0392B]/[0.08] border-[#C0392B]/40' : 'bg-[#0f9d70]/[0.06] border-[#0f9d70]/30')}>
            <p className="text-[10px] text-[#7a8f80] mb-1">Solde de clôture</p>
            <p className={'text-lg font-bold tabular-nums ' + ((sum?.closingBalance ?? 0) < 0 ? 'text-[#C0392B]' : 'text-[#0f9d70]')}>{fmtFCFA(sum?.closingBalance ?? 0)}</p>
          </div>
        </div>
        {canWrite && <Button onClick={() => setModal('add')}><Plus size={15} /> Saisir</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25]">
          <p className="text-[10px] text-[#7a8f80] mb-1">Coût complet du mois (sorties caisse + sources automatiques)</p>
          <p className="text-base font-bold text-[#e8ede9] tabular-nums">{fmtFCFA(sum?.totalCost ?? 0)}</p>
          <p className="text-[10px] text-[#7a8f80]">
            auto : carburant véhicules {fmtFCFA(sum?.sources?.fuelCost ?? 0)} · réparations {fmtFCFA(sum?.sources?.repairCost ?? 0)} · journaliers {fmtFCFA(sum?.sources?.journalierWages ?? 0)} · dépenses saisies {fmtFCFA(sum?.sources?.expensesTotal ?? 0)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#111916] border border-[#1e2e25]">
          <p className="text-[10px] text-[#7a8f80] mb-1">Prêts d’équipe en cours (tous mois)</p>
          <p className="text-base font-bold text-[#e67e22] tabular-nums">{fmtFCFA(sum?.loans?.outstanding ?? 0)}</p>
          <p className="text-[10px] text-[#7a8f80]">{sum?.loans?.count ?? 0} prêt(s) non soldé(s)</p>
        </div>
      </div>

      {loading ? <Skeleton className="h-32" /> : (
        <div className="rounded-lg border border-[#1e2e25] overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-2 text-[10px] uppercase tracking-wide text-[#7a8f80] bg-[#111916]">
            <span>Rubrique</span><span className="text-right">Caisse</span><span className="text-right">Automatique</span><span className="text-right">Total</span>
          </div>
          {(sum?.byRubrique ?? []).map((r: any) => (
            <div key={r.rubrique} className="grid grid-cols-4 px-4 py-2 border-t border-[#1e2e25]/50 text-sm">
              <span className="text-[#e8ede9]">{rubriqueLabel(r.rubrique)}</span>
              <span className="text-right text-[#7a8f80] tabular-nums">{r.cash ? fmtFCFA(r.cash) : '—'}</span>
              <span className="text-right text-[#7a8f80] tabular-nums">{r.automatic ? fmtFCFA(r.automatic) : '—'}</span>
              <span className="text-right font-semibold text-[#e8ede9] tabular-nums">{fmtFCFA(r.total)}</span>
            </div>
          ))}
          {(sum?.byRubrique ?? []).length === 0 && <p className="p-4 text-xs text-[#7a8f80]/70 text-center border-t border-[#1e2e25]/50">Aucune dépense sur la période.</p>}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#e8ede9]">Mouvements de caisse ({entryList.length})</h3>
        <label className="text-xs text-[#7a8f80] flex items-center gap-1.5">
          <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> Afficher les lignes annulées
        </label>
      </div>
      <div className="rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50 overflow-hidden">
        {entryList.length === 0 && <p className="p-4 text-xs text-[#7a8f80]/70 text-center">Aucun mouvement.</p>}
        {entryList.map((e: any) => {
          const meta = CASH_TYPE_META[e.type] ?? { label: e.type, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', sign: -1 };
          const repaid = Number(e.repaidAmount);
          const total = Number(e.amount);
          const isLoan = e.rubrique === 'pret_equipe' && e.type === 'depense';
          const cancelled = !!e.cancelledAt;
          return (
            <div key={e.id} className={'flex items-center justify-between gap-3 px-4 py-2.5 ' + (cancelled ? 'opacity-50' : '')}>
              <div className="min-w-0 flex items-center gap-3">
                <span className="text-xs text-[#7a8f80] w-20 shrink-0">{fmtDate(e.entryDate)}</span>
                <Badge className={meta.cls}>{meta.label}</Badge>
                <div className="min-w-0">
                  <p className={'text-sm text-[#e8ede9] truncate ' + (cancelled ? 'line-through' : '')}>
                    {rubriqueLabel(e.rubrique)}{e.beneficiary ? ` · ${e.beneficiary}` : ''}
                  </p>
                  {e.note && <p className="text-[10px] text-[#7a8f80] truncate">{e.note}</p>}
                  {isLoan && !cancelled && (
                    <p className="text-[10px] text-[#5b8def]">remboursé {fmtFCFA(repaid)} / {fmtFCFA(total)} ({total ? Math.round((repaid / total) * 100) : 0} %)</p>
                  )}
                  {cancelled && <p className="text-[10px] text-[#C0392B]">Annulée : {e.cancelReason}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={'text-sm font-semibold tabular-nums ' + (meta.sign > 0 ? 'text-[#0f9d70]' : 'text-[#D9822B]')}>
                  {meta.sign > 0 ? '+' : '−'}{fmtFCFA(total)}
                </span>
                {canWrite && !cancelled && (
                  <>
                    {isLoan && repaid < total && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRepayEntry(e)}><Wallet size={12} /> Rembourser</Button>
                    )}
                    {e.type !== 'remboursement_pret' && (
                      <button className="p-1 text-[#7a8f80] hover:text-[#0f9d70]" title="Modifier" onClick={() => setEditEntry(e)}><Edit size={13} /></button>
                    )}
                    <button className="p-1 text-[#7a8f80] hover:text-[#C0392B]" title="Annuler la ligne" onClick={() => setCancelEntry(e)}><Ban size={13} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal === 'add' && <CashEntryModal onClose={() => setModal('')} onDone={() => { setModal(''); refetch(); }} />}
      {editEntry && <CashEntryModal entry={editEntry} onClose={() => setEditEntry(null)} onDone={() => { setEditEntry(null); refetch(); }} />}
      {cancelEntry && <CancelCashModal entry={cancelEntry} onClose={() => setCancelEntry(null)} onDone={() => { setCancelEntry(null); refetch(); }} />}
      {repayEntry && <RepayModal entry={repayEntry} onClose={() => setRepayEntry(null)} onDone={() => { setRepayEntry(null); refetch(); }} />}
    </div>
  );
}

function CashEntryModal({ entry, onClose, onDone }: { entry?: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    type: entry?.type ?? 'appro',
    rubrique: entry?.rubrique && entry.rubrique !== 'approvisionnement' ? entry.rubrique : 'carburant',
    amount: entry ? String(Number(entry.amount)) : '',
    entryDate: entry?.entryDate ?? todayIso(),
    beneficiary: entry?.beneficiary ?? '',
    note: entry?.note ?? '',
  });
  const mut = useMutation(
    () => entry
      ? cashBoxService.update(entry.id, {
        ...(f.type === 'depense' ? { rubrique: f.rubrique } : {}),
        amount: Number(f.amount), entryDate: f.entryDate,
        beneficiary: f.beneficiary.trim() || null, note: f.note.trim() || null,
      })
      : cashBoxService.create({
        type: f.type,
        ...(f.type === 'depense' ? { rubrique: f.rubrique } : {}),
        amount: Number(f.amount), entryDate: f.entryDate,
        beneficiary: f.beneficiary.trim() || undefined, note: f.note.trim() || undefined,
      }),
    {
      onSuccess: () => { toast({ title: entry ? 'Ligne modifiée' : 'Ligne de caisse enregistrée', variant: 'success' }); onDone(); },
      onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
    },
  );

  return (
    <Modal open onClose={onClose} title={entry ? 'Modifier la ligne de caisse' : 'Nouveau mouvement de caisse'}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type *" value={f.type} onChange={e => setF({ ...f, type: e.target.value })} disabled={!!entry}>
            <option value="appro">Approvisionnement (entrée)</option>
            <option value="depense">Dépense / prêt (sortie)</option>
          </Select>
          {f.type === 'depense' ? (
            <Select label="Rubrique *" value={f.rubrique} onChange={e => setF({ ...f, rubrique: e.target.value })}>
              {RUBRIQUES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          ) : <div />}
          <Input label="Montant (FCFA) *" type="number" min="1" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} required placeholder="150000" />
          <Input label="Date *" type="date" max={todayIso()} value={f.entryDate} onChange={e => setF({ ...f, entryDate: e.target.value })} required />
        </div>
        <Input label={f.rubrique === 'pret_equipe' && f.type === 'depense' ? 'Équipe / bénéficiaire du prêt *' : 'Bénéficiaire / origine'}
          value={f.beneficiary} onChange={e => setF({ ...f, beneficiary: e.target.value })}
          required={f.rubrique === 'pret_equipe' && f.type === 'depense'} placeholder="Caisse Mbour / Équipe Alpha…" />
        <Textarea label="Note" rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !(Number(f.amount) > 0)}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function CancelCashModal({ entry, onClose, onDone }: { entry: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const mut = useMutation(() => cashBoxService.cancel(entry.id, reason.trim()), {
    onSuccess: () => { toast({ title: 'Ligne annulée', variant: 'success' }); onDone(); },
    onError: (e: Error) => toast({ title: 'Annulation impossible', description: e.message, variant: 'error' }),
  });
  return (
    <Modal open onClose={onClose} title="Annuler la ligne de caisse">
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <p className="text-sm text-[#7a8f80]">
          {fmtFCFA(entry.amount)} du {fmtDate(entry.entryDate)} — la ligne reste visible (barrée) mais sort des soldes.
          {entry.type === 'remboursement_pret' ? ' Le montant est rendu au prêt correspondant.' : ''}
        </p>
        <Input label="Motif *" value={reason} onChange={e => setReason(e.target.value)} required minLength={3} placeholder="Saisie en double, erreur de montant…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Retour</Button>
          <Button type="submit" variant="danger" disabled={mut.loading || reason.trim().length < 3}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Annuler la ligne</Button>
        </div>
      </form>
    </Modal>
  );
}

function RepayModal({ entry, onClose, onDone }: { entry: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const remaining = Number(entry.amount) - Number(entry.repaidAmount);
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayIso());
  const mut = useMutation(() => cashBoxService.repay(entry.id, Number(amount), date), {
    onSuccess: () => { toast({ title: 'Remboursement enregistré', variant: 'success' }); onDone(); },
    onError: (e: Error) => toast({ title: 'Remboursement refusé', description: e.message, variant: 'error' }),
  });
  return (
    <Modal open onClose={onClose} title={`Remboursement — ${entry.beneficiary ?? 'prêt équipe'}`}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); mut.mutate(); }}>
        <p className="text-sm text-[#7a8f80]">Reste à rembourser : <b className="text-[#e67e22]">{fmtFCFA(remaining)}</b> sur {fmtFCFA(entry.amount)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Montant (FCFA) *" type="number" min="1" max={remaining} value={amount} onChange={e => setAmount(e.target.value)} required />
          <Input label="Date *" type="date" max={todayIso()} value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !(Number(amount) > 0) || Number(amount) > remaining}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
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
          <p className="text-[10px] text-[#7a8f80] mb-1">Consommations valorisées (bordereau {data?.priceVersion ?? '—'})</p>
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
