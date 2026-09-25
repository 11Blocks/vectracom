'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { usersService, techniciansService } from '@/services';
import { UsersManager, TENANT_ROLE_OPTIONS } from '@/components/admin/UsersManager';
import { ArrowLeft, UserCog, Info } from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    try { setMe(JSON.parse(localStorage.getItem('vectracom_user') || 'null')); } catch { /* ignore */ }
  }, []);
  const isAdmin = me?.role === 'admin';

  const { data: techData, refetch: refetchTechs } = useQuery(
    () => (isAdmin ? techniciansService.list() : Promise.resolve([])),
    [isAdmin],
  );
  const techList: any[] = Array.isArray(techData) ? techData : techData?.items ?? techData?.data ?? [];
  const technicians = techList.map(t => ({ id: t.id, fullName: t.fullName, userId: t.userId ?? null }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/parametres" className="text-[#7a8f80] hover:text-[#0f9d70]" aria-label="Retour"><ArrowLeft size={18} /></Link>
        <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><UserCog size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9]">Comptes utilisateurs</h1>
          <p className="text-xs text-[#7a8f80]">Accès web et mobile de {me?.companyName ?? 'votre entreprise'}</p>
        </div>
      </div>

      <Card className="p-3 flex items-start gap-2 text-xs text-[#7a8f80]">
        <Info size={14} className="shrink-0 mt-0.5 text-[#5b8def]" />
        <p>
          Administrateur : accès complet · Direction : pilotage et validation · Chef d’équipe : application mobile terrain
          (liez-le à son technicien) · Magasinier : stock. Détail des droits dans{' '}
          <Link href="/parametres/permissions" className="text-[#0f9d70] hover:underline">Permissions</Link>.
        </p>
      </Card>

      <Card className="p-4">
        {me && (
          <UsersManager
            api={usersService}
            roleOptions={TENANT_ROLE_OPTIONS}
            currentUserId={me.id}
            technicians={isAdmin ? technicians : undefined}
            canManage={isAdmin}
            canResetPassword={isAdmin}
            title="Utilisateurs"
            onChanged={refetchTechs}
          />
        )}
      </Card>
    </div>
  );
}
