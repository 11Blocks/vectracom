'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { settingsService } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import { useSessionUser } from '@/components/admin/TenantPicker';
import {
  Settings, Building2, Users, ClipboardList, Package, Truck, Target, Receipt,
  Bell, AlertTriangle, FileText, Link2, Shield, Wrench, Loader2, Download, Upload,
  RotateCcw, ExternalLink, History,
} from 'lucide-react';

type SectionKey =
  | 'general' | 'users' | 'missions' | 'stock' | 'vehicles' | 'kpi'
  | 'billing' | 'notifications' | 'incidents' | 'reports' | 'integrations'
  | 'security' | 'advanced';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: any }> = [
  { key: 'general', label: 'Général', icon: Building2 },
  { key: 'users', label: 'Utilisateurs', icon: Users },
  { key: 'missions', label: 'Missions', icon: ClipboardList },
  { key: 'stock', label: 'Stock', icon: Package },
  { key: 'vehicles', label: 'Véhicules', icon: Truck },
  { key: 'kpi', label: 'KPI SONATEL', icon: Target },
  { key: 'billing', label: 'Facturation', icon: Receipt },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'reports', label: 'Rapports', icon: FileText },
  { key: 'integrations', label: 'Intégrations', icon: Link2 },
  { key: 'security', label: 'Sécurité', icon: Shield },
  { key: 'advanced', label: 'Avancé', icon: Wrench },
];

