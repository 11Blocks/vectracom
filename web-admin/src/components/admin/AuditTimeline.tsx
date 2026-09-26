'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Skeleton } from '@/components/ui';
import { History } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Échec de connexion',
  'auth.password_changed': 'A changé son mot de passe',
  'auth.password_reset': 'Mot de passe réinitialisé via lien',
  'auth.forgot_password': 'Demande « mot de passe oublié »',
  'auth.impersonate': 'Connexion en tant que (support)',
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.activate': 'Compte réactivé',
  'user.deactivate': 'Compte désactivé',
  'user.password_set': 'Mot de passe défini par un admin',
  'user.reset_link': 'Lien de réinitialisation créé',
  'user.link_technician': 'Technicien associé',
  'user.unlink_technician': 'Technicien dissocié',
  'tenant.create': 'Tenant créé',
  'tenant.update': 'Fiche tenant modifiée',
  'tenant.activate': 'Tenant réactivé',
  'tenant.deactivate': 'Tenant désactivé',
  'tenant.subscription_status': "Statut d'abonnement modifié",
  'tenant.archive': 'Tenant archivé',
  'tenant.restore': 'Tenant restauré',
  'invoice.generate': 'Facture générée (période)',
  'invoice.create_manual': 'Facture manuelle créée',
  'invoice.correct': 'Ligne de facture corrigée',
  'invoice.update_header': 'En-tête de facture modifié',
  'invoice.finalize': 'Facture émise',
  'invoice.send': 'Facture marquée envoyée',
  'invoice.payment_add': 'Encaissement enregistré',
  'invoice.payment_remove': 'Encaissement supprimé',
  'invoice.cancel_credit_note': 'Facture annulée (avoir)',
  'invoice.delete_draft': 'Brouillon de facture supprimé',
  'invoice.line_add': 'Ligne ajoutée à la facture',
  'invoice.line_remove': 'Ligne retirée de la facture',
  'client.create': 'Client créé',
  'client.update': 'Client modifié',
  'cash.create': 'Mouvement de caisse',
  'cash.update': 'Mouvement de caisse modifié',
  'cash.cancel': 'Mouvement de caisse annulé',
  'cash.repay': 'Remboursement de prêt',
  'expense.create': 'Dépense créée',
  'expense.update': 'Dépense modifiée',
  'expense.delete': 'Dépense supprimée',
  'price.create': 'Prix ajouté au bordereau',
  'price.update': 'Prix modifié',
  'price.delete': 'Prix supprimé',
  'price.version_duplicate': 'Nouvelle version du bordereau',
  'price.version_activate': 'Version du bordereau activée',
  'mission.status': 'Statut de mission changé',
  'mission.delete': 'Mission supprimée',
  'planning.import': 'Import planning SONATEL',
  'stock.movement': 'Mouvement de stock',
  'stock.movement_cancel': 'Mouvement de stock annulé',
  'stock.inventory': 'Inventaire enregistré',
  'stock.focus_import': 'Import FOCUS (stock)',
  'hr.hire': 'Embauche',
  'hr.leave_approve': 'Congé approuvé',
  'hr.leave_refuse': 'Congé refusé',
  'hr.leave_cancel': 'Congé annulé',
  'hr.clock_in': 'Pointage journaliers',
  'hr.clock_in_remove': 'Pointage retiré',
};

const DANGER = new Set([
  'auth.login_failed', 'user.deactivate', 'tenant.deactivate', 'tenant.archive', 'auth.impersonate',
  'invoice.cancel_credit_note', 'invoice.payment_remove', 'invoice.delete_draft', 'cash.cancel', 'expense.delete',
  'price.delete', 'mission.delete', 'stock.movement_cancel', 'hr.leave_cancel', 'hr.clock_in_remove',
]);

const VERB: Record<string, string> = { POST: 'Création / action', PUT: 'Modification', PATCH: 'Modification', DELETE: 'Suppression' };

