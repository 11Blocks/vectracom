'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui';
import { tenantsService } from '@/services';

export const CONSOLE_ROLES = ['super_admin', 'finance_admin', 'support_admin'];

/** Utilisateur connecté (localStorage) + indicateur console Green-T. */
export function useSessionUser() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('vectracom_user') || 'null')); } catch { /* ignore */ }
  }, []);
  return { user, isConsole: CONSOLE_ROLES.includes(user?.role) };
}

/** Sélecteur de tenant pour les écrans SaaS vus depuis la console. `allowAll` ajoute « Tous les tenants ». */
export function TenantPicker({ value, onChange, allowAll = false, className }: {
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
  className?: string;
}) {
  const [tenants, setTenants] = useState<any[]>([]);
  useEffect(() => {
    tenantsService.list().then((list: any) => {
      const arr = Array.isArray(list) ? list : [];
      setTenants(arr);
      if (!value && !allowAll && arr[0]) onChange(arr[0].id);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className ?? 'w-64'}>
      <Select value={value} onChange={e => onChange(e.target.value)} aria-label="Tenant">
        {allowAll && <option value="">Tous les tenants</option>}
        {!allowAll && !value && <option value="">Choisir un tenant…</option>}
        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    </div>
  );
}