const FIELD_META: Record<string, Array<{ key: string; label: string; type?: 'text' | 'number' | 'bool' | 'list' }>> = {
  general: [
    { key: 'companyName', label: "Nom de l'entreprise" },
    { key: 'logoUrl', label: 'URL du logo' },
    { key: 'primaryColor', label: 'Couleur primaire' },
    { key: 'timezone', label: 'Fuseau horaire' },
    { key: 'currency', label: 'Devise' },
    { key: 'language', label: 'Langue' },
  ],
  users: [
    { key: 'passwordMinLength', label: 'Longueur mini MDP', type: 'number' },
    { key: 'passwordRequireUpper', label: 'Exiger une majuscule', type: 'bool' },
    { key: 'passwordRequireDigit', label: 'Exiger un chiffre', type: 'bool' },
    { key: 'passwordExpiryDays', label: 'Expiration MDP (jours)', type: 'number' },
    { key: 'customRoles', label: 'Rôles personnalisés (virgules)', type: 'list' },
  ],
  missions: [
    { key: 'validationWorkflow', label: 'Workflow de validation' },
    { key: 'enabledTypes', label: 'Types de missions actifs (virgules)', type: 'list' },
    { key: 'maxMissionsPerTeamPerDay', label: 'Capacité max. missions / équipe / jour (0 = illimité)', type: 'number' },
  ],
  stock: [
    { key: 'defaultAlertThreshold', label: "Seuil d'alerte par défaut", type: 'number' },
    { key: 'units', label: 'Unités de mesure (virgules)', type: 'list' },
    { key: 'barcodeScanEnabled', label: 'Scan code-barres / série', type: 'bool' },
  ],
  vehicles: [
    { key: 'thresholdOrangeDays', label: 'Seuil orange (jours)', type: 'number' },
    { key: 'thresholdRedDays', label: 'Seuil rouge (jours)', type: 'number' },
    { key: 'documentTypes', label: 'Types de documents (virgules)', type: 'list' },
  ],
  kpi: [
    { key: 'alertGapPercent', label: "Seuil d'alerte écart (%)", type: 'number' },
    { key: 'bonusConsecutiveMonths', label: 'Bonus — mois consécutifs', type: 'number' },
    { key: 'bonusAmountFcfa', label: 'Bonus — montant (FCFA)', type: 'number' },
  ],
  billing: [
    { key: 'tvaRate', label: 'TVA (ex. 0.18)', type: 'number' },
    { key: 'paymentTermsDays', label: 'Délai paiement (jours)', type: 'number' },
    { key: 'invoiceNumberFormat', label: 'Format n° facture' },
    { key: 'invoiceTemplate', label: 'Modèle facture' },
    { key: 'billTerminatedMissions', label: 'Facturer aussi les missions terminées non validées', type: 'bool' },
  ],
  notifications: [
    { key: 'syncWithNotificationSettings', label: 'Sync avec module Notifications', type: 'bool' },
    { key: 'soundEnabled', label: 'Sonore web (nouvelles notifs)', type: 'bool' },
    { key: 'smsEnabled', label: 'Canal SMS activé', type: 'bool' },
    { key: 'smsProvider', label: 'Fournisseur SMS' },
  ],
  incidents: [
    { key: 'rubriques', label: 'Rubriques (virgules)', type: 'list' },
    { key: 'severities', label: 'Sévérités (virgules)', type: 'list' },
    { key: 'workflow', label: 'Workflow validation' },
  ],
  reports: [
    { key: 'enabledIndicators', label: 'Indicateurs (virgules)', type: 'list' },
    { key: 'autoRecipients', label: 'Destinataires auto (virgules)', type: 'list' },
  ],
  integrations: [
    { key: 'whatsappBusinessId', label: 'WhatsApp Business ID' },
    { key: 'whatsappEnabled', label: 'WhatsApp activé', type: 'bool' },
    { key: 'smtpHost', label: 'SMTP host' },
    { key: 'smtpPort', label: 'SMTP port', type: 'number' },
    { key: 'smtpUser', label: 'SMTP user' },
    { key: 'smtpFrom', label: 'SMTP from' },
    { key: 'webhookUrl', label: 'Webhook sortant' },
  ],
  security: [
    { key: 'sessionDays', label: 'Durée session (jours)', type: 'number' },
    { key: 'auditRetentionMonths', label: 'Conservation audit (mois)', type: 'number' },
    { key: 'backupFrequency', label: 'Fréquence sauvegarde' },
    { key: 'complianceFlags', label: 'Conformité (virgules)', type: 'list' },
  ],
  advanced: [
    { key: 'allowReset', label: 'Autoriser réinitialisation complète', type: 'bool' },
  ],
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const { user } = useSessionUser();
  const canEdit = user?.role === 'admin';
  const [section, setSection] = useState<SectionKey>('general');
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [showJournal, setShowJournal] = useState(false);

  const { data, loading, refetch } = useQuery(() => settingsService.getAll(), []);
  const { data: journal, refetch: refetchJournal } = useQuery(
    () => settingsService.journal(40),
    [showJournal],
  );

  const sectionData = useMemo(() => {
    const all = (data?.data ?? {}) as Record<string, Record<string, unknown>>;
    return all[section] ?? {};
  }, [data, section]);

  useEffect(() => {
    setDraft({ ...sectionData });
  }, [sectionData, section]);

  const saveMut = useMutation(
    () => settingsService.updateSection(section, draft, `Màj section ${section}`),
    {
      onSuccess: () => {
        toast({ title: 'Paramètres enregistrés', variant: 'success' });
        refetch();
        refetchJournal();
      },
      onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
    },
  );

  const restoreMut = useMutation(() => settingsService.restoreDefaults(), {
    onSuccess: () => {
      toast({ title: 'Paramètres d’usine restaurés', variant: 'success' });
      refetch();
      refetchJournal();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const onExport = async () => {
    try {
      const cfg = await settingsService.exportConfig();
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vectracom-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Configuration exportée', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Export impossible', description: e?.message, variant: 'error' });
    }
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed.data ?? parsed;
      await settingsService.importConfig(payload);
      toast({ title: 'Configuration importée', variant: 'success' });
      refetch();
      refetchJournal();
    } catch (e: any) {
      toast({ title: 'Import impossible', description: e?.message, variant: 'error' });
    }
  };

  const fields = FIELD_META[section] ?? [];
  const manageHint = String(draft.manageHint ?? sectionData.manageHint ?? '');

  const setField = (key: string, type: string | undefined, raw: string | boolean) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (type === 'bool') next[key] = !!raw;
      else if (type === 'number') next[key] = raw === '' ? null : Number(raw);
      else if (type === 'list') next[key] = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
      else next[key] = raw;
      return next;
    });
  };

  const displayValue = (key: string, type?: string) => {
    const v = draft[key];
    if (type === 'list' && Array.isArray(v)) return v.join(', ');
    if (type === 'bool') return !!v;
    if (v == null) return '';
    return String(v);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <Settings size={20} className="text-[#0f9d70]" /> Paramètres
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            Centre de contrôle tenant — 13 sections · enrichit l’existant sans le remplacer
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/parametres/entreprise">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]">
              <Building2 size={14} /> Profil entreprise
            </Button>
          </Link>
          <Link href="/parametres/formulaires">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]">
              <ClipboardList size={14} /> Formulaires
            </Button>
          </Link>
          <Link href="/parametres/utilisateurs">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]">
              <Users size={14} /> Comptes utilisateurs
            </Button>
          </Link>
          <Link href="/parametres/permissions">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]">
              <Shield size={14} /> Permissions
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]" onClick={() => setShowJournal((v) => !v)}>
            <History size={14} /> Journal
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-[#1e2e25]" onClick={onExport}>
            <Download size={14} /> Exporter
          </Button>
          {canEdit && (
            <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#1e2e25] bg-[#111916] text-xs text-[#e8ede9] cursor-pointer hover:border-[#0f9d70]/40">
              <Upload size={14} /> Importer
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        <Card className="border-[#1e2e25] bg-[#111916] p-2 h-fit">
          <div className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSection(s.key); setShowJournal(false); }}
                className={'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-left transition-colors ' +
                  (section === s.key && !showJournal ? 'bg-[#0f9d70] text-white' : 'text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#172019]')}
              >
                <s.icon size={14} /> {s.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {showJournal ? (
            <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e2e25] text-sm font-semibold text-[#e8ede9]">
                Journal des modifications
              </div>
              <div className="divide-y divide-[#1e2e25]/50 max-h-[560px] overflow-y-auto">
                {(journal?.items ?? []).length === 0 && (
                  <p className="p-6 text-center text-xs text-[#7a8f80]">Aucune modification enregistrée.</p>
                )}
                {(journal?.items ?? []).map((j: any) => (
                  <div key={j.id} className="px-4 py-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30">{j.sectionLabel}</Badge>
                      <span className="text-[#7a8f80]">{j.date ? new Date(j.date).toLocaleString('fr-FR') : '—'}</span>
                      <span className="text-[#e8ede9]">{j.user}</span>
                    </div>
                    <p className="text-[#7a8f80]">Paramètre : <span className="text-[#e8ede9]">{j.parameter || '—'}</span></p>
                    {j.reason && <p className="text-[#7a8f80] italic">{j.reason}</p>}
                  </div>
                ))}
              </div>
            </Card>
          ) : loading ? (
            <Skeleton className="h-64" />
          ) : (
            <Card className="border-[#1e2e25] bg-[#111916] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#e8ede9]">
                    {SECTIONS.find((s) => s.key === section)?.label}
                  </h2>
                  <p className="text-[11px] text-[#7a8f80] mt-0.5">
                    Les modules métier existants restent la référence CRUD ; ici on configure les règles tenant.
                  </p>
                </div>
                {manageHint && (
                  <Link href={manageHint} className="inline-flex items-center gap-1 text-xs text-[#0f9d70] hover:underline">
                    Ouvrir le module <ExternalLink size={12} />
                  </Link>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.key} className={f.type === 'list' || f.key === 'logoUrl' ? 'md:col-span-2' : ''}>
                    {f.type === 'bool' ? (
                      <label className="flex items-center justify-between gap-3 h-10 px-3 rounded-lg border border-[#1e2e25] bg-[#0a0f0d]">
                        <span className="text-xs text-[#e8ede9]">{f.label}</span>
                        <input
                          type="checkbox"
                          checked={!!displayValue(f.key, 'bool')}
                          onChange={(e) => setField(f.key, 'bool', e.target.checked)}
                          className="accent-[#0f9d70]"
                        />
                      </label>
                    ) : f.key === 'logoUrl' ? (
                      <div className="space-y-2">
                        <FileDropzone
                          category="logos"
                          value={String(displayValue(f.key) ?? '')}
                          onChange={(url) => setField(f.key, 'text', url)}
                          label="Logo entreprise"
                          accept="image/*"
                        />
                        <Input
                          label="URL du logo (optionnel)"
                          type="text"
                          value={String(displayValue(f.key) ?? '')}
                          onChange={(e) => setField(f.key, 'text', e.target.value)}
                        />
                      </div>
                    ) : (
                      <Input
                        label={f.label}
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={String(displayValue(f.key, f.type) ?? '')}
                        onChange={(e) => setField(f.key, f.type, e.target.value)}
                        step={f.key === 'tvaRate' ? '0.01' : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>

              {canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e2e25]">
                {section === 'advanced' ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                    disabled={restoreMut.loading}
                    onClick={() => {
                      if (confirm('Restaurer tous les paramètres aux valeurs d’usine ?')) restoreMut.mutate(undefined as any);
                    }}
                  >
                    {restoreMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    Restaurer les défauts
                  </Button>
                ) : <span />}
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={saveMut.loading}
                  onClick={() => saveMut.mutate(undefined as any)}
                >
                  {saveMut.loading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Enregistrer
                </Button>
              </div>
              ) : (
                <p className="pt-2 border-t border-[#1e2e25] text-xs text-[#7a8f80]">Lecture seule — seul l’administrateur du tenant peut modifier les paramètres.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
