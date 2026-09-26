'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Textarea, useToast, ConfirmDialog } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { vehiclesService, teamsService, absoluteUploadUrl } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import { api } from '@/lib/api';
import { Truck, Plus, Loader2, Eye, ClipboardCheck, FolderOpen, Trash2, AlertTriangle, Gauge, Users, X, Check, Wrench, Fuel, Edit } from 'lucide-react';

const BADGE_COLOR: Record<string, string> = { rouge: '#C0392B', orange: '#D9822B', vert: '#0f9d70' };
const CHECK_ITEMS = [
  { key: 'huile', label: 'Niveau huile' },
  { key: 'eau', label: 'Niveau eau' },
  { key: 'freins', label: 'Liquide de frein' },
  { key: 'pneus', label: 'Pneus' },
  { key: 'batterie', label: 'Batterie' },
  { key: 'eclairage', label: 'Éclairage' },
] as const;
const DOC_LABELS: Record<string, string> = {
  carte_grise: 'Carte grise', assurance: 'Assurance', visite_technique: 'Visite technique',
};
const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible', en_mission: 'En mission', en_reparation: 'En réparation',
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function fmtNum(n: any) { return n !== null && n !== undefined ? Number(n).toLocaleString('fr-FR') : '—'; }

function ExpiryPill({ label, b }: { label: string; b?: any }) {
  const color = BADGE_COLOR[b?.badge ?? 'vert'];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
      style={{ borderColor: color + '55', color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
      {b?.daysLeft !== null && b?.daysLeft !== undefined
        ? <b>{b.daysLeft < 0 ? 'dépassé' : `J-${b.daysLeft}`}</b>
        : null}
    </span>
  );
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [echeance, setEcheance] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [editVehicle, setEditVehicle] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(
    () => vehiclesService.list(echeance ? { echeance } : undefined),
    [echeance],
  );
  const vehicles = Array.isArray(data) ? data : [];

  const deleteMut = useMutation((id: string) => vehiclesService.delete(id), {
    onSuccess: () => { toast({ title: 'Véhicule supprimé', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const counts = {
    rouge: vehicles.filter(v => v.badges?.global === 'rouge').length,
    orange: vehicles.filter(v => v.badges?.global === 'orange').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Truck size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Véhicules</h1>
            <p className="text-xs text-[#7a8f80]">
              {vehicles.length} véhicule(s)
              {counts.rouge > 0 && <span className="text-[#C0392B]"> · {counts.rouge} échéance critique</span>}
              {counts.orange > 0 && <span className="text-[#D9822B]"> · {counts.orange} à surveiller</span>}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter véhicule</Button>
      </div>

      {/* Filtres échéances */}
      <div className="flex flex-wrap gap-1.5">
        {[['', 'Tous'], ['rouge', 'Critique (≤7j)'], ['orange', 'À surveiller (≤30j)'], ['vert', 'À jour']].map(([v, label]) => (
          <button key={v} onClick={() => setEcheance(v)}
            className={'rounded-lg border px-3 py-1.5 text-sm transition-colors ' + (echeance === v ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
            {label}
            {v && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: BADGE_COLOR[v] }} />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : vehicles.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <Truck size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-4">Aucun véhicule</p>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Ajouter un véhicule</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {vehicles.map((v: any) => (
            <Card key={v.id} className="border-[#1e2e25] bg-[#111916] p-4 hover:border-[#0f9d70]/30 transition-all cursor-pointer" onClick={() => setDetail(v)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-[#e8ede9] font-mono">{v.immatriculation}</p>
                  <p className="text-xs text-[#7a8f80]">{v.modele ?? '—'} · {STATUS_LABELS[v.status] ?? v.status}</p>
                </div>
                <span className="h-3 w-3 rounded-full mt-1 shrink-0" style={{ background: BADGE_COLOR[v.badges?.global ?? 'vert'] }} title={v.badges?.global} />
              </div>
              <div className="flex items-center gap-3 text-xs text-[#7a8f80] mb-3">
                <span className="inline-flex items-center gap-1"><Gauge size={12} /> {fmtNum(v.kilometrage)} km</span>
                <span className="inline-flex items-center gap-1"><Users size={12} /> {v.team?.name ?? 'Non affecté'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ExpiryPill label="Assur." b={v.badges?.insurance} />
                <ExpiryPill label="Visite" b={v.badges?.technicalInspection} />
              </div>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-[#1e2e25]">
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" onClick={e => { e.stopPropagation(); setDetail(v); }}>
                  <Eye size={13} /> Détail
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#0f9d70]" onClick={e => { e.stopPropagation(); setEditVehicle(v); }} title="Modifier">
                  <Edit size={13} />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={e => { e.stopPropagation(); setDeleteId(v.id); }}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VehicleDetailModal vehicle={detail} onClose={() => setDetail(null)} />
      <CreateVehicleModal open={showCreate} onClose={() => setShowCreate(false)} onDone={refetch} />
      <EditVehicleModal vehicle={editVehicle} onClose={() => setEditVehicle(null)} onDone={() => { setEditVehicle(null); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le véhicule"
        message="Cette action est irréversible." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

/* ═════════════════ DÉTAIL VÉHICULE ═════════════════ */
function VehicleDetailModal({ vehicle, onClose }: { vehicle: any | null; onClose: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'entretien' | 'pannes' | 'carburant' | 'couts'>('entretien');
  const [checks, setChecks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [showEvent, setShowEvent] = useState<'panne' | 'reparation' | 'piece' | 'carburant' | null>(null);

  const load = async (id: string) => {
    try {
      const [c, d, e, k] = await Promise.all([
        api.get(`/vehicles/${id}/checks`),
        api.get(`/vehicles/${id}/documents`),
        vehiclesService.listEvents(id),
        vehiclesService.vehicleCosts(id).catch(() => null),
      ]);
      setChecks(Array.isArray(c) ? c : []);
      setDocuments(Array.isArray(d) ? d : []);
      setEvents(Array.isArray(e) ? e : []);
      setCosts(k);
    } catch { setChecks([]); setDocuments([]); setEvents([]); setCosts(null); }
  };

  useEffect(() => { if (vehicle) load(vehicle.id); }, [vehicle]);

  const checkMut = useMutation(
    (data: any) => vehiclesService.createCheck(vehicle.id, data),
    {
      onSuccess: () => { toast({ title: 'Check enregistré', variant: 'success' }); setShowCheck(false); load(vehicle.id); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const docMut = useMutation(
    (data: any) => vehiclesService.addDocument(vehicle.id, data),
    {
      onSuccess: () => { toast({ title: 'Document ajouté', variant: 'success' }); setShowDoc(false); load(vehicle.id); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const delDocMut = useMutation(
    (docId: string) => api.delete(`/vehicles/${vehicle?.id}/documents/${docId}`),
    {
      onSuccess: () => { toast({ title: 'Document supprimé', variant: 'success' }); load(vehicle.id); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const eventMut = useMutation(
    (data: any) => vehiclesService.createEvent(vehicle.id, data),
    {
      onSuccess: () => { toast({ title: 'Événement enregistré', variant: 'success' }); setShowEvent(null); load(vehicle.id); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const repairStatusMut = useMutation(
    ({ eventId, status }: { eventId: string; status: string }) => vehiclesService.updateEvent(vehicle.id, eventId, { status }),
    {
      onSuccess: () => { toast({ title: 'Statut mis à jour', variant: 'success' }); load(vehicle.id); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  if (!vehicle) return null;

  const pannes = events.filter(e => e.type === 'panne' || e.type === 'reparation' || e.type === 'piece');
  const fuels = events.filter(e => e.type === 'carburant');
  const TABS = [
    { v: 'entretien', label: 'Check auto & documents' },
    { v: 'pannes', label: `Pannes & réparations (${pannes.length})` },
    { v: 'carburant', label: `Carburant (${fuels.length})` },
    { v: 'couts', label: 'Coûts' },
  ];

  return (
    <>
      <Modal open={!!vehicle} onClose={onClose} title={vehicle.immatriculation} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-[#7a8f80]">Modèle</p><p className="text-[#e8ede9]">{vehicle.modele ?? '—'}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Kilométrage</p><p className="text-[#e8ede9]">{fmtNum(vehicle.kilometrage)} km</p></div>
            <div><p className="text-xs text-[#7a8f80]">Équipe</p><p className="text-[#e8ede9]">{vehicle.team?.name ?? '—'}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Statut</p><p className="text-[#e8ede9]">{STATUS_LABELS[vehicle.status] ?? vehicle.status}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExpiryPill label="Assurance" b={vehicle.badges?.insurance} />
            <ExpiryPill label="Visite technique" b={vehicle.badges?.technicalInspection} />
            <span className="text-xs text-[#7a8f80] ml-1">
              exp. : {fmtDate(vehicle.insuranceExpiration)} / {fmtDate(vehicle.technicalInspectionExpiration)}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto bg-[#0a0f0d] border border-[#1e2e25] rounded-lg p-1 w-fit">
            {TABS.map(t => (
              <button key={t.v} onClick={() => setTab(t.v as any)}
                className={'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ' + (tab === t.v ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'entretien' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide flex items-center gap-1.5">
                    <FolderOpen size={13} /> Pochette digitale ({documents.length})
                  </h4>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setShowDoc(true)}><Plus size={12} /> Ajouter</Button>
                </div>
                {documents.length === 0 ? (
                  <p className="text-xs text-[#7a8f80]/60">Aucun document — carte grise, assurance, visite technique.</p>
                ) : (
                  <div className="space-y-1.5">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2">
                        <div>
                          <p className="text-sm text-[#e8ede9]">{DOC_LABELS[d.docType] ?? d.docType}</p>
                          {d.expirationDate && <p className="text-[10px] text-[#7a8f80]">exp. {fmtDate(d.expirationDate)}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={absoluteUploadUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-[#0f9d70] hover:underline">Voir</a>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => delDocMut.mutate(d.id)}>
                            <Trash2 size={11} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide flex items-center gap-1.5">
                    <ClipboardCheck size={13} /> Checks de prise de poste ({checks.length})
                  </h4>
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setShowCheck(true)}><ClipboardCheck size={12} /> Faire le check (15 s)</Button>
                </div>
                {checks.length === 0 ? (
                  <p className="text-xs text-[#7a8f80]/60">Aucun check enregistré.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {checks.map((c: any) => {
                      const allOk = CHECK_ITEMS.every(i => c[i.key]);
                      return (
                        <div key={c.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm flex items-center gap-1.5">
                              {allOk
                                ? <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30 text-[10px]"><Check size={10} className="mr-0.5" />Conforme</Badge>
                                : <Badge className="bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30 text-[10px]"><AlertTriangle size={10} className="mr-0.5" />Anomalie</Badge>}
                              <span className="text-xs text-[#7a8f80]">{c.createdAt ? new Date(c.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </p>
                            {c.observations && <p className="text-xs text-[#7a8f80] italic mt-0.5">{c.observations}</p>}
                          </div>
                          <div className="flex gap-1">
                            {CHECK_ITEMS.map(i => (
                              <span key={i.key} title={i.label} className="h-2 w-2 rounded-full" style={{ background: c[i.key] ? '#0f9d70' : '#C0392B' }} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'pannes' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench size={13} /> Pannes, réparations & pièces ({pannes.length})
                </h4>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setShowEvent('panne')}><AlertTriangle size={12} /> Déclarer panne</Button>
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setShowEvent('reparation')}><Wrench size={12} /> Réparation</Button>
                </div>
              </div>
              {pannes.length === 0 ? (
                <p className="text-xs text-[#7a8f80]/60">Aucune panne ni réparation enregistrée.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {pannes.map((e: any) => (
                    <div key={e.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm flex items-center gap-1.5">
                          <Badge className={EVENT_BADGES[e.type] ?? 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25] text-[10px]'}>{EVENT_LABELS[e.type] ?? e.type}</Badge>
                          <span className="text-xs text-[#7a8f80]">{fmtDate(e.eventDate)}{e.odometerKm ? ` · ${fmtNum(e.odometerKm)} km` : ''}</span>
                        </p>
                        {(e.description || e.parts?.length > 0) && (
                          <p className="text-xs text-[#7a8f80] mt-0.5 truncate">
                            {e.description}{e.parts?.length ? ` — pièces : ${e.parts.map((p: any) => p.designation).join(', ')}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {Number(e.cost) > 0 && <span className="text-xs text-[#e8ede9] tabular-nums">{fmtNum(e.cost)} F</span>}
                        {e.type === 'reparation' && e.status !== 'terminee' && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-[#0f9d70]" onClick={() => repairStatusMut.mutate({ eventId: e.id, status: 'terminee' })}>
                            <Check size={10} /> terminée
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'carburant' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-[#7a8f80] uppercase tracking-wide flex items-center gap-1.5">
                  <Fuel size={13} /> Pleins de carburant ({fuels.length})
                </h4>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setShowEvent('carburant')}><Fuel size={12} /> Enregistrer un plein</Button>
              </div>
              {fuels.length === 0 ? (
                <p className="text-xs text-[#7a8f80]/60">Aucun plein enregistré.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {fuels.map((e: any) => (
                    <div key={e.id} className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-[#e8ede9]">{fmtDate(e.eventDate)}{e.odometerKm ? ` · ${fmtNum(e.odometerKm)} km` : ''}</p>
                        {e.provider && <p className="text-[10px] text-[#7a8f80]">{e.provider}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm text-[#e8ede9] tabular-nums">{e.liters ? fmtNum(e.liters) + ' L' : '—'}</p>
                        <p className="text-xs text-[#7a8f80] tabular-nums">{fmtNum(e.cost)} F</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'couts' && costs && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
                  <p className="text-[10px] text-[#7a8f80] mb-1">Coût total</p>
                  <p className="text-lg font-bold text-[#C0392B] tabular-nums">{fmtNum(costs.totalCost)} F</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
                  <p className="text-[10px] text-[#7a8f80] mb-1">Carburant</p>
                  <p className="text-lg font-bold text-[#D9822B] tabular-nums">{fmtNum(costs.totalLiters)} L</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
                  <p className="text-[10px] text-[#7a8f80] mb-1">Pannes</p>
                  <p className="text-lg font-bold text-[#e8ede9]">{costs.byType?.panne?.count ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-center">
                  <p className="text-[10px] text-[#7a8f80] mb-1">Réparations</p>
                  <p className="text-lg font-bold text-[#e8ede9]">{costs.byType?.reparation?.count ?? 0}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {Object.entries(costs.byType ?? {}).map(([type, v]: any) => (
                  <div key={type} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-[#1e2e25] bg-[#0a0f0d]">
                    <span className="text-[#e8ede9]">{EVENT_LABELS[type] ?? type} <span className="text-xs text-[#7a8f80]">×{v.count}</span></span>
                    <span className="text-[#e8ede9] tabular-nums">{fmtNum(v.total)} F</span>
                  </div>
                ))}
                {Object.keys(costs.byType ?? {}).length === 0 && <p className="text-xs text-[#7a8f80]/60">Aucun coût enregistré.</p>}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ChecklistModal open={showCheck} onClose={() => setShowCheck(false)} loading={checkMut.loading} onSubmit={d => checkMut.mutate(d)} />
      <AddDocModal open={showDoc} onClose={() => setShowDoc(false)} loading={docMut.loading} onSubmit={d => docMut.mutate(d)} />
      <VehicleEventModal open={showEvent} onClose={() => setShowEvent(null)} loading={eventMut.loading}
        onSubmit={data => eventMut.mutate({ ...data })} odometer={vehicle.kilometrage} />
    </>
  );
}

const EVENT_LABELS: Record<string, string> = { panne: 'Panne', reparation: 'Réparation', piece: 'Pièce', carburant: 'Carburant' };
const EVENT_BADGES: Record<string, string> = {
  panne: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30',
  reparation: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30',
  piece: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30',
};

/* ═════════════════ ÉVÉNEMENT VÉHICULE (panne/réparation/carburant) ═════════════════ */
function VehicleEventModal({ open, onClose, loading, onSubmit, odometer }: {
  open: string | null; onClose: () => void; loading: boolean; onSubmit: (d: any) => void; odometer: number;
}) {
  const [f, setF] = useState({
    eventDate: new Date().toISOString().slice(0, 10),
    odometerKm: '', cost: '', liters: '', provider: '', description: '',
  });
  useEffect(() => { if (open) setF(p => ({ ...p, odometerKm: String(odometer ?? '') })); }, [open]);
  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type: open,
      eventDate: f.eventDate,
      odometerKm: f.odometerKm !== '' ? Number(f.odometerKm) : undefined,
      cost: f.cost !== '' ? Number(f.cost) : undefined,
      liters: open === 'carburant' && f.liters !== '' ? Number(f.liters) : undefined,
      provider: f.provider || undefined,
      description: f.description || undefined,
    });
  };

  return (
    <Modal open={!!open} onClose={onClose} title={open === 'carburant' ? 'Enregistrer un plein' : open === 'panne' ? 'Déclarer une panne' : 'Enregistrer une réparation'}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date *" type="date" value={f.eventDate} onChange={e => setF({ ...f, eventDate: e.target.value })} required />
          <Input label="Compteur (km)" type="number" value={f.odometerKm} onChange={e => setF({ ...f, odometerKm: e.target.value })} />
          {open === 'carburant' && <Input label="Litres" type="number" step="0.01" value={f.liters} onChange={e => setF({ ...f, liters: e.target.value })} placeholder="45.5" />}
          <Input label="Coût (FCFA)" type="number" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} placeholder="15000" />
        </div>
        <Input label={open === 'carburant' ? 'Station' : 'Garage / fournisseur'} value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })} />
        <Textarea label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2}
          placeholder={open === 'panne' ? 'Crevaison pneu avant droit…' : open === 'carburant' ? 'Plein route Mbour' : "Remplacement plaquettes + main d'œuvre…"} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}


function ChecklistModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean; onSubmit: (d: any) => void;
}) {
  const [state, setState] = useState<Record<string, boolean>>(Object.fromEntries(CHECK_ITEMS.map(i => [i.key, true])));
  const [obs, setObs] = useState('');
  const [photo, setPhoto] = useState('');

  useEffect(() => { if (open) { setState(Object.fromEntries(CHECK_ITEMS.map(i => [i.key, true]))); setObs(''); setPhoto(''); } }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Check de prise de poste — 15 secondes">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        onSubmit({ ...state, observations: obs || undefined, photoUrl: photo || undefined });
      }}>
        <p className="text-xs text-[#7a8f80]">Effectué au démarrage de la première mission du jour — les 6 points doivent être conformes.</p>
        <div className="grid grid-cols-2 gap-2">
          {CHECK_ITEMS.map(i => (
            <button key={i.key} type="button" onClick={() => setState(p => ({ ...p, [i.key]: !p[i.key] }))}
              className={
                'rounded-lg border p-2.5 text-left text-sm transition-all flex items-center gap-2 ' +
                (state[i.key] ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#C0392B]/50 bg-[#C0392B]/[0.06] text-[#C0392B]')
              }>
              {state[i.key] ? <Check size={14} strokeWidth={3} /> : <X size={14} />}
              {i.label}
            </button>
          ))}
        </div>
        <Textarea label="Observations" value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Anomalie constatée…" />
        <FileDropzone category="vehicles" value={photo} onChange={setPhoto} label="Photo du check" accept="image/*" />
        <Input label="URL photo (optionnel)" value={photo} onChange={e => setPhoto(e.target.value)} placeholder="https://… ou /uploads/…" />
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddDocModal({ open, onClose, loading, onSubmit }: {
  open: boolean; onClose: () => void; loading: boolean; onSubmit: (d: any) => void;
}) {
  const [f, setF] = useState<Record<string, any>>({ docType: 'carte_grise', fileUrl: '', expirationDate: '' });
  useEffect(() => { if (open) setF({ docType: 'carte_grise', fileUrl: '', expirationDate: '' }); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un document">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        onSubmit({ docType: f.docType, fileUrl: f.fileUrl, expirationDate: f.expirationDate || undefined });
      }}>
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Type de document</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DOC_LABELS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setF({ ...f, docType: k })}
                className={'rounded-lg border p-2.5 text-sm transition-all ' + (f.docType === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <FileDropzone category="vehicles" value={f.fileUrl} onChange={url => setF({ ...f, fileUrl: url })} label="Uploader le document" />
        <Input label="URL du fichier (optionnel)" value={f.fileUrl} onChange={e => setF({ ...f, fileUrl: e.target.value })} placeholder="https://… ou /uploads/…" />
        <Input label="Date d'expiration" type="date" value={f.expirationDate} onChange={e => setF({ ...f, expirationDate: e.target.value })} />
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading || !f.fileUrl}>{loading && <Loader2 size={14} className="animate-spin" />} Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditVehicleModal({ vehicle, onClose, onDone }: { vehicle: any | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({});
  const { data: teams } = useQuery(() => teamsService.list(), [], { immediate: !!vehicle });
  const teamsList = Array.isArray(teams) ? teams : [];

  useEffect(() => {
    if (vehicle) {
      setF({
        immatriculation: vehicle.immatriculation ?? '',
        modele: vehicle.modele ?? '',
        teamId: vehicle.teamId ?? '',
        kilometrage: vehicle.kilometrage ?? 0,
        status: vehicle.status ?? 'disponible',
        insuranceExpiration: vehicle.insuranceExpiration?.slice?.(0, 10) ?? '',
        technicalInspectionExpiration: vehicle.technicalInspectionExpiration?.slice?.(0, 10) ?? '',
      });
    }
  }, [vehicle]);

  const mut = useMutation((d: any) => vehiclesService.update(vehicle.id, d), {
    onSuccess: () => { toast({ title: 'Véhicule mis à jour', variant: 'success' }); onDone(); },
    onError: (e: any) => toast({ title: 'Mise à jour impossible', description: e.message, variant: 'error' }),
  });

  if (!vehicle) return null;

  return (
    <Modal open={!!vehicle} onClose={onClose} title={`Modifier — ${vehicle.immatriculation}`}>
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        const payload: any = {
          immatriculation: f.immatriculation,
          kilometrage: Number(f.kilometrage) || 0,
          status: f.status || undefined,
        };
        if (f.modele) payload.modele = f.modele;
        payload.teamId = f.teamId || null;
        if (f.insuranceExpiration) payload.insuranceExpiration = f.insuranceExpiration;
        if (f.technicalInspectionExpiration) payload.technicalInspectionExpiration = f.technicalInspectionExpiration;
        mut.mutate(payload);
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Immatriculation *" value={f.immatriculation ?? ''} onChange={e => setF({ ...f, immatriculation: e.target.value })} required />
          <Input label="Modèle" value={f.modele ?? ''} onChange={e => setF({ ...f, modele: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Kilométrage" type="number" min={0} value={f.kilometrage ?? 0} onChange={e => setF({ ...f, kilometrage: e.target.value })} />
          <Input label="Assurance (exp.)" type="date" value={f.insuranceExpiration ?? ''} onChange={e => setF({ ...f, insuranceExpiration: e.target.value })} />
          <Input label="Visite tech. (exp.)" type="date" value={f.technicalInspectionExpiration ?? ''} onChange={e => setF({ ...f, technicalInspectionExpiration: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Équipe affectée</p>
            <select value={f.teamId ?? ''} onChange={e => setF({ ...f, teamId: e.target.value })}
              className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
              <option value="">— Aucune —</option>
              {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-[#7a8f80] mb-1.5">Statut</p>
            <select value={f.status ?? ''} onChange={e => setF({ ...f, status: e.target.value })}
              className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
              <option value="disponible">disponible</option>
              <option value="en_mission">en_mission</option>
              <option value="en_panne">en_panne</option>
              <option value="hors_service">hors_service</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateVehicleModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({ immatriculation: '', modele: '', teamId: '', kilometrage: 0, insuranceExpiration: '', technicalInspectionExpiration: '' });
  const { data: teams } = useQuery(() => teamsService.list(), [], { immediate: open });
  const teamsList = Array.isArray(teams) ? teams : [];

  const mut = useMutation((d: any) => vehiclesService.create(d), {
    onSuccess: () => { toast({ title: 'Véhicule créé', variant: 'success' }); onClose(); onDone(); },
    onError: (e: any) => toast({ title: 'Création impossible', description: e.message, variant: 'error' }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un véhicule">
      <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        const payload: any = { immatriculation: f.immatriculation, kilometrage: Number(f.kilometrage) || 0 };
        if (f.modele) payload.modele = f.modele;
        if (f.teamId) payload.teamId = f.teamId;
        if (f.insuranceExpiration) payload.insuranceExpiration = f.insuranceExpiration;
        if (f.technicalInspectionExpiration) payload.technicalInspectionExpiration = f.technicalInspectionExpiration;
        mut.mutate(payload);
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Immatriculation *" value={f.immatriculation} onChange={e => setF({ ...f, immatriculation: e.target.value })} required placeholder="DK-1234-AB" />
          <Input label="Modèle" value={f.modele} onChange={e => setF({ ...f, modele: e.target.value })} placeholder="Mercedes Sprinter" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Kilométrage" type="number" min={0} value={f.kilometrage} onChange={e => setF({ ...f, kilometrage: e.target.value })} />
          <Input label="Assurance (exp.)" type="date" value={f.insuranceExpiration} onChange={e => setF({ ...f, insuranceExpiration: e.target.value })} />
          <Input label="Visite tech. (exp.)" type="date" value={f.technicalInspectionExpiration} onChange={e => setF({ ...f, technicalInspectionExpiration: e.target.value })} />
        </div>
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Équipe affectée</p>
          <select value={f.teamId} onChange={e => setF({ ...f, teamId: e.target.value })}
            className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-3 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
            <option value="">— Aucune —</option>
            {teamsList.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Créer</Button>
        </div>
      </form>
    </Modal>
  );
}
