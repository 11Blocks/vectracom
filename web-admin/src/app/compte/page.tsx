'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Input, Badge, useToast } from '@/components/ui';
import { accountService } from '@/services';
import { setToken } from '@/lib/api';
import { KeyRound, UserCircle2, ShieldAlert, Save } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin Green-T',
  finance_admin: 'Finance Green-T',
  support_admin: 'Support Green-T',
  admin: 'Administrateur',
  direction: 'Direction',
  chef_equipe: "Chef d'équipe",
  magasinier: 'Magasinier',
};

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </AppShell>
  );
}

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const forced = params.get('force') === '1' || Boolean(me?.mustChangePassword);

  useEffect(() => {
    accountService.me().then((m: any) => {
      setMe(m);
      setProfile({ fullName: m.fullName ?? '', phone: m.phone ?? '' });
    }).catch(() => undefined);
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const m: any = await accountService.updateProfile({ fullName: profile.fullName, phone: profile.phone });
      setMe(m);
      const stored = JSON.parse(localStorage.getItem('vectracom_user') || '{}');
      localStorage.setItem('vectracom_user', JSON.stringify({ ...stored, fullName: m.fullName }));
      toast({ title: 'Profil mis à jour', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    if (pwd.next !== pwd.confirm) return setPwdError('Les deux mots de passe ne correspondent pas');
    if (pwd.next.length < 8) return setPwdError('Minimum 8 caractères');
    if (!/[A-Za-z]/.test(pwd.next) || !/\d/.test(pwd.next)) return setPwdError('Au moins une lettre et un chiffre');
    setSavingPwd(true);
    try {
      const res: any = await accountService.changePassword(pwd.current, pwd.next);
      if (res?.accessToken) setToken(res.accessToken);
      const stored = JSON.parse(localStorage.getItem('vectracom_user') || '{}');
      localStorage.setItem('vectracom_user', JSON.stringify({ ...stored, mustChangePassword: false }));
      setPwd({ current: '', next: '', confirm: '' });
      toast({ title: 'Mot de passe modifié', description: 'Vos autres sessions ont été déconnectées', variant: 'success' });
      if (forced) {
        const role = stored.role as string | undefined;
        window.location.href = role && ['super_admin', 'finance_admin', 'support_admin'].includes(role) ? '/console' : role === 'magasinier' ? '/stock' : '/dashboard';
      } else {
        setMe((m: any) => ({ ...m, mustChangePassword: false, passwordChangedAt: new Date().toISOString() }));
      }
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><UserCircle2 size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9]">Mon compte</h1>
          <p className="text-xs text-[#7a8f80]">Profil et sécurité de connexion</p>
        </div>
      </div>

      {forced && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-[#f5a623]/40 bg-[#f5a623]/10 p-4">
          <ShieldAlert size={18} className="text-[#f5a623] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#f5a623]">Changement de mot de passe obligatoire</p>
            <p className="text-xs text-[#e8ede9]/70 mt-0.5">
              Votre mot de passe a été défini par un administrateur. Choisissez-en un nouveau pour accéder à la plateforme.
            </p>
          </div>
        </div>
      )}

      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider border-b border-[#1e2e25] pb-2">Profil</p>
        {me && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-[#7a8f80]">Email de connexion</p><p className="text-[#e8ede9]">{me.email}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Rôle</p><Badge variant="success">{ROLE_LABELS[me.role] ?? me.role}</Badge></div>
            <div><p className="text-xs text-[#7a8f80]">Entreprise</p><p className="text-[#e8ede9]">{me.companyName ?? 'Green-T'}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Dernière connexion</p><p className="text-[#e8ede9]">{fmtDateTime(me.lastLoginAt)}</p></div>
            <div><p className="text-xs text-[#7a8f80]">Mot de passe modifié le</p><p className="text-[#e8ede9]">{fmtDateTime(me.passwordChangedAt)}</p></div>
          </div>
        )}
        {!forced && (
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Input label="Nom complet" value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} required minLength={2} />
            <Input label="Téléphone" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+221 77 000 00 00" />
            <Button type="submit" loading={savingProfile}><Save size={14} /> Enregistrer</Button>
          </form>
        )}
        <p className="text-[11px] text-[#7a8f80]">Pour changer votre email de connexion, contactez votre administrateur.</p>
      </Card>

      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wider border-b border-[#1e2e25] pb-2 flex items-center gap-2">
          <KeyRound size={13} /> Changer mon mot de passe
        </p>
        <form onSubmit={changePassword} className="space-y-3 max-w-md">
          <Input label={forced ? 'Mot de passe temporaire' : 'Mot de passe actuel'} type="password" autoComplete="current-password"
            value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} required />
          <Input label="Nouveau mot de passe" type="password" autoComplete="new-password"
            value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} required minLength={8} />
          <Input label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password"
            value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} required minLength={8} />
          <p className="text-[11px] text-[#7a8f80]">8 caractères minimum, avec au moins une lettre et un chiffre.</p>
          {pwdError && <p role="alert" className="text-sm text-[#C0392B]">{pwdError}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={savingPwd}><KeyRound size={14} /> Modifier le mot de passe</Button>
            {forced && (
              <Button type="button" variant="ghost" onClick={() => { localStorage.clear(); router.push('/'); }}>Se déconnecter</Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
