'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Select, useToast, EmptyState, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { permanenceService, teamsService } from '@/services';
import { CalendarCheck, Loader2, RefreshCw, Wand2, Users } from 'lucide-react';

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [type, setType] = useState('SAV');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const { data, loading, refetch } = useQuery(() => permanenceService.list(type, from, to), [type, from, to]);
  const { data: teamsData } = useQuery(() => teamsService.list(), []);
  const teams = useMemo(() => (Array.isArray(teamsData) ? teamsData.filter((t: any) => t.active !== false) : []), [teamsData]);

  const generateMut = useMutation(() => permanenceService.generate(type, year), {
    onSuccess: (r: any) => { toast({ title: `${r.created} créneau(x) généré(s)`, variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Génération impossible', description: e.message, variant: 'error' }),
  });
  const assignMut = useMutation(() => permanenceService.assign(type), {
    onSuccess: (r: any) => { toast({ title: `${r.assigned} créneau(x) assigné(s)`, variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Assignation impossible', description: e.message, variant: 'error' }),
  });
  const assignSlotMut = useMutation(({ id, teamId }: { id: string; teamId: string | null }) => permanenceService.assignSlot(id, teamId), {
    onSuccess: () => refetch(),
    onError: (e: any) => toast({ title: 'Assignation refusée', description: e.message, variant: 'error' }),
  });

  const slots = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const assignedCount = slots.filter((s: any) => s.teamId).length;
  const unassignedCount = slots.length - assignedCount;

  // Grouper par mois
  const byMonth = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const s of slots) {
      const m = Number(String(s.day).slice(5, 7)) - 1;
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(s);
    }
    return map;
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><CalendarCheck size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Permanence</h1>
            <p className="text-xs text-[#7a8f80]">Rotation SAV / PRODUCTION — week-ends et jours fériés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-28">
            {[new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Button variant="outline" size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.loading}>
            {generateMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Générer {year}
          </Button>
          <Button size="sm" onClick={() => assignMut.mutate()} disabled={assignMut.loading || slots.length === 0}>
            {assignMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Assigner rotation
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[{ value: 'SAV', label: 'SAV (astreinte)' }, { value: 'PRODUCTION', label: 'PRODUCTION (installations)' }]}
        active={type}
        onChange={setType}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Créneaux {year}</p>
          <p className="text-2xl font-bold text-[#e8ede9]">{slots.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Assignés</p>
          <p className="text-2xl font-bold text-[#0f9d70]">{assignedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#7a8f80] mb-1">Non assignés</p>
          <p className="text-2xl font-bold text-[#f5a623]">{unassignedCount}</p>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : slots.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <EmptyState
            icon={<CalendarCheck size={40} className="text-[#7a8f80]/50" />}
            title="Aucun créneau"
            description={`Générez les créneaux week-ends + jours fériés pour ${year}.`}
            action={<Button onClick={() => generateMut.mutate()} disabled={generateMut.loading}><Wand2 size={15} /> Générer les créneaux</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byMonth.entries()).sort((a, b) => a[0] - b[0]).map(([month, monthSlots]) => {
            const monthTotal = monthSlots.length;
            const monthAssigned = monthSlots.filter((s: any) => s.teamId).length;
            return (
              <Card key={month} className="border-[#1e2e25] bg-[#111916] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2e25] bg-[#0a0f0d]">
                  <p className="text-sm font-semibold text-[#e8ede9]">{MONTHS[month]} {year}</p>
                  <span className="text-xs text-[#7a8f80]">{monthAssigned}/{monthTotal} assignés</span>
                </div>
                <div className="divide-y divide-[#1e2e25]/40">
                  {monthSlots.map((s: any) => {
                    const d = new Date(s.day + 'T00:00:00');
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                        <div className="w-24 shrink-0">
                          <p className="text-sm font-medium text-[#e8ede9]">{d.getDate()} {MONTHS[d.getMonth()].slice(0, 4)}.</p>
                          <p className="text-[10px] text-[#7a8f80]">{DAY_LABELS[d.getDay()]}{isWeekend ? '' : ' · férié'}</p>
                        </div>
                        <div className="flex-1">
                          {s.teamId ? (
                            <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{s.teamName ?? 'Équipe'}</Badge>
                          ) : (
                            <Badge className="bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30">Non assigné</Badge>
                          )}
                        </div>
                        <Select
                          value={s.teamId ?? ''}
                          onChange={(e) => assignSlotMut.mutate({ id: s.id, teamId: e.target.value || null })}
                          className="w-48 h-8"
                        >
                          <option value="">— Libre —</option>
                          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#7a8f80]/60 flex items-center gap-1.5"><Users size={12} /> La rotation répartit équitablement les équipes actives ; vous pouvez ajuster chaque créneau manuellement.</p>
    </div>
  );
}
