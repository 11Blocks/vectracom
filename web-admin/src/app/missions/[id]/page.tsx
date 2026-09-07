'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, Select, Textarea, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { missionsService, stockService, siteChecklistService } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import {
  ArrowLeft, Loader2, FileDown, ShieldCheck, CheckCircle2, XCircle, Lock,
  HardHat, MapPin, Gauge, Camera, Package, Flag, Plus, Trash2, Save, Ban,
  Building2, AlertTriangle, Check, Clock, ClipboardList, Wallet, Layers,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  planifiee: { label: 'Planifiée', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  en_cours: { label: 'En cours', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  terminee: { label: 'Terminée', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30' },
  validee: { label: 'Validée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  rejetee: { label: 'Rejetée', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  a_completer: { label: 'À compléter', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
};
const EPI_ITEMS = ['casque', 'gants', 'chaussures', 'gilet', 'harnais', 'balisage'];
const DBM_THRESHOLD = -25;

/** Motifs d'échec enrichis (cahier des charges — 7 motifs normalisés). */
const SAV_ACTIONS = [
  { value: 'reprise_soudure_pto', label: 'Reprise soudure au PTO' },
  { value: 'reprise_soudure_pbo', label: 'Reprise soudure au PBO' },
  { value: 'reprise_soudure_bti', label: 'Reprise soudure au BTI' },
  { value: 'reprise_soudure_bpe', label: 'Reprise soudure au BPE' },
  { value: 'pigtail_change', label: 'Pigtail changé' },
  { value: 'connecteur_change', label: 'Connecteur changé (PBO/PTO)' },
  { value: 'jarretiere_change', label: 'Jarretière optique changée' },
  { value: 'modem_change', label: 'Modem changé' },
  { value: 'cable_1083_change', label: 'Câble 1083 changé / repris' },
  { value: 'reconfig_ont', label: 'Reconfiguration ONT/modem' },
  { value: 'boitier_alim_change', label: "Boîtier d'alimentation changé" },
  { value: 'cable_alim_change', label: "Câble d'alimentation changé" },
  { value: 'pose_piton', label: 'Pose de piton + normalisation' },
  { value: 'lovage_pto', label: 'Normalisation lovage PTO' },
  { value: 'tirage_cable', label: 'Reprise tirage câble' },
  { value: 'abs_pbo_traitement', label: 'ABS au PBO traité' },
  { value: 'signal_corrige', label: 'Signal hors norme corrigé' },
];
const SAV_OUTCOMES = [
  { value: 'RELEVE', label: 'Relevé (dépannage réalisé)' },
  { value: 'REOR', label: 'Réorientation (abs signal/technique)' },
  { value: 'DEPLACEMENT', label: 'Déplacement (sans relève)' },
];

const FAILURE_REASONS = [
  { value: 'client_absent', label: 'Client absent' },
  { value: 'pbo_sature', label: 'PBO saturé' },
  { value: 'genie_civil_bloque', label: 'Génie civil bloqué' },
  { value: 'rupture_poteau', label: 'Rupture de poteau' },
  { value: 'attente_validation_ci', label: 'Attente validation CI' },
  { value: 'client_injoignable', label: 'Client injoignable' },
  { value: 'desistement_client', label: 'Désistement client' },
];

const PHOTO_LABELS: Record<string, string> = {
  photoSiteUrl: 'Photo du site', photoPboInteriorUrl: 'PBO intérieur', photoPboClosedUrl: 'PBO fermé', photoPtoModemUrl: 'PTO / modem',
  photoAvant: 'Avant travaux', photoPendant: 'Pendant travaux', photoApres: 'Après travaux',
  photoDepart: 'Photo départ', photoArrivee: "Photo arrivée", photoTravaux: 'Photos travaux',
  photoPoteauPlante: 'Poteau planté', 'photoTracé': 'Tracé GPS', photoInfrastructure: 'Infrastructures',
};
const STANDARD_PHOTO_KEYS = new Set(['photoSiteUrl', 'photoPboInteriorUrl', 'photoPboClosedUrl', 'photoPtoModemUrl']);

const STEP_ICONS: Record<string, any> = { shield: HardHat, 'map-pin': MapPin, wrench: Gauge, camera: Camera, package: Package, 'check-circle': Flag };
/** Champs gérés nativement par les endpoints fixes (≠ champs dynamiques du template). */
const FIXED_FIELD_IDS = new Set([
  'interventionType', 'equipmentCode', 'gps', 'initialEquipmentState', 'actionRealized', 'dbmMeasurement',
  'sstChecklist', 'sstPhotoUrl', 'materialsConsumed', 'exchangeSav', 'fieldStatus', 'failureReason',
  'observations', 'signatureTechnicianUrl', 'signatureClientUrl',
]);

const RECETTE_META: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
  en_cours: { label: 'En cours', cls: 'bg-[#5b8def]/20 text-[#5b8def] border-[#5b8def]/30' },
  acceptee: { label: 'Acceptée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
  reserves: { label: 'Avec réserves', cls: 'bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30' },
  rejetee: { label: 'Rejetée', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
};

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
const fmtFCFA = (n: unknown) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR') + ' F');

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState<number>(1);

  const { data, loading, refetch } = useQuery(() => missionsService.get(String(id)), [id]);
  const m = data;
  const { data: tpl } = useQuery(() => (m ? missionsService.template(m.typeTache) : Promise.resolve(null)), [!!m, m?.typeTache]);
  const { data: stockItems } = useQuery(() => stockService.listItems(), []);
  const { data: priceItemsData } = useQuery(() => stockService.listPriceItems({ isActive: 'true' }), []);
  const items = Array.isArray(stockItems) ? stockItems : [];
  const priceItems = useMemo(() => (Array.isArray(priceItemsData) ? priceItemsData : (priceItemsData?.items ?? [])), [priceItemsData]);
  const { data: sheet, refetch: refetchSheet } = useQuery(
    () => (m ? siteChecklistService.forMission(String(id)) : Promise.resolve(null)),
    [!!m, String(id)],
  );

  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vectracom_user') || 'null') : null;
  const canValidate = user && ['admin', 'direction', 'super_admin', 'finance_admin', 'support_admin'].includes(user.role);

  const stepMut = useMutation(
    ({ step, body }: { step: number | 'data'; body: any }) => missionsService.saveStep(String(id), step, body),
    {
      onSuccess: () => { toast({ title: 'Étape enregistrée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Étape refusée', description: e.message, variant: 'error' }),
    },
  );
  const dataMut = useMutation(
    ({ data, priceItemsUsed }: { data: Record<string, unknown>; priceItemsUsed?: any[] }) =>
      missionsService.saveStepData(String(id), data, priceItemsUsed),
    {
      onSuccess: () => { toast({ title: 'Données du template enregistrées', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Enregistrement refusé', description: e.message, variant: 'error' }),
    },
  );
  const validateMut = useMutation(
    (status: 'validee' | 'rejetee') => missionsService.validate(String(id), status),
    {
      onSuccess: () => { toast({ title: 'Décision enregistrée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );
  const sonatelMut = useMutation(
    (status: 'approuve' | 'rejete') => missionsService.sonatelApprove(String(id), status),
    {
      onSuccess: () => { toast({ title: 'Approbation SONATEL enregistrée', variant: 'success' }); refetch(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const downloadPv = async () => {
    try {
      const blob = await missionsService.pvRecette(String(id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      toast({ title: 'Génération impossible', description: e.message, variant: 'error' });
    }
  };

  if (loading) return <Skeleton className="h-64" />;
  if (!m) return <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center"><p className="text-sm text-[#7a8f80]">Mission introuvable</p></Card>;

  const fr = m.fieldReport ?? {};
  const meta = STATUS_META[m.status] ?? { label: m.status, cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' };
  const sstDone = !!fr.sstValidatedAt;
  const clientFinal = tpl?.clientFinal ?? true;

  // Étapes pilotées par le template : numéro d'étape dérivé de l'id (step{n}_…).
  const tplSteps = (tpl?.steps ?? []) as Array<{ id: string; label: string; icon: string; hint?: string; fields?: any[]; blocking?: boolean }>;
  const stepsByNum = new Map<number, any>();
  for (const s of tplSteps) {
    const n = Number(s.id?.match(/^step(\d)_/)?.[1] ?? 0);
    if (n >= 1 && n <= 6) stepsByNum.set(n, s);
  }
  const hasMateriel = stepsByNum.has(5);
  const stepNumbers = [1, 2, 3, 4, ...(hasMateriel ? [5] : []), 6];
  const DEFAULT_STEP_LABELS: Record<number, string> = {
    1: 'Sécurité SST', 2: 'Identification', 3: 'Technique', 4: 'Photos', 5: 'Matériel', 6: 'Clôture',
  };
  const stepLabel = (n: number) => stepsByNum.get(n)?.label ?? DEFAULT_STEP_LABELS[n];

  const stepDone = (n: number): boolean => {
    switch (n) {
      case 1: return sstDone;
      case 2: return !!fr.identificationAt;
      case 3: return !!fr.techniqueAt;
      case 4: return !!fr.photosAt;
      case 5: return !!fr.materielAt;
      case 6: return !!fr.fieldStatus;
      default: return false;
    }
  };
  const firstIncomplete = stepNumbers.find(n => !stepDone(n)) ?? 6;

  const saveFixed = (step: number, body: any) => stepMut.mutate({ step, body });

  return (
    <div className="space-y-4 max-w-6xl">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => router.push('/missions')} className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-2">
            <ArrowLeft size={15} /> Retour aux missions
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-[#e8ede9]">{m.clientSite}</h1>
            <Badge className={meta.cls}>{meta.label}</Badge>
            <Badge className="bg-[#0f9d70]/10 text-[#7a8f80] border-[#1e2e25]">{tpl?.label ?? m.typeTache}</Badge>
            {m.sonatelDossierNumber && <Badge className="font-mono bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30">#{m.sonatelDossierNumber}</Badge>}
          </div>
          <p className="text-sm text-[#7a8f80] mt-1">
            {m.typeTache}{m.zone ? ` · ${m.zone}` : ''} · {fmtDate(m.dateMission)}
            {m.importMeta?.teamLabel ? ` · ${m.importMeta.teamLabel}` : ''}
            {!clientFinal && ' · sans client final'}
            {m.coper ? ` · COPER ${m.coper}` : ''}
            {m.vaCap ? ` · VA CAP ${m.vaCap}` : ''}
            {m.piloteSonatel ? ` · pilote ${m.piloteSonatel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadPv}><FileDown size={15} /> PV de réception</Button>
          {canValidate && fr.internalValidationStatus === 'en_attente' && fr.fieldStatus && (
            <>
              <Button onClick={() => validateMut.mutate('validee')} disabled={validateMut.loading}>
                {validateMut.loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Valider
              </Button>
              <Button variant="danger" onClick={() => validateMut.mutate('rejetee')} disabled={validateMut.loading}>
                <XCircle size={14} /> Rejeter
              </Button>
            </>
          )}
          {canValidate && fr.internalValidationStatus === 'validee' && fr.sonatelApprovalStatus === 'en_attente' && (
            <>
              <Button onClick={() => sonatelMut.mutate('approuve')} disabled={sonatelMut.loading}>
                {sonatelMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />} Approbation SONATEL
              </Button>
              <Button variant="danger" onClick={() => sonatelMut.mutate('rejete')} disabled={sonatelMut.loading}>
                <Ban size={14} /> Rejet SONATEL
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Infos + workflow ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-[#1e2e25] bg-[#111916] p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#e8ede9] mb-1">Informations mission</h3>
          <p className="text-xs text-[#7a8f80] mb-3">{tpl?.description ?? '—'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['Client', m.clientSite], ['Tâche', m.typeTache], ['Zone ops', m.zone ?? '—'],
              ['Date', fmtDate(m.dateMission)], ['N° dossier', m.sonatelDossierNumber ?? '—'],
              ['Équipe', m.importMeta?.teamLabel ?? m.team?.name ?? '—'],
              ['OLT', m.sonatelOlt ?? '—'], ['Produit', m.sonatelProduit ?? '—'],
              ['SR/Plaque', m.srPlaque ?? '—'], ['Segment', m.segment ?? '—'],
              ['AGE', m.ageDays != null ? `${m.ageDays} j` : '—'], ['NBSI', String(m.nbsi ?? 0)],
              ['GPS', m.gpsEasyWork ?? '—'],
              ['Blocage', m.blocageMotif ? (m.blocageMotif.length > 40 ? m.blocageMotif.slice(0, 40) + '…' : m.blocageMotif) : '—'],
              ['Techniciens', (m.importMeta?.technicians ?? []).join(', ') || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-[#7a8f80]">{k}</p>
                <p className="text-[#e8ede9] mt-0.5 truncate" title={String(v)}>{v}</p>
              </div>
            ))}
          </div>
          {tpl?.requiredPhotos?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-[#1e2e25]/60">
              <span className="text-xs text-[#7a8f80] mr-1">Photos attendues :</span>
              {tpl.requiredPhotos.map((p: any) => (
                <Badge key={p.type} className="bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]">
                  <Camera size={10} className="mr-1" />{p.label} ×{p.count}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="border-[#1e2e25] bg-[#111916] p-5">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><ShieldCheck size={15} className="text-[#0f9d70]" /> Workflow</h3>
            <div className="space-y-3 text-sm">
              <WorkflowLine label="Validation interne" status={fr.internalValidationStatus ?? 'en_attente'} />
              <WorkflowLine label="Approbation SONATEL" status={fr.sonatelApprovalStatus ?? 'en_attente'} />
              {fr.qualityScore && (
                <div className="flex items-center justify-between">
                  <span className="text-[#7a8f80]">Score qualité</span>
                  <span className="font-bold text-[#0f9d70]">{Number(fr.qualityScore)}/100</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[#7a8f80]">Montant bordereau</span>
                <span className="font-bold text-[#e8ede9] tabular-nums">
                  {fmtFCFA(fr.montantTotal && Number(fr.montantTotal) > 0
                    ? fr.montantTotal
                    : (fr.priceItemsUsed ?? []).reduce((s: number, l: any) => s + (Number(l.unitPrice ?? l.itemUnitPrice) || 0) * Number(l.quantity || 0), 0))}
                </span>
              </div>
              {fr.dbmMeasurement && (
                <div className="flex items-center justify-between">
                  <span className="text-[#7a8f80]">Mesure dBm</span>
                  <span className={'font-bold ' + (fr.dbmOutOfNorm ? 'text-[#C0392B]' : 'text-[#e8ede9]')}>
                    {Number(fr.dbmMeasurement).toFixed(1)} dBm {fr.dbmOutOfNorm && <AlertTriangle size={12} className="inline" />}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Recette formelle (OSM) */}
          {m.typeTache === 'OSM' && <RecettePanel fr={fr} onPv={downloadPv} />}
        </div>
      </div>

      {/* ── Stepper piloté par le template ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {stepNumbers.map((n) => {
          const done = stepDone(n);
          const locked = n > 1 && !sstDone;
          const active = activeStep === n;
          const Icon = STEP_ICONS[stepsByNum.get(n)?.icon] ?? (n === 6 ? Flag : CheckCircle2);
          return (
            <button
              key={n}
              onClick={() => { if (!locked) setActiveStep(n); else toast({ title: 'Étape verrouillée', description: 'Validez d’abord la sécurité SST (étape 1)', variant: 'warning' }); }}
              className={
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ' +
                (active ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' :
                 done ? 'border-[#0f9d70]/30 text-[#0f9d70] hover:border-[#0f9d70]/60' :
                 locked ? 'border-[#1e2e25] text-[#7a8f80]/40' :
                 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')
              }
            >
              {done ? <CheckCircle2 size={15} /> : locked ? <Lock size={14} /> : <Icon size={15} />}
              <span className="font-medium">{n}. {stepLabel(n)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Contenu étape active ── */}
      <Card className="border-[#1e2e25] bg-[#111916] p-5">
        {activeStep === 1 && <Step1 fr={fr} tplStep={stepsByNum.get(1)} onSave={(body) => saveFixed(1, body)} loading={stepMut.loading} />}
        {activeStep === 2 && <Step2 fr={fr} tplStep={stepsByNum.get(2)} onSaveFixed={(body) => saveFixed(2, body)} onSaveData={(d) => dataMut.mutate({ data: d })} loading={stepMut.loading || dataMut.loading} />}
        {activeStep === 3 && <Step3 fr={fr} tplStep={stepsByNum.get(3)} onSaveFixed={(body) => saveFixed(3, body)} onSaveData={(d) => dataMut.mutate({ data: d })} loading={stepMut.loading || dataMut.loading} />}
        {activeStep === 4 && <Step4 fr={fr} tplStep={stepsByNum.get(4)} onSaveFixed={(body) => saveFixed(4, body)} onSaveData={(d) => dataMut.mutate({ data: d })} loading={stepMut.loading || dataMut.loading} />}
        {activeStep === 5 && hasMateriel && (
          <Step5 fr={fr} tplStep={stepsByNum.get(5)} items={items} priceItems={priceItems}
            onSaveFixed={(body) => saveFixed(5, body)}
            onSaveData={(d, p) => dataMut.mutate({ data: d, priceItemsUsed: p })}
            loading={stepMut.loading || dataMut.loading} />
        )}
        {activeStep === 6 && <Step6 fr={fr} tplStep={stepsByNum.get(6)} clientFinal={clientFinal} missionType={m.typeTache} onSave={(body) => saveFixed(6, body)} loading={stepMut.loading} />}
      </Card>

      {/* ── Fiche de chantier (OSM / GC / DENSIFICATION / SURVEY_OSM) ── */}
      {m.typeTache === 'DENSIFICATION' && (
        <Card className="border-[#0f9d70]/30 bg-[#0f9d70]/5 p-4">
          <p className="text-sm text-[#e8ede9] font-medium flex items-center gap-2">
            <Layers size={16} className="text-[#0f9d70]" /> Fiche DENSIF
          </p>
          <p className="text-xs text-[#7a8f80] mt-1">
            Bande métrique, étiquetage, mesures optiques (1310/1550 nm), pré-recette et double signature — compléter la fiche chantier ci-dessous.
          </p>
        </Card>
      )}
      {sheet?.applicable && sheet?.template && (
        <SiteChecklistCard
          missionId={String(id)}
          template={sheet.template}
          saved={sheet.saved}
          priceItems={priceItems}
          fr={fr}
          onSaved={() => { refetchSheet(); refetch(); }}
        />
      )}
    </div>
  );
}

function WorkflowLine({ label, status }: { label: string; status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    en_attente: { label: 'En attente', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]' },
    validee: { label: 'Validée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
    rejetee: { label: 'Rejetée', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
    approuve: { label: 'Approuvée', cls: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30' },
    rejete: { label: 'Rejetée', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30' },
  };
  const m = map[status] ?? map.en_attente;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#7a8f80]">{label}</span>
      <Badge className={m.cls}>{m.label}</Badge>
    </div>
  );
}

/* ═════════════════ Recette OSM (workflow formel) ═════════════════ */
function RecettePanel({ fr, onPv }: { fr: any; onPv: () => void }) {
  const recette = fr.recetteStatus ?? 'en_attente';
  const docs = fr.recetteDocuments ?? [];
  return (
    <Card className="border-[#f5a623]/30 bg-[#111916] p-5">
      <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2">
        <ClipboardList size={15} className="text-[#f5a623]" /> Recette OSM — validation formelle
      </h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#7a8f80]">Statut recette</span>
          <Badge className={RECETTE_META[recette]?.cls ?? RECETTE_META.en_attente.cls}>{RECETTE_META[recette]?.label ?? recette}</Badge>
        </div>
        <div className="space-y-1.5">
          {['dossier_mesure_fibre', 'recette_surface'].map(t => {
            const doc = docs.find((d: any) => d.type === t);
            return (
              <div key={t} className="flex items-center justify-between text-xs">
                <span className="text-[#7a8f80]">{t === 'dossier_mesure_fibre' ? 'Dossier de mesure fibre' : 'Recette en surface'}</span>
                {doc ? (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-[#0f9d70] hover:underline flex items-center gap-1">
                    <Check size={11} /> déposé
                  </a>
                ) : (
                  <span className="text-[#7a8f80]/50 flex items-center gap-1"><Clock size={11} /> non déposé</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#7a8f80]">Signatures</span>
          <span className="flex items-center gap-2">
            <span className={fr.internalValidationStatus === 'validee' ? 'text-[#0f9d70]' : 'text-[#7a8f80]/50'}>sous-traitant {fr.internalValidationStatus === 'validee' ? '✓' : '—'}</span>
            <span className={fr.sonatelApprovalStatus === 'approuve' ? 'text-[#0f9d70]' : 'text-[#7a8f80]/50'}>SONATEL {fr.sonatelApprovalStatus === 'approuve' ? '✓' : '—'}</span>
          </span>
        </div>
        {recette === 'reserves' && (
          <p className="text-xs text-[#f5a623] flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Réserves à lever sous 3 jours après la première recette (100 000 F/jour de retard — annexe Optimax).
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onPv}>
          <FileDown size={13} /> PV de recette (PDF)
        </Button>
      </div>
    </Card>
  );
}

/* ═════════════════ Champs dynamiques du template ═════════════════ */
function DynamicFields({ fields, values, onChange }: { fields: any[]; values: Record<string, any>; onChange: (id: string, v: any) => void }) {
  const extras = (fields ?? []).filter((f: any) => !FIXED_FIELD_IDS.has(f.id));
  if (extras.length === 0) return null;
  return (
    <div className="space-y-3 pt-3 border-t border-[#1e2e25]/60 mt-4">
      <p className="text-xs font-semibold text-[#e8ede9] flex items-center gap-1.5"><Layers size={12} className="text-[#0f9d70]" /> Données spécifiques au type de mission</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {extras.map((f: any) => {
          if (f.type === 'boolean') {
            return (
              <button key={f.id} type="button" onClick={() => onChange(f.id, !values[f.id])}
                className={'rounded-lg border p-2.5 text-left text-sm transition-all ' + (values[f.id] ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] bg-[#0a0f0d] text-[#7a8f80]')}>
                <Check size={14} className="inline mr-1.5" strokeWidth={3} />{f.label}{f.required ? ' *' : ''}
              </button>
            );
          }
          if (f.type === 'select') {
            return (
              <Select key={f.id} label={f.label + (f.required ? ' *' : '')} value={values[f.id] ?? ''} onChange={(e: any) => onChange(f.id, e.target.value)}>
                <option value="">—</option>
                {(f.options ?? []).map((o: string) => <option key={o} value={o}>{String(o).replace(/_/g, ' ')}</option>)}
              </Select>
            );
          }
          if (f.type === 'date') {
            return <Input key={f.id} label={f.label + (f.required ? ' *' : '')} type="date" value={values[f.id] ?? ''} onChange={(e: any) => onChange(f.id, e.target.value)} />;
          }
          return (
            <Input key={f.id} label={f.label + (f.required ? ' *' : '')}
              type={f.type === 'number' ? 'number' : 'text'} step={f.type === 'number' ? 'any' : undefined}
              value={values[f.id] ?? ''} onChange={(e: any) => onChange(f.id, e.target.value)} />
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════ ÉTAPE 1 : SST ═════════════════ */
function Step1({ fr, tplStep, onSave, loading }: { fr: any; tplStep: any; onSave: (b: any) => void; loading: boolean }) {
  const epiOptions: string[] = tplStep?.fields?.find((f: any) => f.id === 'sstChecklist')?.options ?? EPI_ITEMS;
  const [epi, setEpi] = useState<Record<string, boolean>>(
    Object.fromEntries(epiOptions.map(k => [k, !!fr.sstChecklist?.[k]])),
  );
  const [photo, setPhoto] = useState(fr.sstPhotoUrl ?? '');
  const allChecked = epiOptions.every(k => epi[k]);
  const done = !!fr.sstValidatedAt;

  return (
    <div className="space-y-4">
      <StepHeader n={1} title="Sécurité SST — bloquante" hint="Tous les EPI doivent être cochés pour déverrouiller la suite. Aucun contournement possible." done={done} validatedAt={fr.sstValidatedAt} />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {epiOptions.map(item => (
          <button key={item} type="button" disabled={done}
            onClick={() => setEpi(p => ({ ...p, [item]: !p[item] }))}
            className={
              'rounded-lg border p-3 text-center capitalize transition-all ' +
              (epi[item] ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] bg-[#0a0f0d] text-[#7a8f80] hover:border-[#0f9d70]/40') +
              (done ? ' opacity-70 cursor-not-allowed' : '')
            }>
            <Check size={18} className="mx-auto mb-1" strokeWidth={3} />
            <span className="text-xs font-medium">{item}</span>
          </button>
        ))}
      </div>
      <FileDropzone category="missions" value={photo} onChange={setPhoto} label="Photo EPI" accept="image/*" />
      <Input label="Photo EPI — URL (optionnel)" value={photo} onChange={e => setPhoto(e.target.value)} disabled={done}
        placeholder="https://… ou /uploads/…" />
      {!done && (
        <div className="flex items-center justify-between">
          {!allChecked && <p className="text-xs text-[#D9822B] flex items-center gap-1"><AlertTriangle size={12} /> EPI manquants — validation impossible</p>}
          <div className="flex-1" />
          <Button onClick={() => onSave({ sstChecklist: epi, sstPhotoUrl: photo || undefined })} disabled={!allChecked || loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Valider la sécurité
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═════════════════ ÉTAPE 2 : IDENTIFICATION ═════════════════ */
function Step2({ fr, tplStep, onSaveFixed, onSaveData, loading }: { fr: any; tplStep: any; onSaveFixed: (b: any) => void; onSaveData: (d: any) => void; loading: boolean }) {
  const [f, setF] = useState({
    interventionType: fr.interventionType ?? '',
    equipmentCode: fr.equipmentCode ?? '',
    gpsLatitude: fr.gpsLatitude ?? '',
    gpsLongitude: fr.gpsLongitude ?? '',
  });
  const [dyn, setDyn] = useState<Record<string, any>>({ ...(fr.data ?? {}) });
  const save = () => {
    onSaveFixed({
      interventionType: f.interventionType || undefined,
      equipmentCode: f.equipmentCode || undefined,
      gpsLatitude: f.gpsLatitude !== '' ? Number(f.gpsLatitude) : undefined,
      gpsLongitude: f.gpsLongitude !== '' ? Number(f.gpsLongitude) : undefined,
    });
    const extras = (tplStep?.fields ?? []).filter((x: any) => !FIXED_FIELD_IDS.has(x.id) && dyn[x.id] !== undefined && dyn[x.id] !== '');
    if (extras.length > 0) onSaveData(Object.fromEntries(extras.map((x: any) => [x.id, dyn[x.id]])));
  };
  return (
    <div className="space-y-4">
      <StepHeader n={2} title="Identification & géolocalisation" hint="Type d'intervention, équipement et GPS du site — alimente aussi la carte Géolocalisation (mission_check)." done={!!fr.identificationAt} validatedAt={fr.identificationAt} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Type d'intervention" value={f.interventionType} onChange={e => setF({ ...f, interventionType: e.target.value })} placeholder="Raccordement FTTH" />
        <Input label="Code équipement" value={f.equipmentCode} onChange={e => setF({ ...f, equipmentCode: e.target.value })} placeholder="PBO-1234" />
        <Input label="Latitude GPS site" type="number" step="0.0000001" value={f.gpsLatitude} onChange={e => setF({ ...f, gpsLatitude: e.target.value })} placeholder="14.6928" />
        <Input label="Longitude GPS site" type="number" step="0.0000001" value={f.gpsLongitude} onChange={e => setF({ ...f, gpsLongitude: e.target.value })} placeholder="-17.4467" />
      </div>
      <DynamicFields fields={tplStep?.fields} values={dyn} onChange={(id, v) => setDyn(p => ({ ...p, [id]: v }))} />
      <div className="flex justify-end">
        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

/* ═════════════════ ÉTAPE 3 : TECHNIQUE ═════════════════ */
function Step3({ fr, tplStep, onSaveFixed, onSaveData, loading }: { fr: any; tplStep: any; onSaveFixed: (b: any) => void; onSaveData: (d: any) => void; loading: boolean }) {
  const [f, setF] = useState({
    initialEquipmentState: fr.initialEquipmentState ?? '',
    actionRealized: fr.actionRealized ?? '',
    dbmMeasurement: fr.dbmMeasurement ?? '',
  });
  const [dyn, setDyn] = useState<Record<string, any>>({ ...(fr.data ?? {}) });
  const dbmNum = f.dbmMeasurement !== '' ? Number(f.dbmMeasurement) : null;
  const outOfNorm = dbmNum !== null && dbmNum < DBM_THRESHOLD;
  const save = () => {
    onSaveFixed({
      initialEquipmentState: f.initialEquipmentState || undefined,
      actionRealized: f.actionRealized || undefined,
      dbmMeasurement: f.dbmMeasurement !== '' ? Number(f.dbmMeasurement) : undefined,
    });
    const extras = (tplStep?.fields ?? []).filter((x: any) => !FIXED_FIELD_IDS.has(x.id) && dyn[x.id] !== undefined && dyn[x.id] !== '');
    if (extras.length > 0) onSaveData(Object.fromEntries(extras.map((x: any) => [x.id, dyn[x.id]])));
  };
  return (
    <div className="space-y-4">
      <StepHeader n={3} title="Exécution technique" hint={`État initial, action réalisée et mesure de signal — seuil d'alerte : ${DBM_THRESHOLD} dBm.`} done={!!fr.techniqueAt} validatedAt={fr.techniqueAt} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="État initial de l'équipement" value={f.initialEquipmentState} onChange={e => setF({ ...f, initialEquipmentState: e.target.value })} placeholder="PBO opérationnel, port 12 libre" />
        <div>
          <Input label="Mesure dBm" type="number" step="0.1" value={f.dbmMeasurement} onChange={e => setF({ ...f, dbmMeasurement: e.target.value })} placeholder="-18.5" />
          {outOfNorm && <p className="text-xs text-[#C0392B] mt-1 flex items-center gap-1"><AlertTriangle size={12} /> Hors norme (&lt; {DBM_THRESHOLD} dBm) — signalé automatiquement</p>}
          {!outOfNorm && dbmNum !== null && <p className="text-xs text-[#0f9d70] mt-1 flex items-center gap-1"><Check size={12} /> Conforme</p>}
        </div>
      </div>
      <Textarea label="Action réalisée" value={f.actionRealized} onChange={e => setF({ ...f, actionRealized: e.target.value })} rows={3} placeholder="Raccordement du client au PBO, soudure fibre…" />
      <DynamicFields fields={tplStep?.fields} values={dyn} onChange={(id, v) => setDyn(p => ({ ...p, [id]: v }))} />
      <div className="flex justify-end">
        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

/* ═════════════════ ÉTAPE 4 : PHOTOS (dynamique par template) ═════════════════ */
function Step4({ fr, tplStep, onSaveFixed, onSaveData, loading }: { fr: any; tplStep: any; onSaveFixed: (b: any) => void; onSaveData: (d: any) => void; loading: boolean }) {
  const photoFields: Array<{ id: string; label: string }> = (tplStep?.fields ?? [])
    .filter((f: any) => f.type === 'photos')
    .map((f: any) => ({ id: f.id, label: PHOTO_LABELS[f.id] ?? f.label ?? f.id }));
  const [f, setF] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const p of photoFields) base[p.id] = (fr[p.id] as string) ?? (fr.data?.[p.id] as string) ?? '';
    return base;
  });

  const save = () => {
    const standard: Record<string, string | undefined> = {};
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) {
      if (!v) continue;
      if (STANDARD_PHOTO_KEYS.has(k)) standard[k] = v;
      else extra[k] = v;
    }
    onSaveFixed(standard);
    if (Object.keys(extra).length > 0) onSaveData(extra);
  };

  return (
    <div className="space-y-4">
      <StepHeader n={4} title={tplStep?.label ?? 'Preuves visuelles'} hint="Photos exigées par le type de mission — un pré-audit IA peut être déclenché ensuite." done={!!fr.photosAt} validatedAt={fr.photosAt} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {photoFields.map(p => (
          <div key={p.id} className="space-y-2">
            <FileDropzone
              category="missions"
              value={f[p.id]}
              onChange={url => setF({ ...f, [p.id]: url })}
              label={p.label}
              accept="image/*"
            />
            <Input label={`${p.label} — URL (optionnel)`} value={f[p.id]} onChange={e => setF({ ...f, [p.id]: e.target.value })} placeholder="https://…/photo.jpg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </Button>
      </div>
    </div>
  );
}

/* ═════════════════ ÉTAPE 5 : MATÉRIEL — 2 ONGLETS ═════════════════ */
function Step5({ fr, tplStep, items, priceItems, onSaveFixed, onSaveData, loading }: {
  fr: any; tplStep: any; items: any[]; priceItems: any[];
  onSaveFixed: (b: any) => void; onSaveData: (d: any, p?: any[]) => void; loading: boolean;
}) {
  const [tab, setTab] = useState<'stock' | 'prestations'>('stock');

  // Onglet Stock
  const initial = (fr.materialsConsumed ?? []).map((m: any, i: number) => ({ itemNumber: m.itemNumber ?? items[i]?.itemNumber, designation: m.designation ?? '', quantity: m.quantity }));
  const [lines, setLines] = useState<any[]>(initial.length ? initial : [{ itemNumber: undefined, designation: '', quantity: 1 }]);
  const update = (i: number, patch: any) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  const totalUnits = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  // Onglet Prestations (bordereau 3STB valorisé)
  const [dyn, setDyn] = useState<Record<string, any>>({ ...(fr.data ?? {}) });
  const initialPresta = (fr.priceItemsUsed ?? []).map((l: any) => ({ itemNumber: l.itemNumber, quantity: Number(l.quantity) || 1 }));
  const [presta, setPresta] = useState<any[]>(initialPresta.length ? initialPresta : []);
  const priceByNumber = useMemo(() => new Map(priceItems.map((p: any) => [Number(p.itemNumber), p])), [priceItems]);
  const prestaTotal = presta.reduce((s, l) => {
    const pu = Number(priceByNumber.get(Number(l.itemNumber))?.unitPrice ?? 0);
    return s + pu * (Number(l.quantity) || 0);
  }, 0);

  const saveStock = () => {
    onSaveFixed({
      materialsConsumed: lines
        .filter(l => l.itemNumber || l.designation)
        .map(l => ({ itemNumber: l.itemNumber, designation: l.designation || undefined, quantity: Number(l.quantity) || 1 })),
    });
  };
  const savePresta = () => {
    const extras = (tplStep?.fields ?? []).filter((x: any) => !FIXED_FIELD_IDS.has(x.id) && dyn[x.id] !== undefined && dyn[x.id] !== '');
    onSaveData(
      Object.fromEntries(extras.map((x: any) => [x.id, dyn[x.id]])),
      presta.filter(l => l.itemNumber).map(l => ({ itemNumber: Number(l.itemNumber), quantity: Number(l.quantity) || 1 })),
    );
  };

  return (
    <div className="space-y-4">
      <StepHeader n={5} title="Matériel & prestations" hint="Stock consommé (décrémente le stock à la validation) et prestations valorisées au bordereau 3STB." done={!!fr.materielAt} validatedAt={fr.materielAt} />

      <div className="flex gap-1 bg-[#0a0f0d] border border-[#1e2e25] rounded-lg p-1 w-fit">
        <button onClick={() => setTab('stock')}
          className={'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ' + (tab === 'stock' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
          <Package size={13} /> Stock consommé
        </button>
        <button onClick={() => setTab('prestations')}
          className={'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ' + (tab === 'prestations' ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
          <Wallet size={13} /> Prestations (bordereau)
        </button>
      </div>

      {tab === 'stock' ? (
        <>
          <div className="space-y-2">
            {lines.map((line, i) => {
              const selectedItem = items.find((it: any) => Number(it.itemNumber) === Number(line.itemNumber));
              return (
                <div key={i} className="grid grid-cols-[5rem_2fr_5rem_2.5rem] gap-2 items-end">
                  <select value={line.itemNumber ?? ''} onChange={e => update(i, { itemNumber: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-2 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
                    <option value="">N°</option>
                    {items.map((it: any) => <option key={it.id} value={it.itemNumber}>{it.itemNumber}</option>)}
                  </select>
                  <div className="text-sm text-[#7a8f80] h-9 flex items-center px-1 truncate">
                    {selectedItem?.designation ?? line.designation ?? '—'}
                  </div>
                  <Input type="number" min={1} value={line.quantity} onChange={e => update(i, { quantity: Number(e.target.value) })} />
                  <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setLines(prev => [...prev, { itemNumber: undefined, designation: '', quantity: 1 }])}>
              <Plus size={14} /> Ajouter une ligne
            </Button>
            <span className="text-xs text-[#7a8f80]">Total : <b className="text-[#e8ede9]">{totalUnits}</b> unité(s)</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveStock} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer le stock
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            {presta.map((line, i) => {
              const item = priceByNumber.get(Number(line.itemNumber));
              const pu = Number(item?.unitPrice ?? 0);
              const total = pu * (Number(line.quantity) || 0);
              const upP = (patch: any) => setPresta(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
              return (
                <div key={i} className="grid grid-cols-[5rem_2fr_4.5rem_7rem_7.5rem_2.5rem] gap-2 items-center">
                  <select value={line.itemNumber ?? ''} onChange={e => upP({ itemNumber: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-2 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
                    <option value="">N°</option>
                    {priceItems.map((p: any) => <option key={p.id} value={p.itemNumber}>{p.itemNumber}</option>)}
                  </select>
                  <div className="text-sm text-[#7a8f80] truncate" title={item?.designation}>{item?.designation ?? '—'}</div>
                  <Input type="number" min={1} value={line.quantity} onChange={e => upP({ quantity: Number(e.target.value) })} />
                  <span className="text-xs text-[#7a8f80] tabular-nums text-right">{pu.toLocaleString('fr-FR')} F</span>
                  <span className="text-sm text-[#e8ede9] tabular-nums text-right font-medium">{total.toLocaleString('fr-FR')} F</span>
                  <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setPresta(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
            {presta.length === 0 && <p className="text-sm text-[#7a8f80] py-4 text-center">Aucune prestation saisie — ajoutez les items du bordereau réalisés sur cette mission.</p>}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setPresta(prev => [...prev, { itemNumber: undefined, quantity: 1 }])}>
              <Plus size={14} /> Ajouter une prestation
            </Button>
            <span className="text-sm text-[#7a8f80]">Montant total de la mission : <b className="text-[#e8ede9] text-base tabular-nums">{prestaTotal.toLocaleString('fr-FR')} F</b></span>
          </div>
          <DynamicFields fields={tplStep?.fields} values={dyn} onChange={(id, v) => setDyn(p => ({ ...p, [id]: v }))} />
          <div className="flex justify-end">
            <Button onClick={savePresta} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer les prestations
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═════════════════ ÉTAPE 6 : CLÔTURE ═════════════════ */
function Step6({ fr, tplStep, clientFinal, missionType, onSave, loading }: { fr: any; tplStep: any; clientFinal: boolean; missionType: string; onSave: (b: any) => void; loading: boolean }) {
  const [f, setF] = useState({
    fieldStatus: fr.fieldStatus ?? 'succes',
    failureReason: fr.failureReason ?? '',
    observations: fr.observations ?? '',
    signatureTechnicianUrl: fr.signatureTechnicianUrl ?? '',
    signatureClientUrl: fr.signatureClientUrl ?? '',
    savAction: (fr.savAction as string) ?? '',
    savOutcome: (fr.savOutcome as string) ?? '',
  });
  const isSav = missionType === 'SAV';
  return (
    <div className="space-y-4">
      <StepHeader n={6} title={tplStep?.label ?? 'Clôture'} hint="Statut terrain final — déclenche le calcul du score qualité." done={!!fr.fieldStatus} validatedAt={null} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs text-[#7a8f80]">Résultat de l'intervention *</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setF({ ...f, fieldStatus: 'succes' })}
              className={'rounded-lg border p-3 text-center transition-all ' + (f.fieldStatus === 'succes' ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:border-[#0f9d70]/40')}>
              <CheckCircle2 size={18} className="mx-auto mb-1" />
              <span className="text-xs font-medium">Succès</span>
            </button>
            <button type="button" onClick={() => setF({ ...f, fieldStatus: 'echec' })}
              className={'rounded-lg border p-3 text-center transition-all ' + (f.fieldStatus === 'echec' ? 'border-[#C0392B] bg-[#C0392B]/10 text-[#C0392B]' : 'border-[#1e2e25] text-[#7a8f80] hover:border-[#C0392B]/40')}>
              <XCircle size={18} className="mx-auto mb-1" />
              <span className="text-xs font-medium">Échec</span>
            </button>
          </div>
        </div>
        <div>
          <FileDropzone category="missions" value={f.signatureTechnicianUrl} onChange={url => setF({ ...f, signatureTechnicianUrl: url })} label="Signature technicien" accept="image/*" />
          <Input label="Signature technicien — URL (optionnel)" value={f.signatureTechnicianUrl} onChange={e => setF({ ...f, signatureTechnicianUrl: e.target.value })} placeholder="https://…/signature.png" />
        </div>
      </div>
      {f.fieldStatus === 'echec' && (
        <Select label="Motif de l'échec *" value={f.failureReason} onChange={e => setF({ ...f, failureReason: e.target.value })}>
          <option value="">— Sélectionner un motif —</option>
          {FAILURE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      )}
      {isSav && f.fieldStatus === 'succes' && (
        <div className="grid grid-cols-2 gap-3">
          <Select label="Action SAV réalisée *" value={f.savAction ?? ''} onChange={e => setF({ ...f, savAction: e.target.value })}>
            <option value="">— Catalogue —</option>
            {SAV_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <Select label="Issue (facturation) *" value={f.savOutcome ?? ''} onChange={e => setF({ ...f, savOutcome: e.target.value })}>
            <option value="">— Issue —</option>
            {SAV_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      )}
      <Textarea label="Observations" value={f.observations} onChange={e => setF({ ...f, observations: e.target.value })} rows={3} />
      {clientFinal ? (
        <div>
          <FileDropzone category="missions" value={f.signatureClientUrl} onChange={url => setF({ ...f, signatureClientUrl: url })} label="Signature client" accept="image/*" />
          <Input label="Signature client — URL (optionnel)" value={f.signatureClientUrl} onChange={e => setF({ ...f, signatureClientUrl: e.target.value })} placeholder="https://…/signature-client.png" />
        </div>
      ) : (
        <p className="text-xs text-[#7a8f80] flex items-center gap-1.5"><AlertTriangle size={12} className="text-[#D9822B]" /> Mission sans client final — signature client non requise pour ce type.</p>
      )}
      <div className="flex justify-end">
        <Button onClick={() => onSave({
          fieldStatus: f.fieldStatus,
          failureReason: f.fieldStatus === 'echec' ? (f.failureReason || 'Non précisé') : undefined,
          observations: f.observations || undefined,
          signatureTechnicianUrl: f.signatureTechnicianUrl || undefined,
          signatureClientUrl: clientFinal ? (f.signatureClientUrl || undefined) : undefined,
          savAction: isSav && f.fieldStatus === 'succes' ? (f.savAction || undefined) : undefined,
          savOutcome: isSav && f.fieldStatus === 'succes' ? (f.savOutcome || undefined) : undefined,
        })} disabled={loading || (f.fieldStatus === 'echec' && !f.failureReason) || (isSav && f.fieldStatus === 'succes' && (!f.savAction || !f.savOutcome))}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Clôturer la mission
        </Button>
      </div>
    </div>
  );
}

/* ═════════════════ FICHE DE CHANTIER ═════════════════ */
function SiteChecklistCard({ missionId, template, saved, priceItems, fr, onSaved }: {
  missionId: string; template: any; saved: any; priceItems: any[]; fr: any; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({ ...(saved ?? {}) });
  const priceByNumber = useMemo(() => new Map(priceItems.map((p: any) => [Number(p.itemNumber), p])), [priceItems]);
  const initialLines = (fr.priceItemsUsed ?? []).map((l: any) => ({ itemNumber: l.itemNumber, quantity: Number(l.quantity) || 1 }));
  const [lines, setLines] = useState<any[]>(initialLines);
  const total = lines.reduce((s, l) => s + Number(priceByNumber.get(Number(l.itemNumber))?.unitPrice ?? 0) * (Number(l.quantity) || 0), 0);

  const saveMut = useMutation(
    () => siteChecklistService.saveForMission(
      missionId,
      values,
      Object.entries(values).filter(([k, v]) => k.startsWith('photo_') && typeof v === 'string' && v).map(([k, v]) => ({ type: k.replace('photo_', ''), url: String(v) })),
      lines.filter(l => l.itemNumber).map(l => ({ itemNumber: Number(l.itemNumber), quantity: Number(l.quantity) || 1 })),
    ),
    {
      onSuccess: () => { toast({ title: 'Fiche de chantier enregistrée', description: 'Montant valorisé au bordereau 2025.', variant: 'success' }); onSaved(); },
      onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const sections: Array<{ section: string; items: any[] }> = template.sections ?? [];

  return (
    <Card className="border-[#1e2e25] bg-[#111916] p-5">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <div className="text-left">
          <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
            <ClipboardList size={15} className="text-[#0f9d70]" /> Fiche de chantier — {template.label}
          </h3>
          <p className="text-xs text-[#7a8f80] mt-0.5">Sections terrain cochables, liées au bordereau (montant valorisé automatiquement).</p>
        </div>
        <Badge className="bg-[#0f9d70]/10 text-[#0f9d70] border-[#0f9d70]/30">{open ? 'réduire' : 'ouvrir'}</Badge>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {sections.map((sec, si) => (
            <div key={si} className="space-y-2">
              <p className="text-xs font-semibold text-[#e8ede9] uppercase tracking-wide border-b border-[#1e2e25]/60 pb-1.5">{sec.section}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sec.items.map((item: any) => {
                  const v = values[item.id];
                  if (item.type === 'boolean') {
                    return (
                      <button key={item.id} type="button" onClick={() => setValues(p => ({ ...p, [item.id]: !p[item.id] }))}
                        className={'rounded-lg border p-2.5 text-left text-sm transition-all ' + (v ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] bg-[#0a0f0d] text-[#7a8f80]')}>
                        <Check size={14} className="inline mr-1.5" strokeWidth={3} />{item.label}
                      </button>
                    );
                  }
                  if (item.type === 'select') {
                    return (
                      <Select key={item.id} label={item.label} value={v ?? ''} onChange={(e: any) => setValues(p => ({ ...p, [item.id]: e.target.value }))}>
                        <option value="">—</option>
                        {(item.options ?? []).map((o: string) => <option key={o} value={o}>{String(o).replace(/_/g, ' ')}</option>)}
                      </Select>
                    );
                  }
                  if (item.type === 'photos') {
                    return (
                      <div key={item.id} className="space-y-2 sm:col-span-2">
                        <FileDropzone
                          category="missions"
                          value={v ?? ''}
                          onChange={url => setValues(p => ({ ...p, [item.id]: url }))}
                          label={item.label}
                          accept="image/*"
                        />
                        <Input label={item.label + ' — URL (optionnel)'} value={v ?? ''} onChange={(e: any) => setValues(p => ({ ...p, [item.id]: e.target.value }))} placeholder="https://…" />
                      </div>
                    );
                  }
                  return (
                    <Input key={item.id} label={item.label} type={item.type === 'number' ? 'number' : item.type === 'date' ? 'date' : 'text'}
                      value={v ?? ''} onChange={(e: any) => setValues(p => ({ ...p, [item.id]: e.target.value }))} />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Liaison bordereau */}
          <div className="space-y-2 pt-3 border-t border-[#1e2e25]/60">
            <p className="text-xs font-semibold text-[#e8ede9]">Items du bordereau réalisés</p>
            {lines.map((line, i) => {
              const item = priceByNumber.get(Number(line.itemNumber));
              const pu = Number(item?.unitPrice ?? 0);
              const upL = (patch: any) => setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
              return (
                <div key={i} className="grid grid-cols-[5rem_2fr_4.5rem_7rem_2.5rem] gap-2 items-center">
                  <select value={line.itemNumber ?? ''} onChange={e => upL({ itemNumber: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-9 w-full rounded-lg bg-[#0a0f0d] border border-[#1e2e25] px-2 text-sm text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50">
                    <option value="">N°</option>
                    {priceItems.map((p: any) => <option key={p.id} value={p.itemNumber}>{p.itemNumber}</option>)}
                  </select>
                  <div className="text-sm text-[#7a8f80] truncate">{item?.designation ?? '—'}</div>
                  <Input type="number" min={1} value={line.quantity} onChange={e => upL({ quantity: Number(e.target.value) })} />
                  <span className="text-sm text-[#e8ede9] tabular-nums text-right">{(pu * (Number(line.quantity) || 0)).toLocaleString('fr-FR')} F</span>
                  <Button type="button" variant="ghost" className="h-9 w-9 p-0 text-[#7a8f80] hover:text-[#C0392B]" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" onClick={() => setLines(prev => [...prev, { itemNumber: undefined, quantity: 1 }])}>
                <Plus size={14} /> Ajouter
              </Button>
              <span className="text-sm text-[#7a8f80]">Montant chantier : <b className="text-[#e8ede9] text-base tabular-nums">{total.toLocaleString('fr-FR')} F</b></span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.loading}>
              {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer la fiche
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StepHeader({ n, title, hint, done, validatedAt }: { n: number; title: string; hint: string; done: boolean; validatedAt?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2">
          {done ? <CheckCircle2 size={15} className="text-[#0f9d70]" /> : <Clock size={15} className="text-[#7a8f80]" />}
          Étape {n} — {title}
        </h3>
        <p className="text-xs text-[#7a8f80] mt-0.5">{hint}</p>
      </div>
      {done && validatedAt && <Badge className="bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30 shrink-0">Validée le {fmtDateTime(validatedAt)}</Badge>}
    </div>
  );
}
