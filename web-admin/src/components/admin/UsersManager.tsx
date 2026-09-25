'use client';

import { useMemo, useState } from 'react';
import { Button, Badge, Modal, Card, Skeleton, Input, Select, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import type { UsersApi } from '@/services';
import {
  Users, Plus, Search, Pencil, KeyRound, Power, Copy, Link2, ShieldAlert, Mail, Smartphone,
} from 'lucide-react';

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  finance_admin: 'Finance',
  support_admin: 'Support',
  admin: 'Administrateur',
  direction: 'Direction',
  chef_equipe: "Chef d'équipe",
  magasinier: 'Magasinier',
};

export const TENANT_ROLE_OPTIONS = ['admin', 'direction', 'chef_equipe', 'magasinier'];
export const CONSOLE_ROLE_OPTIONS = ['super_admin', 'finance_admin', 'support_admin'];

const LICENSE_LABELS: Record<string, string> = { web: 'Web', mobile: 'Mobile', rag: 'Assistant IA', geolocation: 'Géolocalisation' };

const ROLE_CLS: Record<string, string> = {
  admin: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
  super_admin: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
  direction: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30',
  finance_admin: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30',
  chef_equipe: 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30',
  support_admin: 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30',
  magasinier: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Jamais';
}

function copy(text: string, toast: ReturnType<typeof useToast>['toast']) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: 'Copié dans le presse-papiers', variant: 'success' }),
    () => toast({ title: 'Copie impossible', variant: 'error' }),
  );
}

type Credentials = { email: string; temporaryPassword?: string; resetUrl?: string; emailed?: boolean; title: string };

export interface UsersManagerProps {
  api: UsersApi;
  roleOptions: string[];
  /** Id de l'utilisateur connecté (pas d'auto-désactivation / auto-changement de rôle). */
  currentUserId?: string;
  /** Techniciens du tenant, pour lier un compte mobile (admin tenant). */
  technicians?: { id: string; fullName: string; userId?: string | null }[];
  canManage?: boolean;
  canResetPassword?: boolean;
  title?: string;
  onChanged?: () => void;
}

