'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { payrollService, techniciansService } from '@/services';
import { Wallet, Loader2, Pencil, CheckCircle2, Users } from 'lucide-react';

const fmt = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
const fmtF = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR') + ' F');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [editing, setEditing] = useState<any | null>(null);

  const { data, loading, refetch } = useQuery(() => payrollService.list(period), [period]);
  const { data: techsData } = useQuery(() => techniciansService.list(), []);
  const techs = useMemo(() => (Array.isArray(techsData) ? techsData : []), [techsData]);

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0);
  const totalChef = rows.reduce((s: number, r: any) => s + Number(r.chefShare ?? 0), 0);
  const totalBinome = rows.reduce((s: number, r: any) => s + Number(r.binomeShare ?? 0), 0);

  const upsertMut = useMutation((d: any) => payrollService.upsert(d), {
    onSuccess: () => { toast({ title: 'Feuille de paie enregistrée', variant: 'success' }); setEditing(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const validateMut = useMutation((id: string) => payrollService.validate(id), {
    onSuccess: () => { toast({ title: 'Feuille validée', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Wallet size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Rémunération équipes</h1>
            <p className="text-xs text-[#7a8f80]">Répartition du chiffre entre chef et binôme (65/35 par défaut, flexible)</p>
          </div>
        </div>
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Chiffre total</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{fmtF(totalRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Part chefs (65 %)</p>
          <p className="text-2xl font-bold text-[#0f9d70]">{fmtF(totalChef)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Part binômes (35 %)</p>
          <p className="text-2xl font-bold text-[#f5a623]">{fmtF(totalBinome)}</p>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState icon={<Users size={40} className="text-[#7a8f80]/50" />} title="Aucune équipe" description="Créez des équipes pour générer leur feuille de paie." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Missions validées</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Chiffre</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Chef</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#7a8f80]">Binôme</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-2 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {rows.map((r: any) => (
                <tr key={r.teamId} className="hover:bg-[#172019]/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#e8ede9]">{r.teamName}</p>
                    <p className="text-[10px] text-[#7a8f80]">répartition {r.repartitionChefPct} / {100 - r.repartitionChefPct}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-[#e8ede9] tabular-nums">{r.missionsValidees}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#e8ede9] tabular-nums">{fmtF(r.revenue)}</td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-[#0f9d70] tabular-nums">{fmtF(r.chefShare)}</p>
                    <p className="text-[10px] text-[#7a8f80]">{r.chefName ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-[#f5a623] tabular-nums">{fmtF(r.binomeShare)}</p>
                    <p className="text-[10px] text-[#7a8f80]">{r.binomeName ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.payrollId
                      ? <Badge className={r.status === 'validee' ? 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' : 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30'}>{r.status === 'validee' ? 'Validée' : 'Brouillon'}</Badge>
                      : <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">Non saisie</Badge>}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="text-[#7a8f80] hover:text-[#e8ede9] p-1" title="Saisir / modifier" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                      {r.payrollId && r.status !== 'validee' && (
                        <button className="text-[#0f9d70] p-1" title="Valider" onClick={() => validateMut.mutate(r.payrollId)}><CheckCircle2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PayrollModal row={editing} period={period} techs={techs}
          onClose={() => setEditing(null)} onSubmit={(d) => upsertMut.mutate(d)} loading={upsertMut.loading} />
      )}
    </div>
  );
}

function PayrollModal({ row, period, techs, onClose, onSubmit, loading }: {
  row: any; period: string; techs: any[]; onClose: () => void; onSubmit: (d: any) => void; loading: boolean;
}) {
  const teamTechs = techs.filter((t: any) => t.teamId === row.teamId);
  const [revenue, setRevenue] = useState(row.revenue ? String(row.revenue) : '');
  const [chefId, setChefId] = useState(row.chefId ?? '');
  const [binomeId, setBinomeId] = useState(row.binomeId ?? '');

  const chefPct = Number(row.repartitionChefPct ?? 65);
  const rev = Number(revenue) || 0;
  const chefShare = Math.round((rev * chefPct) / 100);
  const binomeShare = rev - chefShare;

  return (
    <Modal open onClose={onClose} title={`Feuille de paie — ${row.teamName} (${period})`}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ teamId: row.teamId, period, revenue: Number(revenue) || 0, chefId: chefId || null, binomeId: binomeId || null }); }}>
        <Input label={`Chiffre à répartir (FCFA) — répartition ${chefPct}/${100 - chefPct}`} type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Chef ({chefPct} %)</p>
            <p className="text-lg font-bold text-[#0f9d70] tabular-nums">{fmt(chefShare)} F</p>
          </div>
          <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
            <p className="text-[10px] text-[#7a8f80] mb-1">Binôme ({100 - chefPct} %)</p>
            <p className="text-lg font-bold text-[#f5a623] tabular-nums">{fmt(binomeShare)} F</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Chef d'équipe" value={chefId} onChange={(e) => setChefId(e.target.value)}>
            <option value="">—</option>
            {teamTechs.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
          <Select label="Binôme" value={binomeId} onChange={(e) => setBinomeId(e.target.value)}>
            <option value="">—</option>
            {teamTechs.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !revenue || Number(revenue) < 0}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
