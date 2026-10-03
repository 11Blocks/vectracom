'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, Textarea, useToast, EmptyState } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { cartographieService, missionsService } from '@/services';
import { Map, Loader2, Plus, Trophy, Star, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

const ZONE_META: Record<string, { label: string; cls: string; icon: any }> = {
  productive: { label: 'Productive', cls: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30', icon: CheckCircle2 },
  saturee: { label: 'Saturée', cls: 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30', icon: Activity },
  bloquee: { label: 'Bloquée', cls: 'bg-[#C0392B]/15 text-[#C0392B] border-[#C0392B]/30', icon: AlertTriangle },
  normale: { label: 'Normale', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', icon: Map },
};

const fmt = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: zonesData, loading: zLoading } = useQuery(() => cartographieService.zones(period), [period]);
  const { data: equipesData, loading: eLoading } = useQuery(() => cartographieService.equipes(period), [period]);
  const { data: feedbackData, refetch: refetchFb } = useQuery(() => cartographieService.feedback(), []);

  const zones = useMemo(() => (Array.isArray(zonesData) ? zonesData : []), [zonesData]);
  const equipes = useMemo(() => (Array.isArray(equipesData) ? equipesData : []), [equipesData]);
  const feedbacks = useMemo(() => (Array.isArray(feedbackData) ? feedbackData : []), [feedbackData]);

  const createFbMut = useMutation((d: any) => cartographieService.createFeedback(d), {
    onSuccess: () => { toast({ title: 'Avis client enregistré', variant: 'success' }); setShowFeedback(false); refetchFb(); },
    onError: (e: any) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
  });

  const best = equipes.filter((e: any) => e.validees > 0).sort((a: any, b: any) => b.tauxReussite - a.tauxReussite)[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Map size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Cartographie & satisfaction</h1>
            <p className="text-xs text-[#7a8f80]">Zones productives / saturées / bloquées + classement équipes + avis clients</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
          <Button onClick={() => setShowFeedback(true)}><Plus size={15} /> Avis client</Button>
        </div>
      </div>

      {/* Zones */}
      <div>
        <h3 className="text-sm font-semibold text-[#e8ede9] mb-2">Zones d'intervention</h3>
        {zLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : zones.length === 0 ? (
          <Card className="border-[#1e2e25] bg-[#111916] p-8 text-center">
            <EmptyState icon={<Map size={40} className="text-[#7a8f80]/50" />} title="Aucune donnée de zone" />
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {zones.map((z: any) => {
              const meta = ZONE_META[z.statut] ?? ZONE_META.normale;
              const Icon = meta.icon;
              return (
                <Card key={z.zone} className="p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-[#e8ede9] truncate">{z.zone}</p>
                    <Icon size={16} className={meta.cls.split(' ')[1]} />
                  </div>
                  <Badge className={meta.cls + ' mt-2'}>{meta.label}</Badge>
                  <div className="grid grid-cols-3 gap-1 mt-3 text-center">
                    <div><p className="text-sm font-bold text-[#e8ede9]">{z.total}</p><p className="text-[9px] text-[#7a8f80]">missions</p></div>
                    <div><p className="text-sm font-bold text-[#0f9d70]">{z.validees}</p><p className="text-[9px] text-[#7a8f80]">validées</p></div>
                    <div><p className="text-sm font-bold text-[#C0392B]">{z.bloquees}</p><p className="text-[9px] text-[#7a8f80]">bloquées</p></div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1a2420] overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${z.tauxReussite >= 70 ? 'bg-[#0f9d70]' : z.tauxReussite >= 40 ? 'bg-[#f5a623]' : 'bg-[#C0392B]'}`} style={{ width: `${z.tauxReussite}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Classement équipes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><Trophy size={15} className="text-[#f5a623]" /> Classement équipes</h3>
          {best && <p className="text-xs text-[#7a8f80]">Meilleure : <span className="text-[#0f9d70] font-semibold">{best.teamName}</span> ({best.tauxReussite} %)</p>}
        </div>
        {eLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : equipes.length === 0 ? (
          <Card className="border-[#1e2e25] bg-[#111916] p-8 text-center"><EmptyState title="Aucune équipe" /></Card>
        ) : (
          <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2e25] bg-[#111916]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80] w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#7a8f80]">Équipe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Missions</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Validées</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Taux réussite</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#7a8f80]">Satisfaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
                {equipes.map((e: any, i: number) => (
                  <tr key={e.teamId} className="hover:bg-[#172019]/50 transition-colors">
                    <td className="px-4 py-2.5 text-[#7a8f80] tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[#e8ede9]">{e.teamName}</td>
                    <td className="px-4 py-2.5 text-center text-[#7a8f80]">{e.total}</td>
                    <td className="px-4 py-2.5 text-center text-[#0f9d70] font-semibold">{e.validees}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-semibold tabular-nums ${e.tauxReussite >= 70 ? 'text-[#0f9d70]' : e.tauxReussite >= 40 ? 'text-[#f5a623]' : 'text-[#C0392B]'}`}>{e.tauxReussite} %</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {e.satisfaction != null
                        ? <span className="inline-flex items-center gap-1 text-[#f5a623] font-semibold"><Star size={12} fill="currentColor" /> {fmt(e.satisfaction)}</span>
                        : <span className="text-[#7a8f80]/50">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Avis clients récents */}
      {feedbacks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-2">Avis clients récents</h3>
          <div className="space-y-2">
            {feedbacks.slice(0, 10).map((f: any) => (
              <Card key={f.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#e8ede9] truncate">{f.missionLabel ?? 'Mission'}</p>
                  <span className="inline-flex items-center gap-0.5 text-[#f5a623]">
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} fill={n <= f.rating ? 'currentColor' : 'none'} className={n <= f.rating ? 'text-[#f5a623]' : 'text-[#7a8f80]/40'} />)}
                  </span>
                </div>
                <p className="text-xs text-[#7a8f80] mt-1">
                  {f.teamName ? `Équipe ${f.teamName}` : ''}
                  {f.cleanliness ? ` · propreté ${f.cleanliness}/5` : ''}
                  {f.behavior ? ` · comportement ${f.behavior}/5` : ''}
                </p>
                {f.comment && <p className="text-xs text-[#e8ede9] mt-1">{f.comment}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} onSubmit={(d) => createFbMut.mutate(d)} loading={createFbMut.loading} />
      )}
    </div>
  );
}

function FeedbackModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (d: any) => void; loading: boolean }) {
  const { data: missionsData } = useQuery(() => missionsService.list({ status: 'validee', limit: '500' }), []);
  const missions = useMemo(() => {
    const d = Array.isArray(missionsData) ? missionsData : (missionsData as any)?.items ?? [];
    return d;
  }, [missionsData]);

  const [f, setF] = useState({ missionId: '', rating: '5', cleanliness: '', behavior: '', comment: '', clientName: '' });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.missionId && Number(f.rating) >= 1 && Number(f.rating) <= 5;

  return (
    <Modal open onClose={onClose} title="Avis client" size="lg">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ missionId: f.missionId, rating: Number(f.rating), cleanliness: f.cleanliness ? Number(f.cleanliness) : undefined, behavior: f.behavior ? Number(f.behavior) : undefined, comment: f.comment.trim() || undefined, clientName: f.clientName.trim() || undefined }); }}>
        <Select label="Mission *" value={f.missionId} onChange={(e) => set('missionId', e.target.value)} required>
          <option value="">— Sélectionner —</option>
          {missions.map((m: any) => <option key={m.id} value={m.id}>{m.clientSite} · {m.zone ?? '—'}</option>)}
        </Select>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Satisfaction globale *" value={f.rating} onChange={(e) => set('rating', e.target.value)}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </Select>
          <Select label="Propreté du chantier" value={f.cleanliness} onChange={(e) => set('cleanliness', e.target.value)}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </Select>
          <Select label="Comportement équipe" value={f.behavior} onChange={(e) => set('behavior', e.target.value)}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
          </Select>
        </div>
        <Input label="Nom du client" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} />
        <Textarea label="Commentaire" rows={3} value={f.comment} onChange={(e) => set('comment', e.target.value)} placeholder="Le technicien a laissé le chantier propre, ou au contraire…" />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !valid}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Enregistrer l'avis
          </Button>
        </div>
      </form>
    </Modal>
  );
}
