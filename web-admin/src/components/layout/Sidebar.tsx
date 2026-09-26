'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Package, Truck,
  ShieldCheck, Users, Calculator, Receipt, FileText, Target,
  AlertTriangle, Eye, Building2, CreditCard, Activity, TrendingUp,
  Bell, MapPin, Bot, Warehouse, Settings, UserPlus, UserCog, LayoutGrid,
  Upload, ListChecks, Clock, MessageSquare, KeyRound, History, UsersRound,
} from 'lucide-react';

export interface NavItem { href: string; label: string; icon: React.ReactNode; roles?: string[]; }

const icon = (Icon: any) => <Icon size={16} strokeWidth={2} className="shrink-0" />;

const NAV: Record<string, { group: string; items: NavItem[] }[]> = {
  greenT: [
    { group: 'Console', items: [
      { href: '/console', label: 'Tenants', icon: icon(Building2) },
      { href: '/abonnements', label: 'Abonnements', icon: icon(CreditCard) },
      { href: '/abonnements/facturation', label: 'Facturation SaaS', icon: icon(Receipt) },
      { href: '/audit', label: "Journal d'audit", icon: icon(History) },
      { href: '/equipe-green-t', label: 'Équipe Green-T', icon: icon(UsersRound), roles: ['super_admin'] },
    ]},
    { group: 'Monitoring', items: [
      { href: '/monitoring', label: 'Plateforme', icon: icon(Activity) },
      { href: '/monitoring/business', label: 'Business', icon: icon(TrendingUp) },
    ]},
    { group: 'Analyse', items: [
      { href: '/rapports', label: 'Rapports', icon: icon(FileText) },
      { href: '/rapports/kpi-sonatel', label: 'KPI SONATEL', icon: icon(Target) },
      { href: '/rapports/performance', label: 'Performance', icon: icon(TrendingUp) },
    ]},
  ],
  admin: [
    { group: 'Pilotage', items: [
      { href: '/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
      { href: '/planning', label: 'Planning', icon: icon(CalendarDays) },
      { href: '/planning/dispositif', label: 'Dispositif', icon: icon(LayoutGrid) },
      { href: '/planning/import', label: 'Import SONATEL', icon: icon(Upload) },
      { href: '/missions', label: 'Missions', icon: icon(ClipboardList) },
    ]},
    { group: 'Ressources', items: [
      { href: '/equipes', label: 'Équipes', icon: icon(Users) },
      { href: '/techniciens', label: 'Techniciens', icon: icon(UserCog) },
      { href: '/partenaires', label: 'Partenaires', icon: icon(Building2) },
      { href: '/stock', label: 'Stock', icon: icon(Package) },
      { href: '/stock/warehouses', label: 'Dépôts', icon: icon(Warehouse) },
      { href: '/vehicles', label: 'Véhicules', icon: icon(Truck) },
      { href: '/geolocation', label: 'Géolocalisation', icon: icon(MapPin) },
    ]},
    { group: 'Gestion', items: [
      { href: '/compliance', label: 'Conformité', icon: icon(ShieldCheck) },
      { href: '/compliance/checklists', label: 'Checklists', icon: icon(ListChecks) },
      { href: '/rh', label: 'RH', icon: icon(Users) },
      { href: '/rh/recrutement', label: 'Recrutement', icon: icon(UserPlus) },
      { href: '/rh/journaliers', label: 'Journaliers', icon: icon(UserCog) },
      { href: '/rh/presence', label: 'Présence', icon: icon(Clock) },
      { href: '/comptabilite', label: 'Comptabilité', icon: icon(Calculator) },
      { href: '/invoices', label: 'Facturation', icon: icon(Receipt) },
      { href: '/invoices/bordereau', label: 'Bordereau de prix', icon: icon(ListChecks) },
      { href: '/parametres', label: 'Paramètres', icon: icon(Settings) },
      { href: '/parametres/utilisateurs', label: 'Utilisateurs', icon: icon(KeyRound), roles: ['admin'] },
      { href: '/parametres/formulaires', label: 'Formulaires', icon: icon(ListChecks) },
      { href: '/historique', label: 'Historique', icon: icon(History) },
    ]},
    { group: 'Analyse', items: [
      { href: '/rapports', label: 'Rapports', icon: icon(FileText) },
      { href: '/rapports/kpi-sonatel', label: 'KPI SONATEL', icon: icon(Target) },
      { href: '/rapports/performance', label: 'Performance', icon: icon(TrendingUp) },
      { href: '/incidents', label: 'Incidents', icon: icon(AlertTriangle) },
      { href: '/ia-vision', label: 'IA Vision', icon: icon(Eye) },
      { href: '/ia-vision/feedback', label: 'Feedback IA', icon: icon(MessageSquare) },
      { href: '/assistant', label: 'Assistant IA', icon: icon(Bot) },
    ]},
  ],
  direction: [
    { group: 'Pilotage', items: [
      { href: '/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
      { href: '/rapports', label: 'Rapports', icon: icon(FileText) },
      { href: '/rapports/kpi-sonatel', label: 'KPI SONATEL', icon: icon(Target) },
      { href: '/rapports/performance', label: 'Performance', icon: icon(TrendingUp) },
    ]},
    { group: 'Suivi', items: [
      { href: '/missions', label: 'Missions', icon: icon(ClipboardList) },
      { href: '/invoices', label: 'Facturation', icon: icon(Receipt) },
      { href: '/incidents', label: 'Incidents', icon: icon(AlertTriangle) },
      { href: '/geolocation', label: 'Géolocalisation', icon: icon(MapPin) },
      { href: '/compliance', label: 'Conformité', icon: icon(ShieldCheck) },
      { href: '/rh', label: 'RH (lecture)', icon: icon(Users) },
      { href: '/rh/presence', label: 'Présence', icon: icon(Clock) },
      { href: '/comptabilite', label: 'Comptabilité', icon: icon(Calculator) },
    ]},
    { group: 'Analyse', items: [
      { href: '/ia-vision', label: 'IA Vision', icon: icon(Eye) },
      { href: '/ia-vision/feedback', label: 'Feedback IA', icon: icon(MessageSquare) },
      { href: '/assistant', label: 'Assistant IA', icon: icon(Bot) },
      { href: '/parametres', label: 'Paramètres (lecture)', icon: icon(Settings) },
      { href: '/historique', label: 'Historique', icon: icon(History) },
    ]},
  ],
  chef_equipe: [
    { group: 'Terrain', items: [
      { href: '/dashboard', label: 'Dashboard', icon: icon(LayoutDashboard) },
      { href: '/missions', label: 'Missions', icon: icon(ClipboardList) },
      { href: '/incidents', label: 'Incidents', icon: icon(AlertTriangle) },
      { href: '/stock', label: 'Stock', icon: icon(Package) },
      { href: '/vehicles', label: 'Véhicule', icon: icon(Truck) },
      { href: '/rh/journaliers', label: 'Journaliers', icon: icon(UserCog) },
    ]},
  ],
  magasinier: [
    { group: 'Stock', items: [
      { href: '/stock', label: 'Articles', icon: icon(Package) },
      { href: '/stock/warehouses', label: 'Emplacements', icon: icon(Warehouse) },
      { href: '/vehicles', label: 'Véhicules', icon: icon(Truck) },
    ]},
  ],
};

function navGroupsForRole(role: string) {
  if (['super_admin','finance_admin','support_admin'].includes(role)) return NAV.greenT;
  if (role === 'direction') return NAV.direction;
  if (role === 'chef_equipe') return NAV.chef_equipe;
  if (role === 'magasinier') return NAV.magasinier;
  return NAV.admin;
}

export function getNavForRole(role: string) {
  return navGroupsForRole(role)
    .map(g => ({ ...g, items: g.items.filter(i => !i.roles || i.roles.includes(role)) }))
    .filter(g => g.items.length > 0);
}

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const groups = getNavForRole(role);

  return (
    <nav aria-label="Navigation principale" className="flex h-full flex-col overflow-y-auto bg-[#111113] border-r border-[#27272a]">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#27272a]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h20M6 16V8m6 8V4m6 12v-6" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-white tracking-tight">VECTRACOM</p>
          <p className="text-[10px] text-zinc-500">Field Operations</p>
        </div>
      </div>

      <div className="flex-1 py-3 space-y-4">
        {groups.map(group => (
          <div key={group.group}>
            <p className="px-4 text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-semibold mb-1">{group.group}</p>
            {group.items.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2.5 px-4 py-[7px] text-[13px] font-medium transition-all duration-150 relative ${
                    active
                      ? 'text-emerald-400 bg-emerald-500/[0.08]'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500 rounded-r" />}
                  <span className={`transition-colors ${active ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-[#27272a] px-4 py-3">
        <Link href="/notifications" className="flex items-center gap-2.5 text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
          <Bell size={16} strokeWidth={2} />
          Notifications
        </Link>
      </div>
    </nav>
  );
}
