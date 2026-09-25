'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui';
import { consoleTeamService } from '@/services';
import { UsersManager, CONSOLE_ROLE_OPTIONS } from '@/components/admin/UsersManager';
import { UsersRound, Info } from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    try { setMe(JSON.parse(localStorage.getItem('vectracom_user') || 'null')); } catch { /* ignore */ }
  }, []);

  if (me && me.role !== 'super_admin') {
    return <Card className="p-8 text-center text-sm text-[#7a8f80]">Réservé au super admin Green-T</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><UsersRound size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9]">Équipe Green-T</h1>
          <p className="text-xs text-[#7a8f80]">Comptes d’accès à la console plateforme</p>
        </div>
      </div>
      <Card className="p-3 flex items-start gap-2 text-xs text-[#7a8f80]">
        <Info size={14} className="shrink-0 mt-0.5 text-[#5b8def]" />
        <p>
          Super admin : tous les droits · Finance : tenants, abonnements, facturation SaaS, comptes clients ·
          Support : consultation des tenants et du journal, réinitialisation des mots de passe clients.
        </p>
      </Card>
      <Card className="p-4">
        {me && (
          <UsersManager api={consoleTeamService} roleOptions={CONSOLE_ROLE_OPTIONS} currentUserId={me.id} title="Membres" />
        )}
      </Card>
    </div>
  );
}
