'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, EmptyState, StatCard, Modal, Input, Select, Textarea, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { geolocationService, techniciansService } from '@/services';
import {
  MapPin, Loader2, RefreshCw, Battery, BatteryLow, TriangleAlert, History, Plus, Trash2, Edit,
  ShieldCheck, MapPinned, Radio, Clock,
} from 'lucide-react';

const GeoLiveMap = dynamic(
  () => import('@/components/maps/GeoLiveMap').then((m) => m.GeoLiveMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-lg" />,
  },
);

const GeoHistoryMap = dynamic(
  () => import('@/components/maps/GeoHistoryMap').then((m) => m.GeoHistoryMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full rounded-lg" />,
  },
);

const ZONE_TYPES = [
  { value: 'site_mission', label: 'Site de mission' },
  { value: 'zone_travail', label: 'Zone de travail' },
  { value: 'depot', label: 'Dépôt' },
];

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [historyTech, setHistoryTech] = useState<any>(null);
  const [showZone, setShowZone] = useState(false);
  const [showPoint, setShowPoint] = useState(false);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const [editZone, setEditZone] = useState<any | null>(null);

  const { data: status, error: statusError } = useQuery(() => geolocationService.status(), []);
  const { data: live, loading, refetch } = useQuery(() => geolocationService.live(), [], { pollingMs: 30000 });
  const { data: alerts, refetch: refetchAlerts } = useQuery(() => geolocationService.alerts(), [], { pollingMs: 30000 });
  const { data: zones, refetch: refetchZones } = useQuery(() => geolocationService.listZones(), []);

  const markers = live?.markers ?? [];
  const stats = live?.stats ?? { total: 0, enMission: 0, horsZone: 0, silencieux: 0 };

  if (!status && !statusError) return <Skeleton className="h-64" />;

  if (statusError && !status) {
    return (
      <Card className="border-[#1e2e25] bg-[#111916] p-6">
        <p className="text-sm text-[#C0392B]">API géolocalisation indisponible : {statusError}</p>
        <p className="mt-2 text-xs text-[#7a8f80]">Vérifiez que le backend (port 3100) et Postgres sont démarrés.</p>
      </Card>
    );
  }

  if (!status?.licensed) {
    return (
      <Card className="border-[#1e2e25] bg-[#111916]">
        <EmptyState
          icon={<MapPin size={40} className="text-[#7a8f80]/50" />}
          title="Géolocalisation — option payante"
          description="Vue cartographique temps réel des équipes : 5 000 FCFA/mois (55 000 F/an). Activez la licence depuis la console Green-T pour l'ouvrir sur votre tenant."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <MapPin size={20} className="text-[#0f9d70]" /> Géolocalisation
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            Suivi temps réel des équipes · {status.totalPoints.toLocaleString('fr-FR')} points enregistrés · rayon site {status.siteRadiusM} m · silence &gt; {status.silenceMinutes} min
            <span className="block mt-0.5 text-[#7a8f80]/80">
              Zone géofence = cercle carte (contrôle écart) · Zone ops = libellé SONATEL sur la mission (ex. Mbour)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">
            <ShieldCheck size={11} className="mr-1" /> licence active — 5 000 F/mois
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowPoint(true)}>
            <Radio size={14} /> Pointer une position
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowZone(true)}>
            <Plus size={14} /> Zone
          </Button>
          <Button size="sm" onClick={() => { refetch(); refetchAlerts(); }} loading={loading}>
            <RefreshCw size={14} /> Actualiser
          </Button>
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Techniciens suivis" value={stats.total} icon={<Radio size={18} />} variant="default" />
        <StatCard label="En mission" value={stats.enMission} icon={<MapPinned size={18} />} variant={stats.enMission > 0 ? 'success' : 'default'} />
        <StatCard label="Hors zone" value={stats.horsZone} icon={<TriangleAlert size={18} />} variant={stats.horsZone > 0 ? 'danger' : 'success'} />
        <StatCard label="Silencieux" value={stats.silencieux} icon={<Clock size={18} />} variant={stats.silencieux > 0 ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Carte temps réel ── */}
        <Card className="border-[#1e2e25] bg-[#111916] p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><MapPinned size={15} className="text-[#0f9d70]" /> Carte temps réel</h3>
            <span className="text-[10px] text-[#7a8f80] flex items-center gap-1"><Clock size={10} /> Dark Matter · 30 s</span>
          </div>
          <LiveMap markers={markers} zones={live?.zones ?? []} onSelect={setHistoryTech} />
        </Card>

        {/* ── Colonne droite : alertes + zones ── */}
        <div className="space-y-4">
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2">
              <TriangleAlert size={15} className={(alerts ?? []).length > 0 ? 'text-[#C0392B]' : 'text-[#0f9d70]'} /> Alertes ({(alerts ?? []).length})
            </h3>
            {(alerts ?? []).length === 0 ? (
              <p className="text-xs text-[#7a8f80]/70">Aucune alerte — équipes dans leurs zones, positions fraîches.</p>
            ) : (
              <div className="space-y-2">
                {(alerts ?? []).map((a: any, i: number) => (
                  <div key={i} className={'rounded-lg border p-2.5 ' + (a.severity === 'critical' ? 'border-[#C0392B]/40 bg-[#C0392B]/[0.06]' : 'border-[#D9822B]/40 bg-[#D9822B]/[0.06]')}>
                    <p className="text-xs font-semibold text-[#e8ede9]">{a.technicianName} — {a.type.replace('_', ' ')}</p>
                    <p className="text-[10px] text-[#7a8f80] mt-0.5">{a.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-1">Zones géofence ({(zones ?? []).length})</h3>
            <p className="text-[10px] text-[#7a8f80] mb-3">Cercles sur la carte — distincts de la « zone ops » mission / incident.</p>
            {(zones ?? []).length === 0 ? (
              <p className="text-xs text-[#7a8f80]/70">Aucune zone géofence — créez des zones de travail pour les contrôles d&apos;écart.</p>
            ) : (
              <div className="space-y-1.5">
                {(zones ?? []).map((z: any) => (
                  <div key={z.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-2.5 py-2">
                    <div>
                      <p className="text-xs text-[#e8ede9]">{z.name}</p>
                      <p className="text-[10px] text-[#7a8f80]">{ZONE_TYPES.find(t => t.value === z.type)?.label ?? z.type} · {z.radiusM} m</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={() => setEditZone(z)} title="Modifier">
                        <Edit size={11} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setDeleteZoneId(z.id)}>
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Liste des techniciens ── */}
      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
        <h3 className="text-sm font-semibold text-[#e8ede9] p-4 pb-3">Équipes sur le terrain</h3>
        {markers.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-[#7a8f80]/70">Aucune position — le mobile envoie un point ~toutes les 60 s (app ouverte), ou utilisez « Pointer une position ».</p>
        ) : (
          <div className="divide-y divide-[#1e2e25]/50">
            {markers.map((m: any) => (
              <button key={m.technicianId} onClick={() => setHistoryTech(m)} className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9]">{m.technicianName}</p>
                    {m.teamName && <Badge className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">{m.teamName}</Badge>}
                    {m.mission ? (
                      <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{m.mission.typeTache} — {m.mission.clientSite}</Badge>
                    ) : (
                      <Badge className="bg-[#1a2420] text-[#7a8f80]/70 border-[#1e2e25]">hors mission</Badge>
                    )}
                    {m.outOfZone && <Badge className="bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30">hors zone</Badge>}
                    {m.silent && <Badge className="bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30">silencieux</Badge>}
                  </div>
                  <p className="text-[10px] text-[#7a8f80] mt-0.5 font-mono">
                    {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                    {m.nearestZoneName && ` · zone ${m.nearestZoneName}${m.distanceToNearestZoneM != null ? ` (${m.distanceToNearestZoneM} m)` : ''}`}
                    {m.mission?.zone && ` · ops ${m.mission.zone}`}
                    {m.distanceToSiteM != null && ` · ${m.distanceToSiteM} m du site`}
                    {m.speedKmh != null && ` · ${Math.round(m.speedKmh)} km/h`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  {m.batteryPct != null && (
                    <span className={'text-xs flex items-center gap-1 ' + (m.batteryPct < 15 ? 'text-[#C0392B]' : 'text-[#7a8f80]')}>
                      {m.batteryPct < 15 ? <BatteryLow size={12} /> : <Battery size={12} />} {m.batteryPct}%
                    </span>
                  )}
                  <div>
                    <p className="text-xs text-[#e8ede9]">il y a {m.minutesAgo < 1 ? '<1' : m.minutesAgo} min</p>
                    <p className="text-[10px] text-[#7a8f80] flex items-center gap-1 justify-end"><History size={9} /> tracé</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <HistoryModal technician={historyTech} onClose={() => setHistoryTech(null)} />
      <ZoneModal open={showZone} onClose={() => setShowZone(false)} onDone={() => { refetchZones(); refetch(); }} />
      <ZoneModal open={!!editZone} zone={editZone} onClose={() => setEditZone(null)} onDone={() => { setEditZone(null); refetchZones(); refetch(); }} />
      <PointModal open={showPoint} onClose={() => setShowPoint(false)} onDone={() => { refetch(); refetchAlerts(); }} />
      <ConfirmDialog open={!!deleteZoneId} onClose={() => setDeleteZoneId(null)} title="Supprimer la zone"
        message="La zone ne sera plus utilisée pour les contrôles d'écart." confirmText="Supprimer" danger
        onConfirm={() => {
          if (!deleteZoneId) return;
          geolocationService.deleteZone(deleteZoneId)
            .then(() => { toast({ title: 'Zone supprimée', variant: 'success' }); setDeleteZoneId(null); refetchZones(); })
            .catch((e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }));
        }} />
    </div>
  );
}

/* ═════════════════ CARTE TEMPS RÉEL — MapLibre dark ═════════════════ */
function LiveMap({ markers, zones, onSelect }: { markers: any[]; zones: any[]; onSelect: (m: any) => void }) {
  // Toujours monter MapLibre (même sans points) — sinon la carte « disparaît ».
  return <GeoLiveMap markers={markers} zones={zones} onSelect={onSelect} height={420} />;
}

/* ═════════════════ HISTORIQUE (7 jours par défaut) ═════════════════ */
function HistoryModal({ technician, onClose }: { technician: any | null; onClose: () => void }) {
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const [to, setTo] = useState(() => toIso(new Date()));
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toIso(d);
  });

  useEffect(() => {
    if (!technician) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setTo(toIso(end));
    setFrom(toIso(start));
  }, [technician?.technicianId]);

  const { data, loading } = useQuery(
    () => (technician ? geolocationService.history(technician.technicianId, from, to) : Promise.resolve(null)),
    [technician?.technicianId, from, to],
    { immediate: !!technician },
  );

  const positions = data?.positions ?? [];

  return (
    <Modal open={!!technician} onClose={onClose} title={`Tracé 7 j — ${technician?.technicianName ?? ''}`} size="lg">
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Du" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Au" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 7);
                setTo(toIso(end));
                setFrom(toIso(start));
              }}
            >
              7 jours
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-[#7a8f80]">Points : <b className="text-[#e8ede9]">{positions.length}</b></span>
            <span className="text-[#7a8f80]">Distance parcourue : <b className="text-[#e8ede9]">{(data?.distanceTotalM ?? 0).toLocaleString('fr-FR')} m</b></span>
          </div>
          {positions.length > 0 ? (
            <GeoHistoryMap positions={positions} height={280} />
          ) : (
            <p className="text-xs text-[#7a8f80]">Aucun point sur la période sélectionnée.</p>
          )}
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {positions.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono text-[#7a8f80]">{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}</span>
                  <p className="text-[10px] text-[#e8ede9]/80 mt-0.5 truncate">
                    {p.nearestZoneName
                      ? `${p.insideNearestZone ? 'Dans' : 'Près de'} ${p.nearestZoneName}${p.distanceToNearestZoneM != null ? ` · ${p.distanceToNearestZoneM} m` : ''}`
                      : 'Hors zone géofence'}
                    {p.source ? ` · ${p.source}` : ''}
                  </p>
                </div>
                <span className="text-[#7a8f80] shrink-0 text-right">
                  {p.recordedAt ? new Date(p.recordedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  {p.speedKmh != null && ` · ${Math.round(Number(p.speedKmh))} km/h`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═════════════════ CRÉATION / ÉDITION DE ZONE ═════════════════ */
function ZoneModal({ open, zone, onClose, onDone }: { open: boolean; zone?: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', type: 'zone_travail', centerLatitude: '', centerLongitude: '', radiusM: '500', note: '' });

  useEffect(() => {
    if (zone) {
      setF({
        name: zone.name ?? '',
        type: zone.type ?? 'zone_travail',
        centerLatitude: String(zone.centerLatitude ?? ''),
        centerLongitude: String(zone.centerLongitude ?? ''),
        radiusM: String(zone.radiusM ?? 500),
        note: zone.note ?? '',
      });
    } else if (open) {
      setF({ name: '', type: 'zone_travail', centerLatitude: '', centerLongitude: '', radiusM: '500', note: '' });
    }
  }, [zone, open]);

  const payload = () => ({
    name: f.name,
    type: f.type,
    centerLatitude: Number(f.centerLatitude),
    centerLongitude: Number(f.centerLongitude),
    radiusM: f.radiusM ? Number(f.radiusM) : undefined,
    note: f.note || undefined,
  });

  const mut = useMutation(
    () => zone ? geolocationService.updateZone(zone.id, payload()) : geolocationService.createZone(payload()),
    {
      onSuccess: () => { toast({ title: zone ? 'Zone mise à jour' : 'Zone créée', variant: 'success' }); onDone(); onClose(); },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (f.centerLatitude === '' || f.centerLongitude === '') {
      toast({ title: 'Coordonnées requises', variant: 'warning' });
      return;
    }
    mut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={zone ? `Modifier — ${zone.name}` : 'Nouvelle zone géographique'}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nom *" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required placeholder="Zone Yoff" />
          <Select label="Type *" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            {ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Latitude *" type="number" step="0.0000001" value={f.centerLatitude} onChange={e => setF({ ...f, centerLatitude: e.target.value })} required placeholder="14.7420" />
          <Input label="Longitude *" type="number" step="0.0000001" value={f.centerLongitude} onChange={e => setF({ ...f, centerLongitude: e.target.value })} required placeholder="-17.4700" />
          <Input label="Rayon (m)" type="number" value={f.radiusM} onChange={e => setF({ ...f, radiusM: e.target.value })} />
        </div>
        <Textarea label="Note" rows={2} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} {zone ? 'Enregistrer' : 'Créer la zone'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════════ POINTAGE DE POSITION (démo/test) ═════════════════ */
function PointModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const { data: techs } = useQuery(() => techniciansService.list(), [], { immediate: open });
  const techsList = Array.isArray(techs) ? techs : [];
  const [f, setF] = useState({ technicianId: '', latitude: '', longitude: '', batteryPct: '', speedKmh: '' });

  const mut = useMutation(
    () => geolocationService.record({
      technicianId: f.technicianId,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      batteryPct: f.batteryPct !== '' ? Number(f.batteryPct) : undefined,
      speedKmh: f.speedKmh !== '' ? Number(f.speedKmh) : undefined,
      source: 'mobile',
    }),
    {
      onSuccess: () => { toast({ title: 'Position enregistrée', variant: 'success' }); onDone(); onClose(); },
      onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
    },
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.technicianId || f.latitude === '' || f.longitude === '') {
      toast({ title: 'Technicien et coordonnées requis', variant: 'warning' });
      return;
    }
    mut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Pointer une position (simulation mobile)">
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-xs text-[#7a8f80]">En production, ce point remonte automatiquement du mobile en arrière-plan. Ce formulaire simule l&apos;émission pour les tests.</p>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Technicien *" value={f.technicianId} onChange={e => setF({ ...f, technicianId: e.target.value })}>
            <option value="">— Sélectionner —</option>
            {techsList.map((t: any) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </Select>
          <Input label="Latitude *" type="number" step="0.0000001" value={f.latitude} onChange={e => setF({ ...f, latitude: e.target.value })} placeholder="14.7420" />
          <Input label="Longitude *" type="number" step="0.0000001" value={f.longitude} onChange={e => setF({ ...f, longitude: e.target.value })} placeholder="-17.4700" />
          <Input label="Batterie (%)" type="number" value={f.batteryPct} onChange={e => setF({ ...f, batteryPct: e.target.value })} />
          <Input label="Vitesse (km/h)" type="number" value={f.speedKmh} onChange={e => setF({ ...f, speedKmh: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} <Radio size={14} /> Émettre le point</Button>
        </div>
      </form>
    </Modal>
  );
}
