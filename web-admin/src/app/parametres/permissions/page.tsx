'use client';

import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Badge } from '@/components/ui';
import { ArrowLeft, Shield } from 'lucide-react';

type Access = 'RW' | 'RW*' | 'R' | '—';

const ROLES = [
  { key: 'admin', label: 'Admin tenant' },
  { key: 'direction', label: 'Direction' },
  { key: 'chef_equipe', label: "Chef d'équipe" },
  { key: 'magasinier', label: 'Magasinier' },
] as const;
type RoleKey = (typeof ROLES)[number]['key'];

/** Reflet des contrôles appliqués par l'API (décorateurs @Roles + règles métier des services). */
const MATRIX: Array<{ module: string } & Record<RoleKey, Access> & { note?: string }> = [
  { module: 'Dashboard', admin: 'R', direction: 'R', chef_equipe: 'R', magasinier: '—' },
  { module: 'Import planning SONATEL', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—', note: 'Direction : aperçu seulement, la confirmation est réservée à l’admin.' },
  { module: 'Missions', admin: 'RW', direction: 'RW', chef_equipe: 'RW*', magasinier: 'R', note: 'Chef d’équipe : terrain (démarrer, terminer, compte rendu) — pas de validation, rejet ni annulation. Dé-validation : admin uniquement.' },
  { module: 'Équipes / Techniciens', admin: 'RW', direction: 'R', chef_equipe: 'R', magasinier: 'R' },
  { module: 'Stock & mouvements', admin: 'RW', direction: 'R', chef_equipe: 'RW*', magasinier: 'RW', note: 'Chef d’équipe : consommation, retour et échange SAV uniquement. Suppression d’article : admin.' },
  { module: 'Numéros de série', admin: 'RW', direction: 'R', chef_equipe: 'RW*', magasinier: 'RW', note: 'Chef d’équipe : pose, retour et récupération.' },
  { module: 'Véhicules', admin: 'RW', direction: 'R', chef_equipe: 'RW*', magasinier: 'RW*', note: 'Chef d’équipe : contrôles véhicule. Magasinier : documents.' },
  { module: 'Géolocalisation', admin: 'RW', direction: 'R', chef_equipe: 'R', magasinier: '—', note: 'Zones : admin.' },
  { module: 'Conformité', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—' },
  { module: 'RH (employés, congés, recrutement)', admin: 'RW', direction: 'R', chef_equipe: 'RW*', magasinier: '—', note: 'Chef d’équipe : journaliers, pointage et demandes de congé. Décisions de congé et embauche : admin.' },
  { module: 'Dépenses', admin: 'RW', direction: 'R', chef_equipe: 'RW*', magasinier: '—', note: 'Chef d’équipe : saisie et modification ; suppression : admin.' },
  { module: 'Caisse', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—' },
  { module: 'Facturation clients', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—', note: 'Direction : consultation et exports PDF / Excel.' },
  { module: 'Bordereau de prix', admin: 'RW', direction: 'R', chef_equipe: 'R', magasinier: 'R' },
  { module: 'Rapports / KPI SONATEL', admin: 'RW', direction: 'RW', chef_equipe: '—', magasinier: '—', note: 'Recalcul et application des pénalités : admin.' },
  { module: 'Incidents', admin: 'RW', direction: 'RW', chef_equipe: 'RW*', magasinier: '—', note: 'Chef d’équipe : signalement, mise à jour et résolution. Affectation : admin.' },
  { module: 'IA Vision / Assistant', admin: 'RW', direction: 'RW', chef_equipe: 'RW*', magasinier: '—', note: 'Assistant documentaire : admin et direction.' },
  { module: 'Paramètres / Profil entreprise', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—' },
  { module: 'Comptes utilisateurs', admin: 'RW', direction: 'R', chef_equipe: '—', magasinier: '—' },
  { module: 'Notifications', admin: 'RW', direction: 'R', chef_equipe: 'R', magasinier: 'R', note: 'Réglages des canaux et test d’envoi : admin.' },
  { module: 'Historique (audit)', admin: 'R', direction: 'R', chef_equipe: '—', magasinier: '—' },
];

const CELL: Record<Access, string> = {
  RW: 'bg-[#0f9d70]/20 text-[#0f9d70] border-[#0f9d70]/30',
  'RW*': 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30',
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
            <p className="text-xs text-[#7a8f80]">Droits réellement appliqués par le serveur, rôle par rôle (lecture seule)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className={CELL.RW}>RW — lecture / écriture</Badge>
          <Badge className={CELL['RW*']}>RW* — écriture limitée (voir note)</Badge>
          <Badge className={CELL.R}>R — lecture</Badge>
          <Badge className={CELL['—']}>— — aucun accès</Badge>
        </div>

        <Card className="border-[#1e2e25] bg-[#111916] overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-[#1e2e25]">
                <th className="px-3 py-2.5 text-left text-xs text-[#7a8f80]">Module</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="px-2 py-2.5 text-center text-xs text-[#7a8f80]">{r.label}</th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs text-[#7a8f80]">Précisions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e25]/50">
              {MATRIX.map((row) => (
                <tr key={row.module}>
                  <td className="px-3 py-2 text-[#e8ede9]">{row.module}</td>
                  {ROLES.map((r) => (
                    <td key={r.key} className="px-2 py-2 text-center">
                      <span className={'inline-flex min-w-[2.2rem] justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ' + CELL[row[r.key]]}>
                        {row[r.key]}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-[11px] text-[#7a8f80] max-w-sm">{row.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-[11px] text-[#7a8f80]">
          Toutes les données sont cloisonnées par tenant : un identifiant (équipe, technicien, véhicule, fichier…) d’un autre tenant est refusé.
        </p>
      </div>
    </AppShell>
  );
}