/** « POST /api/v1/leave-requests/:id/approve → 200 » → « Création / action · leave-requests/approve (200) ». */
function labelOf(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const m = /^(POST|PUT|PATCH|DELETE) (\S+) → (\d+)$/.exec(action);
  if (!m) return action;
  const path = m[2].replace(/^\/?api\/v1\//, '').split('/').filter(s => s && !s.startsWith(':')).join('/');
  return `${VERB[m[1]] ?? m[1]} · ${path} (${m[3]})`;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', email: 'Email', fullName: 'Nom complet', phone: 'Téléphone', role: 'Rôle', licenseType: 'Licence',
  sonatelSubcontractorName: 'ST SONATEL', contactName: 'Contact', contactEmail: 'Email contact', contactPhone: 'Tél. contact',
  address: 'Adresse', city: 'Ville', ninea: 'NINEA', rccm: 'RCCM', notes: 'Notes', maxUsers: 'Plafond utilisateurs',
  onboardingPaid: 'Onboarding payé', platformFeePaid: 'Frais plateforme payés',
  subscriptionStartDate: 'Début abonnement', subscriptionEndDate: 'Fin abonnement', trialEndDate: "Fin d'essai",
};

const PAYLOAD_LABELS: Record<string, string> = {
  invoiceNumber: 'Facture', reference: 'Référence', type: 'Type', from: 'De', to: 'Vers', status: 'Statut',
  amount: 'Montant', quantity: 'Quantité', reason: 'Motif', day: 'Jour', workers: 'Journaliers', name: 'Nom',
  created: 'Créés', updated: 'Mis à jour', skipped: 'Ignorés',
};

function fmt(v: unknown) {
  if (v === null || v === undefined || v === '') return '∅';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

function describe(item: any): string | null {
  const p = item.payload ?? {};
  if (p.changes && typeof p.changes === 'object') {
    return Object.entries(p.changes as Record<string, { from: unknown; to: unknown }>)
      .map(([k, c]) => `${FIELD_LABELS[k] ?? k} : ${fmt(c.from)} → ${fmt(c.to)}`)
      .join(' · ');
  }
  if (item.action === 'tenant.subscription_status') return `${fmt(p.from)} → ${fmt(p.to)}`;
  if (item.action === 'auth.login_failed') return p.email ? `Email : ${p.email}` : null;
  if (item.action === 'user.create') return [p.email, p.role].filter(Boolean).join(' · ') + (p.emailed ? ' · accès envoyés par email' : '');
  if (p.email) return p.email + (p.emailed ? ' · envoyé par email' : '');
  if (p.body?.error || p.error) return String(p.body?.error ?? p.error);
  const parts = Object.entries(PAYLOAD_LABELS)
    .filter(([k]) => p[k] !== undefined && p[k] !== null && typeof p[k] !== 'object')
    .map(([k, label]) => `${label} : ${fmt(p[k])}`);
  return parts.length ? parts.join(' · ') : null;
}

export function AuditTimeline({ fetcher, deps = [], showCompany = false }: {
  fetcher: (params: Record<string, string>) => Promise<any>;
  deps?: unknown[];
  showCompany?: boolean;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const PAGE = 50;

  const load = async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher({ limit: String(PAGE), offset: String(offset), ...(all ? { all: 'true' } : {}) });
      const rows = res?.items ?? [];
      setItems(prev => (offset === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0); }, [all, ...deps]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#e8ede9] flex items-center gap-2"><History size={15} className="text-[#0f9d70]" /> Journal des actions</p>
        <label className="flex items-center gap-2 text-xs text-[#7a8f80] cursor-pointer">
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="accent-[#0f9d70]" />
          Inclure les traces techniques (requêtes API)
        </label>
      </div>
      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
      {items.length === 0 && loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#7a8f80] py-6 text-center">Aucune action enregistrée</p>
      ) : (
        <ul className="divide-y divide-[#1e2e25]/60">
          {items.map(item => {
            const detail = describe(item);
            return (
              <li key={item.id} className="py-2.5 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-[#e8ede9] flex items-center gap-2 flex-wrap">
                    <Badge variant={DANGER.has(item.action) || / → [45]\d\d$/.test(item.action) ? 'danger' : ACTION_LABELS[item.action] ? 'success' : 'neutral'}>
                      {labelOf(item.action)}
                    </Badge>
                    {showCompany && item.companyName && <span className="text-xs text-[#5b8def]">{item.companyName}</span>}
                  </p>
                  {detail && <p className="text-xs text-[#7a8f80] mt-1 break-words">{detail}</p>}
                </div>
                <div className="text-right text-xs text-[#7a8f80] shrink-0">
                  <p>{new Date(item.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}</p>
                  <p>{item.userName ? `${item.userName} (${item.userEmail})` : item.userEmail ?? 'Système'}{item.ip ? ` · ${item.ip}` : ''}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <div className="text-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={() => load(items.length)}>Charger plus</Button>
        </div>
      )}
    </div>
  );
}
