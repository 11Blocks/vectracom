'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, Textarea, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { hrService, techniciansService } from '@/services';
import { useSessionUser } from '@/components/admin/TenantPicker';
import {
  CalendarDays, ChevronLeft, ChevronRight, Check, Loader2, Save, BadgeCheck, Users, CalendarCheck,
} from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mer' },
  { key: 'thursday', label: 'Jeu' },
  { key: 'friday', label: 'Ven' },
  { key: 'saturday', label: 'Sam' },
  { key: 'sunday', label: 'Dim' },
] as const;

/** Lundi de la semaine contenant la date donnée (ou d'aujourd'hui). */
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
function addWeeks(weekStart: string, n: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}
function weekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}
function dayDate(weekStart: string, i: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + i);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

type Grid = Record<string, Record<string, boolean>>;

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const { user } = useSessionUser();
  const isAdmin = user?.role === 'admin';
  const canWrite = isAdmin || user?.role === 'chef_equipe';
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [grid, setGrid] = useState<Grid>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set());

  const { data: technicians, loading } = useQuery(() => techniciansService.list(), []);
  const techs = Array.isArray(technicians) ? technicians : [];

  const { data: attendance, refetch, loading: attLoading } = useQuery(
    () => hrService.listAttendance({ weekStart }),
    [weekStart],
  );

  // Hydrate la grille depuis l'API à chaque changement de semaine / données
  useEffect(() => {
    const rows = Array.isArray(attendance) ? attendance : [];
    const g: Grid = {};
    const c: Record<string, string> = {};
    for (const row of rows) {
      g[row.technicianId] = {
        monday: !!row.monday, tuesday: !!row.tuesday, wednesday: !!row.wednesday,
        thursday: !!row.thursday, friday: !!row.friday, saturday: !!row.saturday, sunday: !!row.sunday,
      };
      if (row.comments) c[row.technicianId] = row.comments;
    }
    setGrid(g);
    setComments(c);
    setSavedRows(new Set(rows.filter((r: any) => r.validatedAt).map((r: any) => r.technicianId)));
    setDirty(false);
  }, [attendance]);

  const toggle = (techId: string, day: string) => {
    setGrid(prev => ({
      ...prev,
      [techId]: { ...(prev[techId] || {}), [day]: !prev[techId]?.[day] },
    }));
    setDirty(true);
  };

  const saveMut = useMutation(
    ({ technicianId, days, comment }: any) => hrService.saveAttendance({ technicianId, weekStart, ...days, comments: comment || undefined }),
    {
      onSuccess: () => { toast({ title: 'Présence enregistrée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const validateMut = useMutation(
    (id: string) => hrService.validateAttendance(id),
    {
      onSuccess: () => { toast({ title: 'Semaine validée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const saveAll = async () => {
    for (const tech of techs) {
      const days = grid[tech.id] || {};
      const hasAny = DAYS.some(d => days[d.key]);
      if (!hasAny && !comments[tech.id]) continue;
      await saveMut.mutate({ technicianId: tech.id, days, comment: comments[tech.id] });
    }
  };

  const attRows = Array.isArray(attendance) ? attendance : [];
  const validatedCount = attRows.filter((r: any) => r.validatedAt).length;
  const totalPresences = Object.values(grid).reduce(
    (sum, days) => sum + DAYS.filter(d => days[d.key]).length, 0,
  );
  const isCurrentWeek = weekStart === mondayOf(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><CalendarCheck size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Feuille de présence</h1>
            <p className="text-xs text-[#7a8f80]">Saisie hebdomadaire L→D — validation direction</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, -1))}><ChevronLeft size={16} /></Button>
          <div className="text-center min-w-56">
            <p className="text-sm font-medium text-[#e8ede9]">{weekRange(weekStart)}</p>
            {isCurrentWeek && <p className="text-[10px] text-[#0f9d70]">Semaine en cours</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Techniciens</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{techs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Feuilles saisies</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{attRows.length}/{techs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Jours validés</p>
          <p className="text-2xl font-bold text-[#0f9d70]">{validatedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Jours de présence cochés</p>
          <p className="text-2xl font-bold text-[#f5a623]">{totalPresences}</p>
        </Card>
      </div>

      {dirty && (
        <div className="rounded-lg border border-[#D9822B]/40 bg-[#D9822B]/10 px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm text-[#D9822B]">Modifications non enregistrées</span>
          <Button size="sm" onClick={saveAll} disabled={saveMut.loading}>
            {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer tout
          </Button>
        </div>
      )}

      {loading || attLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : techs.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Users size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80]">Aucun technicien — créez des équipes et techniciens d'abord</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80] sticky left-0 bg-[#111916] min-w-44">Technicien</th>
                {DAYS.map((d, i) => (
                  <th key={d.key} className="px-2 py-3 text-center text-xs font-medium text-[#7a8f80]">
                    <div>{d.label}</div>
                    <div className="text-[10px] text-[#7a8f80]/60 font-normal">{dayDate(weekStart, i)}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-medium text-[#7a8f80]">Total</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-[#7a8f80] min-w-40">Commentaire</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {techs.map((tech: any) => {
                const days = grid[tech.id] || {};
                const total = DAYS.filter(d => days[d.key]).length;
                const attRow = attRows.find((r: any) => r.technicianId === tech.id);
                const validated = !!attRow?.validatedAt;
                return (
                  <tr key={tech.id} className="hover:bg-[#172019]/50 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-[#111916]">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#0f9d70]/15 text-[#0f9d70] flex items-center justify-center text-[10px] font-bold">
                          {(tech.fullName || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-[#e8ede9] text-sm">{tech.fullName}</p>
                          {validated && <Badge className="mt-0.5 bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30 text-[10px]">Validée</Badge>}
                        </div>
                      </div>
                    </td>
                    {DAYS.map(d => (
                      <td key={d.key} className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => toggle(tech.id, d.key)}
                          disabled={validated || !canWrite}
                          title={days[d.key] ? 'Présent — cliquer pour retirer' : 'Absent — cliquer pour cocher'}
                          className={
                            'h-7 w-7 rounded-md border transition-all flex items-center justify-center ' +
                            (days[d.key]
                              ? 'bg-[#0f9d70] border-[#0f9d70] text-white hover:bg-[#0c8f60]'
                              : 'bg-[#0a0f0d] border-[#1e2e25] text-transparent hover:border-[#0f9d70]/50') +
                            (validated ? ' opacity-50 cursor-not-allowed' : '')
                          }
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className={'text-sm font-bold ' + (total >= 5 ? 'text-[#0f9d70]' : total > 0 ? 'text-[#D9822B]' : 'text-[#7a8f80]/50')}>{total}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text" value={comments[tech.id] ?? ''} disabled={validated || !canWrite}
                        onChange={e => { setComments(prev => ({ ...prev, [tech.id]: e.target.value })); setDirty(true); }}
                        placeholder="Remarque…"
                        className="w-full h-8 px-2.5 rounded-md bg-[#0a0f0d] border border-[#1e2e25] text-xs text-[#e8ede9] placeholder:text-[#7a8f80]/50 focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canWrite && (
                          <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs" disabled={!attRow || validated || saveMut.loading}
                            onClick={() => saveMut.mutate({ technicianId: tech.id, days, comment: comments[tech.id] })}>
                            {saveMut.loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
                          </Button>
                        )}
                        {isAdmin && attRow && !validated && (
                          <Button size="sm" className="h-8 px-2.5 text-xs" disabled={validateMut.loading}
                            onClick={() => validateMut.mutate(attRow.id)}>
                            <BadgeCheck size={12} /> Valider
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#7a8f80]/60">
        Une feuille validée est verrouillée (lecture seule). La validation est réservée aux rôles Admin et Direction.
      </p>
    </div>
  );
}
