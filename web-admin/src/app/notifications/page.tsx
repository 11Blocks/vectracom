'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Badge, Card, Skeleton, Input, useToast, Tabs } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { notificationsService } from '@/services';
import {
  Bell, CheckCheck, Loader2, Settings2, Send, AlertTriangle, Package, CalendarClock,
  ShieldAlert, Wallet, Info,
} from 'lucide-react';

const SEV_META: Record<string, { label: string; cls: string; icon: any }> = {
  CRITICAL: { label: 'Critique', cls: 'bg-[#C0392B]/20 text-[#C0392B] border-[#C0392B]/30', icon: AlertTriangle },
  WARNING: { label: 'Attention', cls: 'bg-[#D9822B]/20 text-[#D9822B] border-[#D9822B]/30', icon: CalendarClock },
  INFO: { label: 'Info', cls: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]', icon: Info },
};

const TYPE_META: Record<string, string> = {
  mission_urgente: 'Intervention urgente',
  echeance: 'Échéance légale/sécurité',
  rupture_stock: 'Rupture de stock',
  incident: 'Incident critique',
  relance_paiement: 'Relance de paiement',
};

const CHANNEL_LABELS: Array<{ key: string; label: string }> = [
  { key: 'pushEnabled', label: 'Push mobile (Expo)' },
  { key: 'whatsappEnabled', label: 'WhatsApp' },
  { key: 'emailEnabled', label: 'E-mail' },
  { key: 'telegramEnabled', label: 'Telegram' },
];
const ALERT_LABELS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'missionUrgentEnabled', label: 'Intervention urgente', desc: 'Push au technicien à l’attribution' },
  { key: 'echeanceEnabled', label: 'Échéance légale/sécurité', desc: 'J-7 puis relance J-1 — véhicules, habilitations' },
  { key: 'stockAlertEnabled', label: 'Rupture de stock', desc: 'In-app magasinier, une seule fois au passage de seuil' },
  { key: 'incidentAlertEnabled', label: 'Incident critique', desc: 'Push aux administrateurs au signalement' },
  { key: 'paymentAlertEnabled', label: 'Relance de paiement', desc: 'J+15, J+20, J+30 — email + WhatsApp client' },
];

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const { toast } = useToast();
  const [tab, setTab] = useState('liste');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, loading, refetch } = useQuery(
    () => notificationsService.list(unreadOnly ? { unreadOnly: 'true' } : undefined),
    [unreadOnly],
  );
  const { data: settings, refetch: refetchSettings } = useQuery(() => notificationsService.getSettings(), []);
  const notifications = Array.isArray(data) ? data : [];

  const markAllMut = useMutation(() => notificationsService.markAllAsRead(), {
    onSuccess: () => { toast({ title: 'Tout marqué comme lu', variant: 'success' }); refetch(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });
  const markOneMut = useMutation((id: string) => notificationsService.markAsRead(id), {
    onSuccess: () => refetch(),
    onError: () => { },
  });
  const testMut = useMutation((channel: string) => notificationsService.test(channel), {
    onSuccess: () => toast({ title: 'Test envoyé', variant: 'success' }),
    onError: (e: any) => toast({ title: 'Test impossible', description: e.message, variant: 'error' }),
  });
  const settingsMut = useMutation((d: any) => notificationsService.updateSettings(d), {
    onSuccess: () => { toast({ title: 'Paramètres enregistrés', variant: 'success' }); refetchSettings(); },
    onError: (e: any) => toast({ title: 'Erreur', description: e.message, variant: 'error' }),
  });

  const unread = notifications.filter(n => !n.readAt).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Bell size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Notifications</h1>
            <p className="text-xs text-[#7a8f80]">Cloche centralisée — {unread > 0 ? `${unread} non lue(s)` : 'tout est lu'}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => markAllMut.mutate()} disabled={markAllMut.loading || unread === 0}>
          {markAllMut.loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Tout marquer lu
        </Button>
      </div>

      <Tabs
        tabs={[{ value: 'liste', label: 'Liste', count: notifications.length }, { value: 'settings', label: 'Paramètres' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'liste' ? (
        <>
          <button onClick={() => setUnreadOnly(v => !v)}
            className={'rounded-lg border px-3 py-1.5 text-sm transition-colors ' + (unreadOnly ? 'border-[#0f9d70] bg-[#0f9d70]/10 text-[#0f9d70]' : 'border-[#1e2e25] text-[#7a8f80] hover:text-[#e8ede9]')}>
            {unreadOnly ? 'Non lues uniquement' : 'Toutes'}
          </button>
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : notifications.length === 0 ? (
            <Card className="border-[#1e2e25] bg-[#111916] p-12 text-center">
              <Bell size={40} className="mx-auto text-[#7a8f80]/50 mb-3" />
              <p className="text-sm text-[#7a8f80]">Aucune notification</p>
              <p className="text-xs text-[#7a8f80]/60 mt-1">Philosophie : une notification ne part que si elle exige une action immédiate.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: any) => {
                const sev = SEV_META[n.priority ?? n.severity ?? 'INFO'] ?? SEV_META.INFO;
                const Icon = sev.icon;
                return (
                  <Card key={n.id} className={'p-4 cursor-pointer transition-all ' + (n.readAt ? 'border-[#1e2e25] bg-[#111916] opacity-70' : 'border-[#0f9d70]/30 bg-[#111916]')}
                    onClick={() => !n.readAt && markOneMut.mutate(n.id)}>
                    <div className="flex items-start gap-3">
                      <span className={'p-2 rounded-lg bg-[#1a2420] shrink-0 ' + (sev.cls.includes('C0392B') ? 'text-[#C0392B]' : sev.cls.includes('D9822B') ? 'text-[#D9822B]' : 'text-[#7a8f80]')}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#e8ede9]">{n.title}</p>
                          <Badge className={sev.cls}>{sev.label}</Badge>
                          {!n.readAt && <span className="h-2 w-2 rounded-full bg-[#0f9d70]" title="Non lue" />}
                        </div>
                        <p className="text-sm text-[#7a8f80] mt-0.5">{n.body ?? n.message}</p>
                        <p className="text-xs text-[#7a8f80]/60 mt-1">
                          {TYPE_META[n.type] ?? n.type} · {n.channel} · {fmtDateTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Canaux */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-3 flex items-center gap-2"><Settings2 size={15} className="text-[#0f9d70]" /> Canaux de diffusion</h3>
            <div className="space-y-2">
              {CHANNEL_LABELS.map(c => (
                <Toggle
                  key={c.key} label={c.label}
                  value={!!(settings as any)?.[c.key]}
                  onChange={v => settingsMut.mutate({ [c.key]: v })}
                  disabled={settingsMut.loading}
                />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[#1e2e25] flex items-center justify-between">
              <p className="text-xs text-[#7a8f80]">Tester la diffusion (simulation)</p>
              <Button size="sm" variant="secondary" disabled={testMut.loading} onClick={() => testMut.mutate('in_app')}>
                {testMut.loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Tester
              </Button>
            </div>
          </Card>

          {/* Types d'alertes */}
          <Card className="border-[#1e2e25] bg-[#111916] p-4">
            <h3 className="text-sm font-semibold text-[#e8ede9] mb-1 flex items-center gap-2"><ShieldAlert size={15} className="text-[#0f9d70]" /> Types d'alertes actives</h3>
            <p className="text-xs text-[#7a8f80] mb-3">5 notifications seulement — jamais de confirmations, résumés ou rappels périodiques.</p>
            <div className="space-y-2.5">
              {ALERT_LABELS.map(a => (
                <div key={a.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#e8ede9]">{a.label}</p>
                    <p className="text-xs text-[#7a8f80]">{a.desc}</p>
                  </div>
                  <Toggle
                    small
                    value={!!(settings as any)?.[a.key]}
                    onChange={v => settingsMut.mutate({ [a.key]: v })}
                    disabled={settingsMut.loading}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange, disabled, small }: {
  label?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; small?: boolean;
}) {
  return small ? (
    <button type="button" disabled={disabled} onClick={() => onChange(!value)}
      className={'relative h-5 w-9 rounded-full transition-colors shrink-0 ' + (value ? 'bg-[#0f9d70]' : 'bg-[#1e2e25]')}>
      <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (value ? 'left-[1.15rem]' : 'left-0.5')} />
    </button>
  ) : (
    <button type="button" disabled={disabled} onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between rounded-lg border border-[#1e2e25] bg-[#0a0f0d] px-3 py-2.5 hover:border-[#0f9d70]/40 transition-colors">
      <span className="text-sm text-[#e8ede9]">{label}</span>
      <span className={'relative h-5 w-9 rounded-full transition-colors shrink-0 ' + (value ? 'bg-[#0f9d70]' : 'bg-[#1e2e25]')}>
        <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (value ? 'left-[1.15rem]' : 'left-0.5')} />
      </span>
    </button>
  );
}
