'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Skeleton, Input, Textarea, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { settingsService, absoluteUploadUrl } from '@/services';
import { FileDropzone } from '@/components/FileDropzone';
import { useSessionUser } from '@/components/admin/TenantPicker';
import { Building2, ChevronLeft, Save, Landmark, FileText, Phone } from 'lucide-react';

const FIELDS = [
  'contactName', 'contactEmail', 'contactPhone', 'address', 'city',
  'ninea', 'rccm', 'bankName', 'bankAccount', 'logoUrl', 'invoiceFooter',
] as const;
type Field = (typeof FIELDS)[number];
type Profile = Record<Field, string>;

const empty = (): Profile => Object.fromEntries(FIELDS.map(k => [k, ''])) as Profile;

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const { user } = useSessionUser();
  const canEdit = user?.role === 'admin';
  const { data, loading, refetch } = useQuery(() => settingsService.getCompanyProfile(), []);
  const profile = data as any;
  const [f, setF] = useState<Profile>(empty());

  useEffect(() => {
    if (profile) setF(Object.fromEntries(FIELDS.map(k => [k, profile[k] ?? ''])) as Profile);
  }, [profile]);

  const dirty = !!profile && FIELDS.some(k => (profile[k] ?? '') !== f[k]);

  const saveMut = useMutation(
    () => settingsService.updateCompanyProfile(
      Object.fromEntries(FIELDS.filter(k => (profile?.[k] ?? '') !== f[k]).map(k => [k, f[k].trim() || null])),
    ),
    {
      onSuccess: () => { toast({ title: 'Profil entreprise enregistré', description: 'Repris à l’impression des factures', variant: 'success' }); refetch(); },
      onError: (e: Error) => toast({ title: 'Enregistrement impossible', description: e.message, variant: 'error' }),
    },
  );

  const input = (key: Field, label: string, props: Record<string, unknown> = {}) => (
    <Input label={label} value={f[key]} disabled={!canEdit} onChange={e => setF({ ...f, [key]: e.target.value })} {...props} />
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/parametres" className="flex items-center gap-1 text-sm text-[#7a8f80] hover:text-[#e8ede9] mb-1">
            <ChevronLeft size={14} /> Paramètres
          </Link>
          <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">
            <Building2 size={20} className="text-[#0f9d70]" /> Profil entreprise
          </h1>
          <p className="text-xs text-[#7a8f80] mt-0.5">
            {profile?.name ?? '…'} — en-tête, identifiants légaux et coordonnées bancaires imprimés sur vos factures.
            {!canEdit && ' Lecture seule (administrateur requis).'}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.loading} loading={saveMut.loading}>
            <Save size={15} /> Enregistrer
          </Button>
        )}
      </div>

      {loading && !profile ? <Skeleton className="h-96" /> : (
        <>
          <Card className="border-[#1e2e25] bg-[#111916] p-5 space-y-4">
            <p className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><Phone size={15} className="text-[#0f9d70]" /> Coordonnées</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {input('contactName', 'Contact / signataire', { placeholder: 'Nom du gérant' })}
              {input('contactEmail', 'Email', { type: 'email', placeholder: 'facturation@…' })}
              {input('contactPhone', 'Téléphone', { placeholder: '33 800 00 00' })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
              {input('address', 'Adresse', { placeholder: 'Rue, quartier' })}
              {input('city', 'Ville', { placeholder: 'Dakar' })}
            </div>
          </Card>

          <Card className="border-[#1e2e25] bg-[#111916] p-5 space-y-4">
            <p className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><Landmark size={15} className="text-[#0f9d70]" /> Légal & banque</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {input('ninea', 'NINEA')}
              {input('rccm', 'RCCM')}
              {input('bankName', 'Banque')}
              {input('bankAccount', 'RIB / IBAN')}
            </div>
          </Card>

          <Card className="border-[#1e2e25] bg-[#111916] p-5 space-y-4">
            <p className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><FileText size={15} className="text-[#0f9d70]" /> Facture</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-4 items-start">
              <div className="space-y-2">
                {canEdit && (
                  <FileDropzone category="logos" value={f.logoUrl} onChange={url => setF({ ...f, logoUrl: url })} label="Logo" accept="image/*" />
                )}
                {input('logoUrl', 'URL du logo')}
              </div>
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={absoluteUploadUrl(f.logoUrl)} alt="Logo" className="h-28 w-32 object-contain rounded-lg border border-[#1e2e25] bg-white/5" />
              ) : (
                <div className="h-28 w-32 rounded-lg border border-dashed border-[#1e2e25] flex items-center justify-center text-[10px] text-[#7a8f80]">Aucun logo</div>
              )}
            </div>
            <Textarea label="Pied de facture" rows={3} value={f.invoiceFooter} disabled={!canEdit} maxLength={600}
              onChange={e => setF({ ...f, invoiceFooter: e.target.value })}
              placeholder="Conditions de paiement, mentions légales, pénalités de retard…" />
          </Card>
          <p className="text-[11px] text-[#7a8f80]">
            L’en-tête (ce profil) est lu à chaque impression de facture ; les coordonnées du client, elles, sont figées à l’émission. Chaque modification est tracée dans le journal des paramètres.
          </p>
        </>
      )}
    </div>
  );
}
