'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Select } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { auditService, tenantsService } from '@/services';
import { AuditTimeline } from '@/components/admin/AuditTimeline';
import { History } from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const [scope, setScope] = useState('');
  const { data: tenants } = useQuery(() => tenantsService.list(true), []);
  const list: any[] = Array.isArray(tenants) ? tenants : [];

  const params = scope === 'console' ? { scope: 'console' } : scope ? { companyId: scope } : {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><History size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Journal d&apos;audit</h1>
            <p className="text-xs text-[#7a8f80]">Connexions, comptes, mots de passe et modifications des tenants</p>
          </div>
        </div>
        <div className="w-72">
          <Select value={scope} onChange={e => setScope(e.target.value)} aria-label="Filtrer">
            <option value="">Tous les tenants et la console</option>
            <option value="console">Équipe Green-T (hors tenant)</option>
            {list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
      </div>
      <Card className="p-4">
        <AuditTimeline fetcher={(p) => auditService.list({ ...params, ...p })} deps={[scope]} showCompany={!scope} />
      </Card>
    </div>
  );
}
