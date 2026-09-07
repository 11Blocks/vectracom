'use client';

import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Badge } from '@/components/ui';
import { ArrowLeft, Shield } from 'lucide-react';

const MODULES = [
  'Dashboard', 'Planning', 'Missions', 'Équipes', 'Techniciens', 'Partenaires',
  'Stock', 'Véhicules', 'Géolocalisation', 'Conformité', 'RH', 'Comptabilité',
  'Facturation', 'Paramètres', 'Rapports / KPI', 'Incidents', 'IA Vision', 'Notifications',
] as const;

/** Matrice indicative alignée sur la navigation web-admin (Sidebar). */
const MATRIX: Record<string, Partial<Record<(typeof MODULES)[number], 'RW' | 'R' | '—'>>> = {
  admin: Object.fromEntries(MODULES.map((m) => [m, 'RW'])),
  direction: {
    Dashboard: 'R', Planning: 'R', Missions: 'RW', Équipes: 'R', Techniciens: 'R', Partenaires: 'R',
    Stock: 'R', Véhicules: 'R', Géolocalisation: 'R', Conformité: 'RW', RH: 'R', Comptabilité: 'R',
    Facturation: 'RW', Paramètres: 'RW', 'Rapports / KPI': 'RW', Incidents: 'RW', 'IA Vision': 'R', Notifications: 'R',
  },
  chef_equipe: {
    Dashboard: 'R', Planning: 'R', Missions: 'RW', Équipes: 'R', Techniciens: 'R', Partenaires: '—',
    Stock: 'RW', Véhicules: 'RW', Géolocalisation: 'R', Conformité: 'R', RH: '—', Comptabilité: '—',
    Facturation: '—', Paramètres: '—', 'Rapports / KPI': 'R', Incidents: 'RW', 'IA Vision': 'R', Notifications: 'R',
  },
  magasinier: {
    Dashboard: '—', Planning: '—', Missions: '—', Équipes: '—', Techniciens: '—', Partenaires: '—',
    Stock: 'RW', Véhicules: '—', Géolocalisation: '—', Conformité: '—', RH: '—', Comptabilité: '—',
    Facturation: '—', Paramètres: '—', 'Rapports / KPI': '—', Incidents: '—', 'IA Vision': 'R', Notifications: 'R',
  },
};

const ROLES = [
  { key: 'admin', label: 'Admin tenant' },
  { key: 'direction', label: 'Direction' },
  { key: 'chef_equipe', label: "Chef d'équipe" },
  { key: 'magasinier', label: 'Magasinier' },
];

const CELL: Record<string, string> = {
  RW: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
  R: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30',
  '—': 'bg-[#1a2420] text-[#7a8f80]/50 border-[#1e2e25]',
};

export default function Page() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/parametres" className="text-[#7a8f80] hover:text-[#0f9d70]"><ArrowLeft size={18} /></Link>
          <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><Shield size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9]">Matrice des permissions</h1>
            <p className="text-xs text-[#7a8f80]">Lecture seule — alignée sur les rôles NestJS / sidebar</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className={CELL.RW}>RW — lecture / écriture</Badge>
          <Badge className={CELL.R}>R — lecture</Badge>
          <Badge className={CELL['—']}>— — pas d’accès UI</Badge>
        </div>

        <Card className="border-[#1e2e25] bg-[#111916] overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[#1e2e25]">
                <th className="px-3 py-2.5 text-left text-xs text-[#7a8f80]">Module</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="px-2 py-2.5 text-center text-xs text-[#7a8f80]">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50">
              {MODULES.map((mod) => (
                <tr key={mod}>
                  <td className="px-3 py-2 text-[#e8ede9]">{mod}</td>
                  {ROLES.map((r) => {
                    const v = MATRIX[r.key][mod] ?? '—';
                    return (
                      <td key={r.key} className="px-2 py-2 text-center">
                        <span className={'inline-flex min-w-[2rem] justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ' + CELL[v]}>
                          {v}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