export function UsersManager({
  api, roleOptions, currentUserId, technicians, canManage = true, canResetPassword = true, title = 'Utilisateurs', onChanged,
}: UsersManagerProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<any | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const { data, loading, refetch, error } = useQuery(() => api.list(), [api]);
  const users: any[] = Array.isArray(data) ? data : [];
  const list = useMemo(() => users.filter(u => {
    const q = search.trim().toLowerCase();
    return !q || [u.fullName, u.email, u.phone, ROLE_LABELS[u.role]].some(v => (v ?? '').toLowerCase().includes(q));
  }), [users, search]);

  const done = () => { refetch(); onChanged?.(); };
  const fail = (e: Error) => toast({ title: 'Action impossible', description: e.message, variant: 'error' });

  const createMut = useMutation((d: any) => api.create(d), {
    onSuccess: (res: any) => {
      setCreating(false);
      done();
      toast({ title: 'Compte créé', variant: 'success' });
      setCredentials({
        title: 'Compte créé',
        email: res?.user?.email,
        temporaryPassword: res?.temporaryPassword,
        emailed: res?.emailed,
      });
    },
    onError: fail,
  });
  const updateMut = useMutation(({ id, data }: any) => api.update(id, data), {
    onSuccess: () => { setEditing(null); done(); toast({ title: 'Compte mis à jour', variant: 'success' }); },
    onError: fail,
  });
  const activeMut = useMutation(({ id, active }: any) => api.setActive(id, active), {
    onSuccess: (u: any) => { done(); toast({ title: u?.active ? 'Compte réactivé' : 'Compte désactivé', variant: 'success' }); },
    onError: fail,
  });
  const pwdMut = useMutation(({ id, data }: any) => api.setPassword(id, data), {
    onSuccess: (res: any) => {
      setPwdTarget(null);
      done();
      setCredentials({ title: 'Nouveau mot de passe défini', email: res?.email, temporaryPassword: res?.temporaryPassword });
      toast({ title: 'Mot de passe modifié', description: 'Les sessions en cours sont déconnectées', variant: 'success' });
    },
    onError: fail,
  });
  const linkMut = useMutation((id: string) => api.resetLink(id), {
    onSuccess: (res: any) => {
      setPwdTarget(null);
      setCredentials({ title: 'Lien de réinitialisation', email: res?.email, resetUrl: res?.resetUrl, emailed: res?.emailed });
    },
    onError: fail,
  });
  const techMut = useMutation(({ id, technicianId }: any) => api.linkTechnician!(id, technicianId), {
    onSuccess: () => { done(); toast({ title: 'Technicien associé', variant: 'success' }); },
    onError: fail,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#0f9d70]" />
          <p className="text-sm font-semibold text-[#e8ede9]">{title}</p>
          <Badge>{users.filter(u => u.active).length} actifs / {users.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8f80]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="h-9 w-52 pl-9 pr-3 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50" />
          </div>
          {canManage && <Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> Ajouter</Button>}
        </div>
      </div>

      {error && <p className="text-sm text-[#C0392B]">{error}</p>}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#7a8f80]">Aucun utilisateur</Card>
      ) : (
        <div className="overflow-x-auto rounded-[0.625rem] border border-[#1e2e25]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2e25] bg-[#111916]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Utilisateur</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Rôle</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Licence</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Statut</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[#7a8f80]">Dernière connexion</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[#7a8f80]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50 bg-[#111916]">
              {list.map(u => (
                <tr key={u.id} className={'hover:bg-[#172019] ' + (u.active ? '' : 'opacity-60')}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-[#e8ede9]">{u.fullName}{u.id === currentUserId && <span className="text-xs text-[#7a8f80]"> (vous)</span>}</p>
                    <p className="text-xs text-[#7a8f80]">{u.email}{u.phone ? ' · ' + u.phone : ''}</p>
                    {u.technicians?.length > 0 && (
                      <p className="text-[11px] text-[#5b8def] flex items-center gap-1 mt-0.5">
                        <Smartphone size={11} /> {u.technicians.map((t: any) => t.fullName).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><Badge className={ROLE_CLS[u.role]}>{ROLE_LABELS[u.role] ?? u.role}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-[#7a8f80]">{u.licenseType ? LICENSE_LABELS[u.licenseType] ?? u.licenseType : '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {u.active ? <Badge variant="success">Actif</Badge> : <Badge variant="danger">Désactivé</Badge>}
                      {u.mustChangePassword && <Badge variant="warning"><ShieldAlert size={10} /> Mot de passe temporaire</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#7a8f80]">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <button onClick={() => setEditing(u)} title="Modifier" aria-label={'Modifier ' + u.fullName}
                          className="p-1.5 rounded-md text-[#7a8f80] hover:text-[#e8ede9] hover:bg-[#1a2420]"><Pencil size={14} /></button>
                      )}
                      {canResetPassword && (
                        <button onClick={() => setPwdTarget(u)} title="Mot de passe" aria-label={'Mot de passe de ' + u.fullName}
                          className="p-1.5 rounded-md text-[#7a8f80] hover:text-[#f5a623] hover:bg-[#1a2420]"><KeyRound size={14} /></button>
                      )}
                      {canManage && u.id !== currentUserId && (
                        <button
                          onClick={() => {
                            if (u.active && !window.confirm(`Désactiver le compte de ${u.fullName} ? Ses sessions seront coupées immédiatement.`)) return;
                            activeMut.mutate({ id: u.id, active: !u.active });
                          }}
                          title={u.active ? 'Désactiver' : 'Réactiver'}
                          aria-label={(u.active ? 'Désactiver ' : 'Réactiver ') + u.fullName}
                          className={'p-1.5 rounded-md hover:bg-[#1a2420] ' + (u.active ? 'text-[#0f9d70] hover:text-[#C0392B]' : 'text-[#C0392B] hover:text-[#0f9d70]')}
                        ><Power size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <UserFormModal
          mode="create"
          roleOptions={roleOptions}
          loading={createMut.loading}
          onClose={() => setCreating(false)}
          onSubmit={d => createMut.mutate(d)}
        />
      )}
      {editing && (
        <UserFormModal
          mode="edit"
          user={editing}
          roleOptions={roleOptions}
          isSelf={editing.id === currentUserId}
          technicians={api.linkTechnician ? technicians : undefined}
          loading={updateMut.loading || techMut.loading}
          onClose={() => setEditing(null)}
          onSubmit={(d, technicianId) => {
            const current = editing.technicians?.[0]?.id ?? null;
            if (api.linkTechnician && technicianId !== undefined && technicianId !== current) {
              techMut.mutate({ id: editing.id, technicianId });
            }
            updateMut.mutate({ id: editing.id, data: d });
          }}
        />
      )}
      {pwdTarget && (
        <PasswordModal
          user={pwdTarget}
          loading={pwdMut.loading || linkMut.loading}
          onClose={() => setPwdTarget(null)}
          onSetPassword={d => pwdMut.mutate({ id: pwdTarget.id, data: d })}
          onResetLink={() => linkMut.mutate(pwdTarget.id)}
        />
      )}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} onCopy={t => copy(t, toast)} />}
    </div>
  );
}

function UserFormModal({ mode, user, roleOptions, isSelf, technicians, loading, onClose, onSubmit }: {
  mode: 'create' | 'edit';
  user?: any;
  roleOptions: string[];
  isSelf?: boolean;
  technicians?: { id: string; fullName: string; userId?: string | null }[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (d: any, technicianId?: string | null) => void;
}) {
  const [f, setF] = useState({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: user?.role ?? roleOptions[roleOptions.length > 1 ? 1 : 0],
    licenseType: user?.licenseType ?? '',
    passwordMode: 'generate' as 'generate' | 'manual',
    password: '',
    mustChangePassword: true,
    sendWelcomeEmail: true,
  });
  const [technicianId, setTechnicianId] = useState<string>(user?.technicians?.[0]?.id ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      onSubmit({
        fullName: f.fullName,
        email: f.email,
        phone: f.phone || undefined,
        role: f.role,
        licenseType: f.licenseType || undefined,
        password: f.passwordMode === 'manual' ? f.password : undefined,
        mustChangePassword: f.mustChangePassword,
        sendWelcomeEmail: f.sendWelcomeEmail,
      });
      return;
    }
    const changes: any = {};
    if (f.fullName !== user.fullName) changes.fullName = f.fullName;
    if (f.email.toLowerCase() !== user.email) changes.email = f.email;
    if ((f.phone || null) !== (user.phone || null)) changes.phone = f.phone || null;
    if (f.role !== user.role) changes.role = f.role;
    if ((f.licenseType || null) !== (user.licenseType || null)) changes.licenseType = f.licenseType || null;
    onSubmit(changes, technicians ? (technicianId || null) : undefined);
  };

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? 'Nouvel utilisateur' : 'Modifier le compte'} size="lg">
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nom complet *" value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value })} required minLength={2} />
          <Input label="Email de connexion *" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
          <Input label="Téléphone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+221 77 000 00 00" />
          <Select label="Rôle *" value={f.role} onChange={e => setF({ ...f, role: e.target.value })} disabled={isSelf}>
            {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </Select>
          <Select label="Licence" value={f.licenseType} onChange={e => setF({ ...f, licenseType: e.target.value })}>
            <option value="">Par défaut</option>
            {Object.entries(LICENSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {technicians && (
            <Select label="Technicien lié (compte mobile)" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
              <option value="">Aucun</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.fullName}{t.userId && t.userId !== user?.id ? ' (déjà lié)' : ''}
                </option>
              ))}
            </Select>
          )}
        </div>
        {isSelf && <p className="text-[11px] text-[#7a8f80]">Vous ne pouvez pas modifier votre propre rôle.</p>}
        {mode === 'edit' && f.email.toLowerCase() !== user.email && (
          <p className="text-xs text-[#f5a623]">L’utilisateur devra se connecter avec la nouvelle adresse : {f.email.toLowerCase()}</p>
        )}

        {mode === 'create' && (
          <div className="space-y-2 rounded-lg border border-[#1e2e25] p-3">
            <p className="text-xs font-semibold text-[#7a8f80] uppercase tracking-wide">Mot de passe initial</p>
            <div className="flex gap-4 text-sm text-[#e8ede9]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={f.passwordMode === 'generate'} onChange={() => setF({ ...f, passwordMode: 'generate' })} className="accent-[#0f9d70]" />
                Générer automatiquement
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={f.passwordMode === 'manual'} onChange={() => setF({ ...f, passwordMode: 'manual' })} className="accent-[#0f9d70]" />
                Saisir
              </label>
            </div>
            {f.passwordMode === 'manual' && (
              <Input label="Mot de passe (8 caractères, lettre + chiffre)" type="text" value={f.password}
                onChange={e => setF({ ...f, password: e.target.value })} required minLength={8} />
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#e8ede9]">
              <input type="checkbox" checked={f.mustChangePassword} onChange={e => setF({ ...f, mustChangePassword: e.target.checked })} className="h-4 w-4 accent-[#0f9d70]" />
              Obliger à changer le mot de passe à la première connexion
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[#e8ede9]">
              <input type="checkbox" checked={f.sendWelcomeEmail} onChange={e => setF({ ...f, sendWelcomeEmail: e.target.checked })} className="h-4 w-4 accent-[#0f9d70]" />
              Envoyer les accès par email (si l’envoi d’emails est configuré)
            </label>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={loading}>{mode === 'create' ? 'Créer le compte' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ user, loading, onClose, onSetPassword, onResetLink }: {
  user: any;
  loading: boolean;
  onClose: () => void;
  onSetPassword: (d: { password?: string; mustChangePassword: boolean }) => void;
  onResetLink: () => void;
}) {
  const [mode, setMode] = useState<'generate' | 'manual' | 'link'>('generate');
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);

  return (
    <Modal open onClose={onClose} title={'Mot de passe — ' + user.fullName} size="md">
      <div className="space-y-3">
        <p className="text-xs text-[#7a8f80]">{user.email}</p>
        <div className="space-y-2 text-sm text-[#e8ede9]">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" checked={mode === 'generate'} onChange={() => setMode('generate')} className="mt-1 accent-[#0f9d70]" />
            <span>Générer un mot de passe temporaire<br /><span className="text-xs text-[#7a8f80]">Affiché une seule fois, à transmettre à l’utilisateur.</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} className="mt-1 accent-[#0f9d70]" />
            <span>Définir un mot de passe précis</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} className="mt-1 accent-[#0f9d70]" />
            <span>Créer un lien de réinitialisation (valable 1 h)<br /><span className="text-xs text-[#7a8f80]">L’utilisateur choisit lui-même son mot de passe. Envoyé par email si configuré.</span></span>
          </label>
        </div>
        {mode === 'manual' && (
          <Input label="Nouveau mot de passe" type="text" value={password} onChange={e => setPassword(e.target.value)} minLength={8} placeholder="8 caractères, lettre + chiffre" />
        )}
        {mode !== 'link' && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#e8ede9]">
            <input type="checkbox" checked={mustChange} onChange={e => setMustChange(e.target.checked)} className="h-4 w-4 accent-[#0f9d70]" />
            Obliger à le changer à la prochaine connexion
          </label>
        )}
        {mode !== 'link' && <p className="text-[11px] text-[#f5a623]">Les sessions ouvertes de cet utilisateur (web et mobile) seront déconnectées.</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            loading={loading}
            disabled={mode === 'manual' && password.length < 8}
            onClick={() => mode === 'link' ? onResetLink() : onSetPassword({ password: mode === 'manual' ? password : undefined, mustChangePassword: mustChange })}
          >
            {mode === 'link' ? <><Link2 size={14} /> Créer le lien</> : <><KeyRound size={14} /> Appliquer</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CredentialsModal({ credentials, onClose, onCopy }: { credentials: Credentials; onClose: () => void; onCopy: (t: string) => void }) {
  const { email, temporaryPassword, resetUrl, emailed } = credentials;
  const shareText = temporaryPassword
    ? `Identifiant : ${email}\nMot de passe temporaire : ${temporaryPassword}`
    : resetUrl ? `Lien de réinitialisation pour ${email} (valable 1 h) :\n${resetUrl}` : email;

  return (
    <Modal open onClose={onClose} title={credentials.title} size="md">
      <div className="space-y-3">
        {emailed && (
          <p className="flex items-center gap-2 text-sm text-[#0f9d70]"><Mail size={14} /> Envoyé par email à {email}</p>
        )}
        <div className="rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-3 space-y-2 text-sm">
          <div><p className="text-xs text-[#7a8f80]">Identifiant</p><p className="text-[#e8ede9] font-mono">{email}</p></div>
          {temporaryPassword && (
            <div><p className="text-xs text-[#7a8f80]">Mot de passe temporaire</p><p className="text-[#f5a623] font-mono text-base">{temporaryPassword}</p></div>
          )}
          {resetUrl && (
            <div><p className="text-xs text-[#7a8f80]">Lien (1 h)</p><p className="text-[#e8ede9] font-mono text-xs break-all">{resetUrl}</p></div>
          )}
          {!temporaryPassword && !resetUrl && (
            <p className="text-xs text-[#7a8f80]">Le mot de passe saisi a été enregistré.</p>
          )}
        </div>
        {temporaryPassword && <p className="text-[11px] text-[#7a8f80]">Ce mot de passe ne sera plus affiché. Copiez-le maintenant.</p>}
        <div className="flex gap-2 justify-end">
          {(temporaryPassword || resetUrl) && <Button variant="secondary" onClick={() => onCopy(shareText)}><Copy size={14} /> Copier</Button>}
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  );
}
