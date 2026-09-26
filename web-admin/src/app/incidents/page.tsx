'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Modal, Input, Select, Textarea, useToast, Pager, usePagination } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { useDebounced } from '@/hooks/use-debounced';
import { incidentsService } from '@/services';
import {
  AlertTriangle, Plus, Search, Loader2, ArrowRight, MapPin, Users,
  Radio, Boxes, Construction, RadioTower, FileSpreadsheet, Upload, Check,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  signalement: { label: 'Signalé', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  en_cours: { label: 'En cours', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  en_attente: { label: 'En attente', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  corrige: { label: 'Corrigé', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  cloture: { label: 'Clôturé', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
};
const SEV_META: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: 'Critique', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  MAJEUR: { label: 'Majeur', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
  MINEUR: { label: 'Mineur', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  INFORMATION: { label: 'Info', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
};
const RUBRIQUE_META: Record<string, { label: string; icon: any }> = {
  PBO: { label: 'PBO', icon: Boxes },
  PIO: { label: 'PIO', icon: RadioTower },
  CHAMBRE: { label: 'Chambre', icon: Construction },
};
const PBO_DEFAUTS = ['DESORGANISE', 'SANS_COUVERCLE', 'ENDOMAGE', 'CABLE_DESORDRE'];
const PIO_TYPES = ['POTEAU_SIMPLE', 'POTEAU_MOISE', 'CABLE', 'ACCESSOIRE'];
const PIO_ETATS = ['DEBOUT', 'INCLINE', 'A_TERRE', 'CASSE'];
const CHAMBRE_TYPES = ['L2T', 'L3T', 'L5T', 'L6T'];
const CHAMBRE_ETATS = ['ACCESSIBLE', 'BOUCHEE', 'ENDOMAGEE', 'INONDEE'];
const SEVERITIES = ['CRITICAL', 'MAJEUR', 'MINEUR', 'INFORMATION'];

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const router = useRouter();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [rubriqueFilter, setRubriqueFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const doExport = async (rubrique: 'pbo' | 'poi' | 'chambre') => {
    try {
      const blob = await incidentsService.exportRubrique(rubrique);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rubrique.toUpperCase()}-${new Date().toISOString().slice(0, 7)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `Export ${rubrique.toUpperCase()} généré`, description: 'Fichier au format SONATEL, prêt à envoyer.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e.message, variant: 'error' });
    }
  };

  const onPboFile = async (file?: File) => {
    if (!file) return;
    try {
      const prev: any = await incidentsService.pboPreview(file);
      const nouveaux = (prev.rows ?? []).filter((r: any) => !r.exists);
      if (nouveaux.length === 0) {
        toast({ title: 'Rien à importer', description: 'Tous ces PBO sont déjà enregistrés.', variant: 'info' });
        return;
      }
      const res: any = await incidentsService.pboConfirm(nouveaux, prev.fileName);
      toast({ title: `${res.created} incident(s) PBO créé(s)`, description: 'Générez les missions Changement PBO depuis chaque incident (6 500 F).', variant: 'success' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Import PBO impossible', description: e.message, variant: 'error' });
    }
  };

  const q = useDebounced(search.trim());
  const pager = usePagination(50, `${statusFilter}|${rubriqueFilter}|${q}`);

  const { data, loading, refetch: refetchPage } = useQuery(
    () => incidentsService.page({
      status: statusFilter || undefined,
      rubrique: rubriqueFilter || undefined,
      search: q || undefined,
      ...pager.params,
    }),
    [statusFilter, rubriqueFilter, q, pager.offset, pager.limit],
  );
  const { data: counters, refetch: refetchStats } = useQuery(() => incidentsService.stats(), []);
  const refetch = () => { refetchPage(); refetchStats(); };
  const list: any[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const byStatus = counters?.byStatus ?? {};
  const stats = [
    { label: 'Critiques', value: counters?.bySeverity?.CRITICAL ?? 0, color: 'text-[#C0392B]' },
    { label: 'En cours', value: byStatus.en_cours ?? 0, color: 'text-[#5b8def]' },
    { label: 'En attente', value: (byStatus.signalement ?? 0) + (byStatus.en_attente ?? 0), color: 'text-[#f5a623]' },
    { label: 'Résolus', value: (byStatus.corrige ?? 0) + (byStatus.cloture ?? 0), color: 'text-[#0f9d70]' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#D9822B]/10 text-[#D9822B]"><AlertTriangle size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Incidents réseau</h1>
            <p className="text-xs text-[#7a8f80]">PBO · PIO · Chambre — signalement à clôture, rapport PDF</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => doExport('pbo')}><FileSpreadsheet size={14} /> PBO</Button>
          <Button variant="outline" size="sm" onClick={() => doExport('poi')}><FileSpreadsheet size={14} /> PIO</Button>
          <Button variant="outline" size="sm" onClick={() => doExport('chambre')}><FileSpreadsheet size={14} /> Chambre</Button>
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#1e2e25] bg-[#111916] text-sm text-[#e8ede9] cursor-pointer hover:border-[#0f9d70]/40 transition-colors">
            <Upload size={14} /> Importer PBO à changer
            <input type="file" accept=".xlsx" className="hidden" onChange={e => onPboFile(e.target.files?.[0])} />
          </label>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Signaler un incident</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-[#7a8f80] mb-1">{s.label}</p>
            <p className={'text-2xl font-bold ' + s.color}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Par rubrique */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(RUBRIQUE_META).map(([k, m]) => {
          const count = counters?.byRubrique?.[k] ?? 0;
          const Icon = m.icon;
          return (
            <Card key={k} className="p-3 flex items-center gap-3">
              <span className="p-2 rounded-lg bg-[#1a2420] text-[#7a8f80]"><Icon size={16} /></span>
              <div>
                <p className="text-sm font-semibold text-[#e8ede9]">{m.label}</p>
                <p className="text-xs text-[#7a8f80]">{count} incident(s)</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
          <input type="text" placeholder="Rechercher (n°, zone, description)…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
        </div>
        <Select value={rubriqueFilter} onChange={e => setRubriqueFilter(e.target.value)} className="w-36">
          <option value="">Toutes rubriques</option>
          {Object.entries(RUBRIQUE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
      </div>

      {/* Liste */}
      {loading && !data ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
          <AlertTriangle size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
          <p className="text-sm text-[#7a8f80] mb-4">{q || statusFilter || rubriqueFilter ? 'Aucun incident ne correspond aux filtres.' : 'Aucun incident'}</p>
          <Button onClick={() => setShowCreate(true)}><Plus size={15} /> Signaler un incident</Button>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#7a8f80]">{total.toLocaleString('fr-FR')} incident(s)</p>
          {list.map((inc: any) => {
            const st = STATUS_META[inc.status] ?? { label: inc.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
            const sv = SEV_META[inc.severity] ?? SEV_META.INFORMATION;
            const rm = RUBRIQUE_META[inc.rubrique];
            const Icon = rm?.icon ?? Radio;
            return (
              <Card key={inc.id} className="border-[#1e2e25] bg-[#111916] p-4 hover:border-[#0f9d70]/30 transition-all cursor-pointer"
                onClick={() => router.push('/incidents/' + inc.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="p-2 rounded-lg bg-[#1a2420] text-[#7a8f80] shrink-0"><Icon size={16} /></span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-[#e8ede9]">{inc.incidentNumber}</span>
                        <Badge className={sv.cls}>{sv.label}</Badge>
                        <Badge className={st.cls}>{st.label}</Badge>
                      </div>
                      <p className="text-sm text-[#e8ede9] truncate mt-1">{inc.description ?? inc.pboReference ?? inc.rubrique}</p>
                      <div className="flex items-center gap-3 text-xs text-[#7a8f80] mt-1">
                        <span className="inline-flex items-center gap-1"><MapPin size={11} /> {inc.zone}</span>
                        {inc.clientsImpacted > 0 && <span className="inline-flex items-center gap-1"><Users size={11} /> {inc.clientsImpacted} client(s)</span>}
                        <span>{fmtDate(inc.reportedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-[#7a8f80] shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
          <Pager className="rounded-lg border border-[#1e2e25] bg-[#111916]" total={total} offset={pager.offset} limit={pager.limit}
            onChange={pager.setOffset} onLimitChange={pager.setLimit} />
        </div>
      )}

      <CreateIncidentModal open={showCreate} onClose={() => setShowCreate(false)} onDone={refetch} />
    </div>
  );
}

/* ═════════════════ SIGNALEMENT ═════════════════ */
function CreateIncidentModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, any>>({
    rubrique: 'PBO', zone: '', olt: '', description: '', severity: 'MINEUR',
    clientsImpacted: 0, address: '',
    pboReference: '', pboDefaut: 'DESORGANISE',
    pioType: 'POTEAU_SIMPLE', pioEtat: 'A_TERRE',
    chambreType: 'L2T', chambreEtat: 'BOUCHEE',
  });

  const mut = useMutation((d: any) => incidentsService.create(d), {
    onSuccess: (inc: any) => { toast({ title: 'Incident signalé', description: inc?.incidentNumber ?? '', variant: 'success' }); onClose(); onDone(); },
    onError: (e: any) => toast({ title: 'Signalement impossible', description: e.message, variant: 'error' }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { rubrique: f.rubrique, zone: f.zone, severity: f.severity, clientsImpacted: Number(f.clientsImpacted) || 0 };
    if (f.description) payload.description = f.description;
    if (f.olt) payload.olt = f.olt;
    if (f.address) payload.address = f.address;
    if (f.rubrique === 'PBO') {
      if (f.pboReference) payload.pboReference = f.pboReference;
      payload.pboDefaut = f.pboDefaut;
    } else if (f.rubrique === 'PIO') {
      payload.pioType = f.pioType;
      payload.pioEtat = f.pioEtat;
    } else {
      payload.chambreType = f.chambreType;
      payload.chambreEtat = f.chambreEtat;
    }
    mut.mutate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title="Signaler un incident" size="lg">
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Rubrique *</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(RUBRIQUE_META).map(([k, m]) => {
              const Icon = m.icon;
              return (
                <button key={k} type="button" onClick={() => setF({ ...f, rubrique: k })}
                  className={'rounded-lg border p-3 text-center transition-all ' + (f.rubrique === k ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
                  <Icon size={16} className="mx-auto mb-1" />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {f.rubrique === 'PBO' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Référence PBO" value={f.pboReference} onChange={e => setF({ ...f, pboReference: e.target.value })} placeholder="B18 PBO13" />
            <Select label="Défaut *" value={f.pboDefaut} onChange={e => setF({ ...f, pboDefaut: e.target.value })}>
              {PBO_DEFAUTS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        )}
        {f.rubrique === 'PIO' && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type *" value={f.pioType} onChange={e => setF({ ...f, pioType: e.target.value })}>
              {PIO_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select label="État *" value={f.pioEtat} onChange={e => setF({ ...f, pioEtat: e.target.value })}>
              {PIO_ETATS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        )}
        {f.rubrique === 'CHAMBRE' && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type *" value={f.chambreType} onChange={e => setF({ ...f, chambreType: e.target.value })}>
              {CHAMBRE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select label="État *" value={f.chambreEtat} onChange={e => setF({ ...f, chambreEtat: e.target.value })}>
              {CHAMBRE_ETATS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Zone ops *" value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })} required placeholder="Mbour" />
          <Input label="OLT" value={f.olt} onChange={e => setF({ ...f, olt: e.target.value })} placeholder="O_GMB" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Degré d'urgence *" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}>
            {SEVERITIES.map(s => <option key={s} value={s}>{SEV_META[s].label}</option>)}
          </Select>
          <Input label="Clients impactés" type="number" min={0} value={f.clientsImpacted} onChange={e => setF({ ...f, clientsImpacted: e.target.value })} />
        </div>
        <Textarea label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={3}
          placeholder="Câble 5/99 coupé côté PC + 02 câbles 14p à terre…" />

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mut.loading || !f.zone}>{mut.loading && <Loader2 size={14} className="animate-spin" />} Signaler</Button>
        </div>
      </form>
    </Modal>
  );
}
