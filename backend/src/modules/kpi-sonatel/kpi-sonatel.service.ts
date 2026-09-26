import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SonatelKpiLog } from './entities/sonatel-kpi-log.entity';
import { SonatelKpiAlert } from './entities/sonatel-kpi-alert.entity';
import { KpiTcoInput, TCO_SEGMENTS, TcoSegment } from './entities/kpi-tco-input.entity';
import { KpiMasteryPlan } from './entities/kpi-mastery-plan.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { Team } from '../teams/entities/team.entity';
import { ComplianceRecord } from '../compliance/entities/compliance-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Attendance } from '../hr/entities/attendance.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { EDITABLE_INVOICE_STATUSES, Invoice } from '../invoices/entities/invoice.entity';
import { InvoicePenalty } from '../invoices/entities/invoice-penalty.entity';
import { InvoicesService } from '../invoices/invoices.service';

// ═══════════════════════════════════════════════════════════════
//  Familles Optimax (annexe 5 ICP-Pénalités)
// ═══════════════════════════════════════════════════════════════
export const KPI_FAMILIES = [
  'production',
  'autre_techno',
  'constitutions',
  'curative',
  'preventif',
  'evenements',
  'controle',
  'plaintes',
  'extensions',
  'stock',
  'zone',
] as const;
export type KpiFamily = (typeof KPI_FAMILIES)[number];

export const FAMILY_LABELS: Record<KpiFamily, string> = {
  production: 'Production (EM / HM-MM / B2B)',
  autre_techno: 'Autres technologies (5G, satellite, TDD)',
  constitutions: 'Fiabilisation des constitutions',
  curative: 'Maintenance curative',
  preventif: 'Maintenance préventive',
  evenements: 'Événements exceptionnels',
  controle: 'Contrôle opérationnel & SAV',
  plaintes: 'Plaintes',
  extensions: 'Extensions & densification',
  stock: 'Stock',
  zone: 'Pénalités de zone',
};

type Direction = 'up' | 'down';
type PenaltyKind =
  | { mode: 'TCO'; segment: TcoSegment }
  | { mode: 'FORFAIT'; perUnit: number; unit: string }
  | { mode: 'PO_PERCENT' }
  | { mode: 'NONE' };

interface KpiDef {
  name: string;
  label: string;
  family: KpiFamily;
  target: number;
  direction: Direction;
  penalty: PenaltyKind;
  /** Formule contractuelle telle que définie dans l'annexe. */
  formula: string;
  compute: (ctx: KpiContext) => { actual: number; units?: number; poPercent?: number; details?: Record<string, unknown> };
}

interface StockRow {
  id: string;
  reference: string;
  total: number;
  threshold: number;
  lastMovementAt: Date | null;
}

/** Données du mois préchargées une fois : les KPI sont des fonctions pures dessus. */
interface KpiContext {
  companyId: string;
  period: string;
  start: Date;
  end: Date;
  missions: Mission[];
  reportByMission: Map<string, MissionFieldReport>;
  incidents: Incident[];
  teams: Team[];
  records: ComplianceRecord[];
  attendance: Attendance[];
  stockRows: StockRow[];
  movements: StockMovement[];
  tco: Record<TcoSegment, number>;
  tcoSource: Record<TcoSegment, 'saisie' | 'facture' | 'aucune'>;
}

const CLOSED = ['terminee', 'validee'];
const OPEN = ['planifiee', 'en_cours', 'a_completer'];
const EXT_FAMILIES: KpiFamily[] = ['extensions'];

const H = 3600000;
const DAY = 86400000;

// ═══════════════════════════════════════════════════════════════
//  Helpers de classification et de mesure
// ═══════════════════════════════════════════════════════════════
type MarketSegment = 'EM' | 'HM_MM' | 'B2B' | 'AUTRE_TECHNO' | 'CUIVRE' | 'AUTRE';

/** Segment marché déduit du produit SONATEL (heuristique sur les libellés importés). */
function segmentOf(m: Mission): MarketSegment {
  const p = (m.sonatelProduit ?? '').toLowerCase();
  if (/\bb2b\b|entreprise/.test(p)) return 'B2B';
  if (/5g|satellite|tdd|vsat|fwa/.test(p)) return 'AUTRE_TECHNO';
  if (/cuivre|adsl|paires/.test(p)) return 'CUIVRE';
  if (/(^|[^a-z])em($|[^a-z])|entrée de marché|entree de marche/.test(p)) return 'EM';
  if (/(^|[^a-z])(hm|mm)($|[^a-z])|haut de marché|moyen de marche/.test(p)) return 'HM_MM';
  return m.typeTache === 'SAV' ? 'AUTRE' : 'EM';
}

/** Date de relevée effective : étape technique du rapport, sinon clôture mission. */
function releveAt(m: Mission, ctx: KpiContext): Date {
  const r = ctx.reportByMission.get(m.id);
  return r?.techniqueAt ?? r?.photosAt ?? m.updatedAt;
}

/** Heure d'arrivée de la demande (proxy : création de la mission). */
function demandedAt(m: Mission): Date {
  return m.createdAt ?? m.dateMission;
}

function pct(ok: number, total: number): number {
  return total === 0 ? NaN : round2((ok / total) * 100);
}

function hoursBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / H;
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / DAY;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ratio générique : missions SAV relevées dans la fenêtre heures pour un segment. */
function releveWindowKpi(ctx: KpiContext, segment: MarketSegment | 'ALL', windowHours: number, target: number) {
  const pool = ctx.missions.filter(
    (m) => m.typeTache === 'SAV' && CLOSED.includes(m.status) && (segment === 'ALL' || segmentOf(m) === segment),
  );
  if (pool.length === 0) return { actual: target, details: { note: 'aucun dérangement clos — neutre' } };
  const ok = pool.filter((m) => hoursBetween(releveAt(m, ctx), demandedAt(m)) <= windowHours).length;
  return {
    actual: pct(ok, pool.length),
    units: pool.length - ok,
    details: { dans_delai: ok, total: pool.length, fenetre_heures: windowHours, segment: segment === 'ALL' ? 'tous' : segment },
  };
}

/** TCO redevance maintenance par défaut pour la famille curative. */
const MT: PenaltyKind = { mode: 'TCO', segment: 'MAINTENANCE' };

// ═══════════════════════════════════════════════════════════════
//  Registre complet des KPI de l'annexe Optimax
// ═══════════════════════════════════════════════════════════════
const KPI_DEFS: KpiDef[] = [
  // ─────────────── Production (8) ───────────────
  {
    name: 'production.premier_coup_em', label: 'Installation réussie du premier coup (EM)', family: 'production',
    target: 98, direction: 'up', penalty: { mode: 'TCO', segment: 'PRODUCTION_EM' },
    formula: 'Lignes produites sans blocage partenaire / lignes produites',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'INSTALLATION' && CLOSED.includes(m.status) && segmentOf(m) === 'EM');
      if (pool.length === 0) return { actual: 98, details: { note: 'aucune installation close — neutre' } };
      const ok = pool.filter((m) => ctx.reportByMission.get(m.id)?.fieldStatus !== 'echec').length;
      return { actual: pct(ok, pool.length), units: pool.length - ok, details: { succes: ok, total: pool.length } };
    },
  },
  onTimeKpi('production.on_time_em_3j', 'On Time installation 3 jours (EM)', 95, 'EM', 3, 'PRODUCTION_EM'),
  backlogKpi('production.backlog_em_4j', 'Backlog < 4 jours (EM)', 5, 'EM', 4, 'PRODUCTION_EM'),
  onTimeKpi('production.on_time_hm_mm_2j', 'On Time installation 2 jours (HM/MM)', 95, 'HM_MM', 2, 'PRODUCTION_HM_MM'),
  backlogKpi('production.backlog_hm_mm_3j', 'Backlog < 3 jours (HM/MM)', 5, 'HM_MM', 3, 'PRODUCTION_HM_MM'),
  onTimeKpi('production.on_time_b2b_2j', 'On Time installation 2 jours (B2B)', 98, 'B2B', 2, 'PRODUCTION_B2B'),
  backlogKpi('production.backlog_b2b_3j', 'Backlog < 3 jours (B2B)', 2, 'B2B', 3, 'PRODUCTION_B2B'),
  {
    name: 'production.backlog_5j_tous', label: 'Zéro demande de plus de 5 jours (tous segments)', family: 'production',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 5000, unit: 'jour/demande au-delà de 5 j' },
    formula: 'Nombre de demandes en backlog > 5 jours',
    compute: (ctx) => {
      const limit = new Date(ctx.end.getTime() - 5 * DAY);
      const stale = ctx.missions.filter((m) => OPEN.includes(m.status) && m.dateMission < limit);
      const units = stale.reduce((s, m) => s + Math.max(0, Math.ceil(daysBetween(ctx.end, m.dateMission) - 5)), 0);
      return { actual: stale.length, units, details: { demandes: stale.length, jours_cumules: units } };
    },
  },

  // ─────────────── Autres technologies (3) ───────────────
  onTimeKpi('autre.on_time_3j', 'On Time installation 3 jours (5G / satellite / TDD)', 95, 'AUTRE_TECHNO', 3, 'AUTRE_TECHNO'),
  backlogKpi('autre.backlog_4j', 'Backlog < 4 jours (autres technos)', 5, 'AUTRE_TECHNO', 4, 'AUTRE_TECHNO'),
  {
    name: 'autre.backlog_5j', label: 'Zéro demande > 5 jours calendaires (autres technos)', family: 'autre_techno',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 5000, unit: 'jour/demande au-delà de 5 j' },
    formula: 'Nombre de demandes autres technos en backlog > 5 jours',
    compute: (ctx) => {
      const limit = new Date(ctx.end.getTime() - 5 * DAY);
      const stale = ctx.missions.filter((m) => OPEN.includes(m.status) && m.dateMission < limit && segmentOf(m) === 'AUTRE_TECHNO');
      const units = stale.reduce((s, m) => s + Math.max(0, Math.ceil(daysBetween(ctx.end, m.dateMission) - 5)), 0);
      return { actual: stale.length, units, details: { demandes: stale.length, jours_cumules: units } };
    },
  },

  // ─────────────── Constitutions (3) ───────────────
  {
    name: 'constitutions.renseignees', label: 'Taux de lignes produites avec constitutions renseignées', family: 'constitutions',
    target: 100, direction: 'up', penalty: { mode: 'TCO', segment: 'PRODUCTION_EM' },
    formula: 'Demandes installées avec constitutions renseignées / demandes installées',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'INSTALLATION' && CLOSED.includes(m.status));
      if (pool.length === 0) return { actual: 100, details: { note: 'neutre' } };
      const ok = pool.filter((m) => {
        const r = ctx.reportByMission.get(m.id);
        return r && r.gpsLatitude && r.dbmMeasurement;
      }).length;
      return { actual: pct(ok, pool.length), details: { renseignees: ok, total: pool.length, critere: 'GPS + mesure dBm présents' } };
    },
  },
  {
    name: 'constitutions.remontee_5j', label: 'Taux de remontée des constitutions collectées (5 jours)', family: 'constitutions',
    target: 100, direction: 'up', penalty: { mode: 'TCO', segment: 'PRODUCTION_EM' },
    formula: 'Constitutions collectées en 5 jours / total reçu à fiabiliser',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => CLOSED.includes(m.status));
      const withReport = pool.filter((m) => ctx.reportByMission.has(m.id));
      if (withReport.length === 0) return { actual: 100, details: { note: 'neutre' } };
      const ok = withReport.filter((m) => daysBetween(ctx.reportByMission.get(m.id)!.updatedAt ?? m.updatedAt, m.dateMission) <= 5).length;
      return { actual: pct(ok, withReport.length), details: { remontees_5j: ok, total: withReport.length } };
    },
  },
  {
    name: 'constitutions.fiabilite_parc', label: 'Taux de fiabilité des constitutions du parc', family: 'constitutions',
    target: 98, direction: 'up', penalty: { mode: 'TCO', segment: 'PRODUCTION_EM' },
    formula: 'Lignes avec constitutions fiables / parc actif',
    compute: (ctx) => {
      const reports = [...ctx.reportByMission.values()].filter((r) => r.dbmMeasurement);
      if (reports.length === 0) return { actual: 98, details: { note: 'neutre — aucune mesure dBm' } };
      const ok = reports.filter((r) => !r.dbmOutOfNorm).length;
      return { actual: pct(ok, reports.length), details: { conformes: ok, mesurees: reports.length, critere: 'dBm dans la norme' } };
    },
  },

  // ─────────────── Maintenance curative (16) ───────────────
  {
    name: 'curative.releve_4h_b2b', label: 'On Time relève 4H (B2B)', family: 'curative',
    target: 60, direction: 'up', penalty: MT, formula: 'Dérangements B2B relevés dans les 4H / total B2B',
    compute: (ctx) => releveWindowKpi(ctx, 'B2B', 4, 60),
  },
  {
    name: 'curative.releve_4h_b2c', label: 'On Time relève 4H (B2C)', family: 'curative',
    target: 50, direction: 'up', penalty: MT, formula: 'Dérangements B2C relevés dans les 4H / total B2C',
    compute: (ctx) => releveWindowKpi(ctx, 'AUTRE', 4, 50),
  },
  {
    name: 'curative.releve_6h_b2b', label: 'On Time relève 6H (B2B)', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Dérangements B2B relevés dans les 6H / total B2B',
    compute: (ctx) => releveWindowKpi(ctx, 'B2B', 6, 95),
  },
  {
    name: 'curative.releve_8h_hm_mm', label: 'On Time relève 8H (HM/MM)', family: 'curative',
    target: 90, direction: 'up', penalty: MT, formula: 'Dérangements HM/MM relevés dans les 8H / total HM-MM',
    compute: (ctx) => releveWindowKpi(ctx, 'HM_MM', 8, 90),
  },
  {
    name: 'curative.releve_12h_hm_mm', label: 'On Time relève 12H (HM/MM)', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Dérangements HM/MM relevés dans les 12H / total HM-MM',
    compute: (ctx) => releveWindowKpi(ctx, 'HM_MM', 12, 95),
  },
  {
    name: 'curative.releve_15h_voix_em', label: 'On Time relève 15H (voix B2C & EM fibre/satellite/5G/TDD)', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Dérangements voix & EM relevés dans les 15H / total',
    compute: (ctx) => releveWindowKpi(ctx, 'EM', 15, 95),
  },
  {
    name: 'curative.releve_24h_cuivre', label: 'On Time relève 24H (cuivre Grand Public)', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Dérangements cuivre relevés dans les 24H / total cuivre',
    compute: (ctx) => releveWindowKpi(ctx, 'CUIVRE', 24, 95),
  },
  {
    name: 'curative.backlog_12h', label: 'Traitement du backlog dérangement dans les 12H', family: 'curative',
    target: 100, direction: 'up', penalty: MT, formula: 'Backlog traité dans les 12H / total backlog',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'SAV' && CLOSED.includes(m.status));
      if (pool.length === 0) return { actual: 100, details: { note: 'neutre' } };
      const ok = pool.filter((m) => hoursBetween(m.updatedAt, demandedAt(m)) <= 12).length;
      return { actual: pct(ok, pool.length), details: { traites_12h: ok, total: pool.length } };
    },
  },
  {
    name: 'curative.repetitions_30j', label: 'Taux de répétitions de dérangements (30 jours)', family: 'curative',
    target: 2, direction: 'down', penalty: MT, formula: 'Dérangements répétitifs 30 j / total dérangements (NBSI > 1 ou même site)',
    compute: (ctx) => {
      const sav = ctx.missions.filter((m) => m.typeTache === 'SAV');
      if (sav.length === 0) return { actual: 2, details: { note: 'neutre' } };
      // Priorité au champ NBSI (passages réels sur le ND), sinon repli sur clientSite
      const byNbsi = sav.filter((m) => (m.nbsi ?? 0) > 1).length;
      const sites = new Set(sav.map((m) => m.clientSite));
      const bySite = sav.length - sites.size;
      const repeats = Math.max(byNbsi, bySite);
      return {
        actual: round2((repeats / sav.length) * 100),
        details: { repetitions: repeats, via_nbsi: byNbsi, via_site: bySite, total: sav.length },
      };
    },
  },
  {
    name: 'ext.va_cap_validation', label: 'Taux de validation VA CAP (attachement)', family: 'extensions',
    target: 95, direction: 'up', penalty: MT, formula: 'Dossiers VA CAP = OUI / dossiers avec VA CAP renseigné',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => !!m.vaCap);
      if (pool.length === 0) return { actual: 95, details: { note: 'neutre — aucun VA CAP' } };
      const ok = pool.filter((m) => /^oui$/i.test(String(m.vaCap).trim())).length;
      return { actual: pct(ok, pool.length), details: { va_cap_oui: ok, total: pool.length } };
    },
  },
  {
    name: 'zone.sr_plaque_couverture', label: 'Couverture SR/PLAQUE sur missions', family: 'zone',
    target: 90, direction: 'up', penalty: MT, formula: 'Missions avec SR/PLAQUE renseigné / total missions',
    compute: (ctx) => {
      if (ctx.missions.length === 0) return { actual: 90, details: { note: 'neutre' } };
      const ok = ctx.missions.filter((m) => !!m.srPlaque).length;
      return { actual: pct(ok, ctx.missions.length), details: { avec_sr: ok, total: ctx.missions.length } };
    },
  },
  {
    name: 'curative.respect_rdv', label: 'Taux de respect des rendez-vous', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'RDV respectés / total RDV validés avec Sonatel',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'SAV');
      if (pool.length === 0) return { actual: 95, details: { note: 'neutre' } };
      const ok = pool.filter((m) => m.status !== 'planifiee').length;
      return { actual: pct(ok, pool.length), details: { demarrees: ok, total: pool.length } };
    },
  },
  {
    name: 'curative.satisfaction_client', label: 'Taux de satisfaction client', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Clients satisfaits / clients sondés',
    compute: (ctx) => {
      const reports = [...ctx.reportByMission.values()].filter((r) => r.signatureClientUrl || r.signatureTechnicianUrl);
      if (reports.length === 0) return { actual: 95, details: { note: 'neutre — aucun sondage signé' } };
      const ok = reports.filter((r) => r.signatureClientUrl).length;
      return { actual: pct(ok, reports.length), details: { signatures_client: ok, sondees: reports.length } };
    },
  },
  {
    name: 'curative.signalisation_b2b', label: 'Taux de signalisation mensuel fibre/5G/VSAT (B2B)', family: 'curative',
    target: 2, direction: 'down', penalty: MT, formula: 'Dérangements B2B du mois / parc clients B2B',
    compute: (ctx) => {
      const sav = ctx.missions.filter((m) => m.typeTache === 'SAV');
      const b2b = sav.filter((m) => segmentOf(m) === 'B2B').length;
      const parc = sav.length === 0 ? 0 : Math.max(b2b * 20, 1); // parc inconnu : proxy conservateur ×20
      if (sav.length === 0) return { actual: 2, details: { note: 'neutre — parc B2B non importé' } };
      return { actual: round2((b2b / parc) * 100), details: { derangements_b2b: b2b, parc_estime: parc, note: 'parc client non géré : proxy ×20' } };
    },
  },
  {
    name: 'curative.signalisation_b2c_cuivre', label: 'Taux de signalisation mensuel cuivre (B2C)', family: 'curative',
    target: 5, direction: 'down', penalty: MT, formula: 'Dérangements cuivre B2C du mois / parc clients B2C cuivre',
    compute: (ctx) => {
      const sav = ctx.missions.filter((m) => m.typeTache === 'SAV');
      const cuivre = sav.filter((m) => segmentOf(m) === 'CUIVRE').length;
      const parc = sav.length === 0 ? 0 : Math.max(cuivre * 20, 1);
      if (sav.length === 0) return { actual: 5, details: { note: 'neutre — parc cuivre non importé' } };
      return { actual: round2((cuivre / parc) * 100), details: { derangements_cuivre: cuivre, parc_estime: parc, note: 'parc client non géré : proxy ×20' } };
    },
  },
  {
    name: 'curative.dérangements_causes_1h', label: 'On Time 1H relève dérangements causés par nos équipes', family: 'curative',
    target: 95, direction: 'up', penalty: MT, formula: 'Dérangements causés relevés dans 1H / total causés',
    compute: (ctx) => {
      const caused = ctx.incidents.filter((i) => (i.annotationOriginale ?? '').match(/causé|cause par|équipe/i) || i.rubrique === 'PBO');
      if (caused.length === 0) return { actual: 95, details: { note: 'neutre — aucun dérangement causé identifié' } };
      const ok = caused.filter((i) => i.resolvedAt && hoursBetween(i.resolvedAt, i.reportedAt) <= 1).length;
      return { actual: pct(ok, caused.length), details: { releves_1h: ok, causes: caused.length, source: 'module Incidents' } };
    },
  },
  {
    name: 'curative.sans_confirmation_rit', label: 'Dérangements relevés sans confirmation client (RIT)', family: 'curative',
    target: 1, direction: 'down', penalty: MT, formula: 'Relevés sans signature fiche RIT / total relevés',
    compute: (ctx) => {
      const reports = [...ctx.reportByMission.values()].filter((r) => r.fieldStatus);
      if (reports.length === 0) return { actual: 1, details: { note: 'neutre' } };
      const noSign = reports.filter((r) => !r.signatureClientUrl).length;
      return { actual: pct(noSign, reports.length), details: { sans_signature: noSign, releves: reports.length } };
    },
  },
  {
    name: 'curative.prematures_90j', label: 'Taux de dérangements prématurés (90 jours après MSV)', family: 'curative',
    target: 2, direction: 'down', penalty: MT, formula: 'Dérangements < 90 j après mise en service / total dérangements',
    compute: (ctx) => {
      const sav = ctx.missions.filter((m) => m.typeTache === 'SAV' && CLOSED.includes(m.status));
      if (sav.length === 0) return { actual: 2, details: { note: 'neutre' } };
      const installs = ctx.missions.filter((m) => m.typeTache === 'INSTALLATION');
      const prematures = sav.filter((m) =>
        installs.some((i) => i.clientSite === m.clientSite && m.dateMission.getTime() - i.dateMission.getTime() <= 90 * DAY),
      ).length;
      return { actual: round2((prematures / sav.length) * 100), details: { prematures: prematures, total: sav.length } };
    },
  },

  // ─────────────── Maintenance préventive (8) ───────────────
  incidentResolutionKpi('preventif.pbo_degrades_3j', 'On Time 3 jours traitement PBO dégradés', 100, 'PBO', 3,
    { mode: 'FORFAIT', perUnit: 10000, unit: 'PBO dégradé non traité' },
    'PBO dégradés traités dans les 3 jours / total PBO dégradés reçus'),
  {
    name: 'preventif.planning', label: 'Taux de respect du planning de maintenance préventive', family: 'preventif',
    target: 95, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 5000, unit: 'instance non traitée au-delà de 5 %' },
    formula: 'Cas de préventif réalisés dans les délais / total cas planifiés',
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => ['INFRA', 'OSM', 'DEVOIEMENT'].includes(m.typeTache));
      if (pool.length === 0) return { actual: 95, details: { note: 'aucune mission préventive — neutre' } };
      const done = pool.filter((m) => CLOSED.includes(m.status) && m.updatedAt.getTime() - m.dateMission.getTime() <= 3 * DAY).length;
      return { actual: pct(done, pool.length), units: pool.length - done, details: { dans_les_delais: done, planifies: pool.length, types: 'INFRA/OSM/DEVOIEMENT' } };
    },
  },
  incidentResolutionKpi('preventif.lignes_degradees_2j', 'On Time 2 jours traitement lignes dégradées', 80, 'PIO', 2,
    { mode: 'FORFAIT', perUnit: 5000, unit: 'ligne dégradée non traitée au-delà de 20 %' },
    'Lignes dégradées traitées dans les 2 jours / total reçues'),
  incidentResolutionKpi('preventif.lignes_degradees_5j', 'On Time 5 jours traitement lignes dégradées', 100, 'PIO', 5,
    { mode: 'FORFAIT', perUnit: 5000, unit: 'ligne dégradée non traitée' },
    'Lignes dégradées traitées dans les 5 jours / total reçues'),
  {
    name: 'preventif.rapport_inspection_m5', label: 'Diffusion du rapport d\'inspection réseau à M+5 (+ERQ)', family: 'preventif',
    target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 50000, unit: 'rapport non transmis' },
    formula: 'Rapport d\'inspection réseau diffusé à M+5',
    compute: (ctx) => {
      const inspections = ctx.missions.filter((m) => ['INFRA', 'OSM'].includes(m.typeTache) && ctx.reportByMission.has(m.id));
      const diffuse = inspections.length > 0 ? 1 : 0;
      return { actual: diffuse * 100, units: diffuse === 0 ? 1 : 0, details: { note: 'généré via Rapports › export mensuel', inspections_relevees: inspections.length } };
    },
  },
  incidentResolutionKpi('preventif.correction_ecarts_5j', 'On Time 5 jours correction des écarts d\'inspection', 95, 'CHAMBRE', 5,
    { mode: 'FORFAIT', perUnit: 5000, unit: 'écart non corrigé au-delà de 5 %' },
    'Écarts corrigés dans les 5 jours / total écarts'),
  incidentResolutionKpi('preventif.remontees_reseau_1j', 'On Time 1 jour correction des remontées réseau fixe', 95, 'PBO', 1,
    { mode: 'FORFAIT', perUnit: 5000, unit: 'remontée non traitée au-delà de 5 %' },
    'Remontées réseau traitées dans 1 jour / total remontées'),
  {
    name: 'preventif.pbo_non_corriges', label: 'PBO dégradés transmis et non corrigés dans les délais', family: 'preventif',
    target: 5, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 10000, unit: 'PBO au-delà du seuil de 5/mois' },
    formula: 'Nombre de PBO dégradés non corrigés dans le mois (seuil 5)',
    compute: (ctx) => {
      const pbo = ctx.incidents.filter((i) => i.rubrique === 'PBO' && i.status !== 'cloture');
      const excess = Math.max(0, pbo.length - 5);
      return { actual: pbo.length, units: excess, details: { non_corriges: pbo.length, seuil: 5, source: 'module Incidents' } };
    },
  },

  // ─────────────── Événements exceptionnels (7) ───────────────
  {
    name: 'evenements.partage_dispositif_jeudi', label: 'Partage des dispositifs tous les jeudis', family: 'evenements',
    target: 100, direction: 'up', penalty: { mode: 'NONE' },
    formula: 'Envois du dispositif dans les délais (au plus tard jeudi) / total envoyés',
    compute: (ctx) => {
      const weeks = ctx.attendance.filter((a) => a.weekStart >= ctx.start.toISOString().slice(0, 10) && a.weekStart <= ctx.end.toISOString().slice(0, 10));
      const validated = weeks.filter((a) => a.validatedAt);
      if (weeks.length === 0) return { actual: 100, details: { note: 'suivi — alimenté par RH › Présence (feuille hebdo)' } };
      return { actual: pct(validated.length, weeks.length), details: { feuilles_validees: validated.length, feuilles: weeks.length, suivi: 'non pénalisé' } };
    },
  },
  ...(
    [
      ['evenements.palier_j48', 'Dispositif événement — J-48h (palier 80 %)', 80],
      ['evenements.palier_j24', 'Dispositif événement — J-24h (palier 60 %)', 60],
      ['evenements.palier_jour', 'Dispositif événement — jour J (palier 40 %)', 40],
      ['evenements.palier_j24h', 'Dispositif événement — J+24h (palier 50 %)', 50],
      ['evenements.palier_j48h', 'Dispositif événement — J+48h (palier 80 %)', 80],
      ['evenements.palier_j72h', 'Dispositif événement — J+72h (palier 100 %)', 100],
    ] as const
  ).map(([name, label, target]): KpiDef => ({
    name, label, family: 'evenements',
    target, direction: 'up',
    penalty: { mode: 'FORFAIT', perUnit: 30000, unit: 'équipe manquante/jour' },
    formula: 'Équipes planifiées et ayant travaillé / effectif normal',
    compute: (ctx) => {
      const techs = new Set(ctx.attendance.map((a) => a.technicianId));
      const weeks = ctx.attendance.filter((a) => a.weekStart >= ctx.start.toISOString().slice(0, 10) && a.weekStart <= ctx.end.toISOString().slice(0, 10));
      if (techs.size === 0 || weeks.length === 0) {
        return { actual: target, details: { note: 'neutre — alimenté par la feuille de présence hebdo (RH › Présence)' } };
      }
      const presentDays = weeks.reduce((s, a) => s + [a.monday, a.tuesday, a.wednesday, a.thursday, a.friday, a.saturday, a.sunday].filter(Boolean).length, 0);
      const capacity = weeks.length * 7;
      const ratio = Math.min(1, presentDays / Math.max(1, capacity));
      const equipesManquantes = round2((1 - ratio) * ctx.teams.filter((t) => t.active).length * 4.33);
      return {
        actual: round2(ratio * 100),
        units: Math.max(0, equipesManquantes),
        details: { mobilisation_pct: round2(ratio * 100), palier_pct: target, source: 'RH › Présence (feuille hebdo)' },
      };
    },
  })),

  // ─────────────── Contrôle opérationnel & SAV (14) ───────────────
  {
    name: 'controle.taux_rejet', label: 'Taux de rejet contrôle', family: 'controle',
    target: 2, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 500000, unit: 'point' },
    formula: 'Prestations rejetées au contrôle / prestations contrôlées',
    compute: (ctx) => {
      const judged = ctx.missions.filter((m) => m.status === 'validee' || m.status === 'rejetee');
      if (judged.length === 0) return { actual: 2, details: { note: 'neutre' } };
      const rejected = judged.filter((m) => m.status === 'rejetee').length;
      const actual = pct(rejected, judged.length);
      return { actual, units: round2(Math.max(0, actual - 2)), details: { rejetees: rejected, jugees: judged.length } };
    },
  },
  {
    name: 'controle.equipes_non_validees', label: 'Utilisation d\'équipes non validées', family: 'controle',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'équipe découverte' },
    formula: 'Équipes non validées découvertes en exercice dans le mois',
    compute: (ctx) => teamCountKpi(ctx, 'non_validees'),
  },
  {
    name: 'controle.equipes_suspendues', label: 'Utilisation d\'équipes suspendues', family: 'controle',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'équipe découverte' },
    formula: 'Équipes suspendues découvertes en exercice dans le mois',
    compute: (ctx) => teamCountKpi(ctx, 'suspendues'),
  },
  {
    name: 'controle.equipes_exclues', label: 'Utilisation d\'équipes exclues/blacklistées', family: 'controle',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'équipe découverte' },
    formula: 'Équipes exclues découvertes en exercice dans le mois',
    compute: () => ({ actual: 0, details: { note: 'aucune exclusion enregistrée' } }),
  },
  {
    name: 'controle.taux_equipes_non_conformes', label: 'Taux d\'équipes non conformes (contrôle inopiné)', family: 'controle',
    target: 2, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 50000, unit: 'équipe au-delà de 2 %' },
    formula: 'Équipes non conformes / équipes contrôlées',
    compute: (ctx) => teamCountKpi(ctx, 'non_conformes_pct'),
  },
  ...controlFamilyKpi('sav', 'SAV', 5, 99),
  ...controlFamilyKpi('production', 'Production', 10, 98),

  // ─────────────── Plaintes (1) ───────────────
  {
    name: 'plaintes.traitement_conforme', label: 'Taux de traitement conforme des plaintes (< 7 jours)', family: 'plaintes',
    target: 100, direction: 'up', penalty: MT, formula: 'Plaintes traitées conformément dans le délai / plaintes traitées',
    compute: (ctx) => {
      const plaintes = ctx.incidents.filter((i) => (i.clientsImpacted ?? 0) > 0 || /plainte|réclamation|reclamation/i.test(i.annotationOriginale ?? ''));
      if (plaintes.length === 0) return { actual: 100, details: { note: 'neutre — aucune plainte enregistrée' } };
      const ok = plaintes.filter((i) => i.resolvedAt && daysBetween(i.resolvedAt, i.reportedAt) <= 7).length;
      return { actual: pct(ok, plaintes.length), details: { conformes_7j: ok, plaintes: plaintes.length, source: 'module Incidents' } };
    },
  },

  // ─────────────── Extensions & densification (7) ───────────────
  {
    name: 'ext.planning_livraison', label: 'Respect du planning de livraison des plaques', family: 'extensions',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 500000, unit: 'jour de retard/lot' },
    formula: 'Jours de retard à partir des délais max de livraison',
    compute: (ctx) => {
      const lots = ctx.missions.filter((m) => ['DENSIFICATION', 'DEPLOIEMENT'].includes(m.typeTache) && CLOSED.includes(m.status));
      const retard = lots.reduce((s, m) => s + Math.max(0, Math.ceil(daysBetween(m.updatedAt, m.dateMission))), 0);
      return { actual: retard, units: retard, details: { lots_livres: lots.length, jours_retard: retard, note: 'plafond 20 % du PO du lot' } };
    },
  },
  {
    name: 'ext.demarrage_travaux', label: 'Respect du délai de démarrage des travaux (3 j Dakar / 5 j région)', family: 'extensions',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 300000, unit: 'jour de retard/lot' },
    formula: 'Jours de retard après notification d\'affectation',
    compute: (ctx) => {
      const lots = ctx.missions.filter((m) => ['DENSIFICATION', 'DEPLOIEMENT', 'PLANTATION'].includes(m.typeTache) && m.heureDepartReelle);
      let retard = 0;
      for (const m of lots) {
        const allowed = /dakar/i.test(m.zone ?? '') ? 3 : 5;
        retard += Math.max(0, Math.ceil(daysBetween(m.heureDepartReelle!, m.createdAt ?? m.dateMission) - allowed));
      }
      return { actual: retard, units: retard, details: { lots_demarres: lots.length, jours_retard: retard } };
    },
  },
  {
    name: 'ext.attachements_conformite', label: 'Conformité des contrôles d\'attachements', family: 'extensions',
    target: 99, direction: 'up', penalty: { mode: 'PO_PERCENT' },
    formula: 'Plaques attachées sans réserve / plaques attachées (amende 5 % ou 25 % du PO)',
    compute: (ctx) => {
      const attaches = ctx.missions.filter((m) => ['DENSIFICATION', 'DEPLOIEMENT'].includes(m.typeTache) && (ctx.reportByMission.get(m.id)?.priceItemsUsed?.length ?? 0) > 0);
      if (attaches.length === 0) return { actual: 99, details: { note: 'neutre — aucun attachement' } };
      const ok = attaches.filter((m) => ctx.reportByMission.get(m.id)?.sonatelApprovalStatus === 'approuve').length;
      const actual = pct(ok, attaches.length);
      const poPercent = actual >= 99 ? 0 : actual >= 95 ? 5 : 25;
      return { actual, poPercent, details: { sans_reserve: ok, attachees: attaches.length, amende_po_pct: poPercent } };
    },
  },
  {
    name: 'ext.recette_conformite', label: 'Conformité de la recette (PBO sans réserve)', family: 'extensions',
    target: 98, direction: 'up', penalty: { mode: 'PO_PERCENT' },
    formula: 'PBO recettés sans réserve / PBO recettés (amende 5 % ou 25 % du PO + quotas)',
    compute: (ctx) => {
      const recettes = [...ctx.reportByMission.values()].filter((r) => r.recetteStatus === 'acceptee' || r.recetteStatus === 'reserves' || r.recetteStatus === 'rejetee');
      if (recettes.length === 0) return { actual: 98, details: { note: 'neutre — aucune recette' } };
      const ok = recettes.filter((r) => r.recetteStatus === 'acceptee').length;
      const actual = pct(ok, recettes.length);
      const poPercent = actual >= 98 ? 0 : actual >= 95 ? 5 : 25;
      return { actual, poPercent, details: { acceptees: ok, recettees: recettes.length, amende_po_pct: poPercent } };
    },
  },
  {
    name: 'ext.levee_reserves_3j', label: 'Levée des réserves dans les 3 jours après recette', family: 'extensions',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'jour de retard' },
    formula: 'Jours de retard après les 3 jours post-première recette',
    compute: (ctx) => {
      const reservees = ctx.missions.filter((m) => ctx.reportByMission.get(m.id)?.recetteStatus === 'reserves' && CLOSED.includes(m.status));
      const retard = reservees.reduce((s, m) => s + Math.max(0, Math.ceil(daysBetween(m.updatedAt, m.dateMission) - 3)), 0);
      return { actual: retard, units: retard, details: { missions_avec_reserves: reservees.length, jours_retard: retard } };
    },
  },
  {
    name: 'ext.attachement_3j_apres_recette', label: 'Attachement réalisé dans les 3 jours après recette', family: 'extensions',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 300000, unit: 'jour de retard/lot' },
    formula: 'Jours de retard sur le délai d\'attachement de 3 jours après recette',
    compute: (ctx) => {
      const attaches = ctx.missions.filter((m) => {
        const r = ctx.reportByMission.get(m.id);
        return r && r.priceItemsUsed.length > 0 && (r.recetteStatus === 'acceptee' || r.recetteStatus === 'reserves');
      });
      const retard = attaches.reduce((s, m) => s + Math.max(0, Math.ceil(daysBetween(m.updatedAt, m.dateMission) - 3)), 0);
      return { actual: retard, units: retard, details: { attaches: attaches.length, jours_retard: retard } };
    },
  },
  {
    name: 'ext.atp', label: 'Soumission ATP — déclaration de démarrage et clôture', family: 'extensions',
    target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 500000, unit: 'intervention non déclarée (+ suspension 1 mois)' },
    formula: 'Interventions déclarées / interventions réalisées',
    compute: (ctx) => {
      const closed = ctx.missions.filter((m) => CLOSED.includes(m.status));
      if (closed.length === 0) return { actual: 100, details: { note: 'neutre' } };
      const declarees = closed.filter((m) => m.heureDepartReelle).length;
      return { actual: pct(declarees, closed.length), units: closed.length - declarees, details: { declarees: declarees, realisees: closed.length } };
    },
  },

  // ─────────────── Stock (6) ───────────────
  {
    name: 'stock.conformite_mensuelle', label: 'Taux de conformité du stock mensuel (SI vs inventaire)', family: 'stock',
    target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Valeur stock réel (inventaire) / valeur stock théorique (SI)',
    compute: (ctx) => {
      if (ctx.stockRows.length === 0) return { actual: 100, details: { note: 'stock vide — neutre' } };
      const conformes = ctx.stockRows.filter((r) => r.total >= r.threshold).length;
      const actual = pct(conformes, ctx.stockRows.length);
      return { actual, units: round2(Math.max(0, 100 - actual)), details: { conformes, references: ctx.stockRows.length, critere: 'niveau ≥ seuil d\'alerte' } };
    },
  },
  {
    name: 'stock.corrections_anomalies', label: 'Taux de corrections des anomalies de stock', family: 'stock',
    target: 95, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Écarts corrigés dans le mois / écarts imputés le mois précédent',
    compute: (ctx) => {
      const anomalies = ctx.stockRows.filter((r) => r.total < r.threshold);
      if (anomalies.length === 0) return { actual: 95, details: { note: 'aucune anomalie — neutre' } };
      const corrected = anomalies.filter((r) => ctx.movements.some((mv) => mv.stockItemId === r.id && mv.type === 'entree' && inPeriod(mv, ctx))).length;
      const actual = pct(corrected, anomalies.length);
      return { actual, units: round2(Math.max(0, 95 - actual)), details: { corrigees: corrected, anomalies: anomalies.length } };
    },
  },
  {
    name: 'stock.repetitions_anomalies', label: 'Taux de répétitions des anomalies de stock', family: 'stock',
    target: 0, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Écarts répétés sur deux contrôles consécutifs / moyenne des écarts',
    compute: (ctx) => {
      const anomalies = ctx.stockRows.filter((r) => r.total < r.threshold);
      if (anomalies.length === 0) return { actual: 0, details: { note: 'neutre' } };
      const repetees = anomalies.filter((r) => !ctx.movements.some((mv) => mv.stockItemId === r.id && mv.type === 'entree')).length;
      const actual = pct(repetees, anomalies.length);
      return { actual, units: actual, details: { repetees: repetees, anomalies: anomalies.length, note: 'répétition = aucun réapprovisionnement depuis le constat' } };
    },
  },
  {
    name: 'stock.retour_defectueux_7j', label: 'Délai de retour des articles défectueux (7 jours)', family: 'stock',
    target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Respect du délai contractuel de retour de 7 jours',
    compute: (ctx) => {
      const retours = ctx.movements.filter((mv) => mv.type === 'retour' || mv.type === 'echange_sav');
      if (retours.length === 0) return { actual: 100, details: { note: 'aucun retour — neutre' } };
      const inTime = retours.filter((mv) => {
        const mission = ctx.missions.find((m) => m.id === mv.missionId);
        return mission ? daysBetween(mv.createdAt ?? new Date(), mission.dateMission) <= 7 : true;
      }).length;
      const actual = pct(inTime, retours.length);
      return { actual, units: round2(Math.max(0, 100 - actual)), details: { dans_les_7j: inTime, retours: retours.length } };
    },
  },
  {
    name: 'stock.conformite_stockage', label: 'Conformité du stockage (normes entrepôt)', family: 'stock',
    target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Items conformes aux normes de stockage / items contrôlés',
    compute: () => ({ actual: 100, details: { note: 'audit entrepôt à saisir lors du contrôle physique SONATEL (9 points de conformité)' } }),
  },
  {
    name: 'stock.dormant', label: 'Taux de stock dormant (> 6 mois non consommés)', family: 'stock',
    target: 5, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
    formula: 'Articles stockés depuis plus de 6 mois / total des articles',
    compute: (ctx) => {
      if (ctx.stockRows.length === 0) return { actual: 0, details: { note: 'neutre' } };
      const limit = new Date(ctx.end.getTime() - 182 * DAY);
      const dormants = ctx.stockRows.filter((r) => !r.lastMovementAt || r.lastMovementAt < limit).length;
      const actual = pct(dormants, ctx.stockRows.length);
      return { actual, units: round2(Math.max(0, actual - 5)), details: { dormants, references: ctx.stockRows.length } };
    },
  },

  // ─────────────── Pénalités de zone (4) ───────────────
  zoneKpi('zone.pbo_ouvert_48h', 'PBO ouvert / non accroché / désorganisé (> 48 h)', 'PBO', 100000,
    'PBO remonté par Sonatel non corrigé sous 48 h'),
  zoneKpi('zone.cables_pendants', 'Câbles pendants (> 48 h)', 'PIO_CABLE', 100000,
    'Câbles pendants remontés par Sonatel non corrigés sous 48 h'),
  zoneKpi('zone.appui_commun_non_arme', 'Appui commun non armé (> 48 h)', 'PIO_ACCESSOIRE', 50000,
    'Appui commun non armé — 50 000 F, puis 100 000 F après 48 h'),
  zoneKpi('zone.sr_pmz_non_ferme', 'SR / PMZ non fermé (> 48 h)', 'CHAMBRE', 50000,
    'SR ou PMZ non fermé — 50 000 F, puis 100 000 F après 48 h'),
];

// ═══════════════════════════════════════════════════════════════
//  Aides de définition
// ═══════════════════════════════════════════════════════════════
function onTimeKpi(name: string, label: string, target: number, segment: MarketSegment, days: number, tcoSegment: TcoSegment): KpiDef {
  return {
    name, label, family: segment === 'AUTRE_TECHNO' ? 'autre_techno' : 'production',
    target, direction: 'up', penalty: { mode: 'TCO', segment: tcoSegment },
    formula: `Demandes installées et mises en service en ${days} jours / demandes reçues`,
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'INSTALLATION' && CLOSED.includes(m.status) && segmentOf(m) === segment);
      if (pool.length === 0) return { actual: target, details: { note: 'neutre' } };
      const ok = pool.filter((m) => m.updatedAt.getTime() - m.dateMission.getTime() <= days * DAY).length;
      return { actual: pct(ok, pool.length), details: { dans_delai: ok, total: pool.length, delai_jours: days, segment } };
    },
  };
}

function backlogKpi(name: string, label: string, target: number, segment: MarketSegment, days: number, tcoSegment: TcoSegment): KpiDef {
  return {
    name, label, family: segment === 'AUTRE_TECHNO' ? 'autre_techno' : 'production',
    target, direction: 'down', penalty: { mode: 'TCO', segment: tcoSegment },
    formula: `Backlog > ${days} jours / demandes reçues (installées + backlog)`,
    compute: (ctx) => {
      const pool = ctx.missions.filter((m) => m.typeTache === 'INSTALLATION' && segmentOf(m) === segment);
      if (pool.length === 0) return { actual: target, details: { note: 'neutre' } };
      const limit = new Date(ctx.end.getTime() - days * DAY);
      const backlog = pool.filter((m) => OPEN.includes(m.status) && m.dateMission < limit).length;
      return { actual: pct(backlog, pool.length), details: { en_retard: backlog, total: pool.length, seuil_jours: days, segment } };
    },
  };
}

function incidentResolutionKpi(name: string, label: string, target: number, rubrique: 'PBO' | 'PIO' | 'CHAMBRE', days: number, penalty: PenaltyKind, formula: string): KpiDef {
  return {
    name, label, family: 'preventif',
    target, direction: 'up', penalty, formula,
    compute: (ctx) => {
      const pool = ctx.incidents.filter((i) => i.rubrique === rubrique);
      if (pool.length === 0) return { actual: target, details: { note: `aucun incident ${rubrique} — neutre` } };
      const ok = pool.filter((i) => i.resolvedAt && daysBetween(i.resolvedAt, i.reportedAt) <= days).length;
      const actual = pct(ok, pool.length);
      return { actual, units: pool.length - ok, details: { dans_delai: ok, total: pool.length, fenetre_jours: days, source: 'module Incidents' } };
    },
  };
}

function controlFamilyKpi(kind: 'sav' | 'production', labelPrefix: string, controlTarget: number, conformiteTarget: number): KpiDef[] {
  const typeFilter = kind === 'sav' ? 'SAV' : 'INSTALLATION';
  return [
    {
      name: `controle.taux_controle_${kind}`, label: `Taux de contrôle ${labelPrefix} (≥ ${controlTarget} %)`, family: 'controle',
      target: controlTarget, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 500000, unit: 'point non atteint' },
      formula: `Interventions ${labelPrefix} contrôlées / interventions ${labelPrefix}`,
      compute: (ctx) => {
        const pool = ctx.missions.filter((m) => m.typeTache === typeFilter && CLOSED.includes(m.status));
        if (pool.length === 0) return { actual: controlTarget, details: { note: 'neutre' } };
        const controlled = pool.filter((m) => ctx.reportByMission.get(m.id)?.qualityScore != null).length;
        const actual = pct(controlled, pool.length);
        return { actual, units: round2(Math.max(0, controlTarget - actual)), details: { controlees: controlled, total: pool.length } };
      },
    },
    {
      name: `controle.conformite_${kind}`, label: `Taux de conformité ${labelPrefix} (≥ ${conformiteTarget} %)`, family: 'controle',
      target: conformiteTarget, direction: 'up', penalty: { mode: 'NONE' },
      formula: `Interventions ${labelPrefix} conformes / contrôlées (pris en compte dans le rejet COP)`,
      compute: (ctx) => {
        const pool = ctx.missions.filter((m) => m.typeTache === typeFilter && CLOSED.includes(m.status) && ctx.reportByMission.get(m.id)?.qualityScore != null);
        if (pool.length === 0) return { actual: conformiteTarget, details: { note: 'neutre — aucun contrôle interne enregistré' } };
        const ok = pool.filter((m) => ctx.reportByMission.get(m.id)?.fieldStatus === 'succes').length;
        return { actual: pct(ok, pool.length), details: { conformes: ok, controlees: pool.length, penalite: 'incluse dans le taux de rejet COP' } };
      },
    },
    {
      name: `controle.correction_${kind}_24h`, label: `Taux de correction ${labelPrefix} en 24 heures`, family: 'controle',
      target: 100, direction: 'up', penalty: { mode: 'FORFAIT', perUnit: 50000, unit: 'jour de retard de correction' },
      formula: 'Écarts corrigés en 24H / écarts détectés',
      compute: (ctx) => {
        const rejetees = ctx.missions.filter((m) => m.typeTache === typeFilter && m.status === 'rejetee');
        if (rejetees.length === 0) return { actual: 100, details: { note: 'neutre — aucun écart' } };
        const corrected = rejetees.filter((m) =>
          ctx.missions.some((n) => n.clientSite === m.clientSite && n.typeTache === m.typeTache && CLOSED.includes(n.status) && n.dateMission > m.dateMission),
        ).length;
        const actual = pct(corrected, rejetees.length);
        return { actual, units: round2((rejetees.length - corrected) * 1), details: { corriges: corrected, ecarts: rejetees.length, note: 'correction = mission de reprise close sur le même site' } };
      },
    },
    {
      name: `controle.repetition_anomalies_${kind}`, label: `Taux de répétition des anomalies par une même équipe (${labelPrefix})`, family: 'controle',
      target: 2, direction: 'down', penalty: { mode: 'FORFAIT', perUnit: 100000, unit: 'point' },
      formula: 'Anomalies répétées par une même équipe sur 3 mois / anomalies totales',
      compute: (ctx) => {
        const withFail = ctx.missions
          .filter((m) => m.typeTache === typeFilter && m.teamId && ctx.reportByMission.get(m.id)?.failureReason)
          .map((m) => ({ teamId: m.teamId!, reason: ctx.reportByMission.get(m.id)!.failureReason! }));
        if (withFail.length === 0) return { actual: 2, details: { note: 'neutre — aucune anomalie motivée' } };
        const counted = new Map<string, number>();
        for (const f of withFail) counted.set(`${f.teamId}|${f.reason}`, (counted.get(`${f.teamId}|${f.reason}`) ?? 0) + 1);
        const repeated = [...counted.values()].filter((n) => n >= 2).length;
        const actual = round2((repeated / withFail.length) * 100);
        return { actual, units: round2(Math.max(0, actual - 2)), details: { repetitions: repeated, anomalies: withFail.length } };
      },
    },
    {
      name: `controle.environnement_tiers_${kind}`, label: `Respect de l'environnement des tiers (${labelPrefix})`, family: 'controle',
      target: 0, direction: 'down', penalty: { mode: 'NONE' },
      formula: 'Constats de non-respect environnemental par mois (suspension technicien)',
      compute: (ctx) => {
        const constats = ctx.incidents.filter((i) => /environnement|d[ée]chet|trou non bouch[ée]|nuisance/i.test(i.annotationOriginale ?? '')).length;
        return { actual: constats, details: { constats, sanction: 'suspension du technicien (commission de discipline Sonatel)' } };
      },
    },
  ];
}

function zoneKpi(name: string, label: string, target: 'PBO' | 'PIO_CABLE' | 'PIO_ACCESSOIRE' | 'CHAMBRE', amount: number, formula: string): KpiDef {
  return {
    name, label, family: 'zone',
    target: 0, direction: 'down',
    penalty: { mode: 'FORFAIT', perUnit: amount, unit: `constat non corrigé sous 48 h (${amount.toLocaleString('fr-FR')} F)` },
    formula,
    compute: (ctx) => {
      const open48 = ctx.incidents.filter((i) => {
        if (target === 'PBO') return i.rubrique === 'PBO';
        if (target === 'CHAMBRE') return i.rubrique === 'CHAMBRE';
        if (i.rubrique !== 'PIO') return false;
        return target === 'PIO_CABLE' ? i.pioType === 'CABLE' : i.pioType === 'ACCESSOIRE';
      }).filter((i) => {
        const age = i.resolvedAt ? daysBetween(i.resolvedAt, i.reportedAt) : daysBetween(ctx.end, i.reportedAt);
        return age > 2; // > 48 h
      });
      return { actual: open48.length, units: open48.length, details: { constats: open48.length, delai: '48 h', source: 'module Incidents' } };
    },
  };
}

function teamCountKpi(ctx: KpiContext, kind: 'non_validees' | 'suspendues' | 'non_conformes_pct') {
  if (ctx.teams.length === 0) return { actual: 0, details: { note: 'aucune équipe — neutre' } };
  const recordByTeam = new Map(ctx.records.map((r) => [r.teamId, r]));
  const withoutValid = ctx.teams.filter((t) => t.active && recordByTeam.get(t.id)?.status !== 'valide');
  if (kind === 'non_validees') return { actual: withoutValid.length, units: withoutValid.length, details: { equipes: withoutValid.length } };
  if (kind === 'suspendues') {
    const suspended = ctx.teams.filter((t) => t.active && recordByTeam.get(t.id)?.status === 'rejete');
    return { actual: suspended.length, units: suspended.length, details: { equipes: suspended.length } };
  }
  const pctNc = pct(withoutValid.length, ctx.teams.filter((t) => t.active).length);
  return {
    actual: Number.isNaN(pctNc) ? 0 : pctNc,
    units: Math.max(0, withoutValid.length - Math.ceil((2 / 100) * ctx.teams.filter((t) => t.active).length)),
    details: { non_conformes: withoutValid.length, equipes: ctx.teams.filter((t) => t.active).length },
  };
}

function inPeriod(mv: StockMovement, ctx: KpiContext): boolean {
  const d = mv.createdAt ?? new Date(0);
  return d >= ctx.start && d <= ctx.end;
}

function periodBounds(period: string): { start: Date; end: Date; evaluationDate: string } {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end, evaluationDate: `${period}-01` };
}

/** Absorbe la dérive d'arrondi du plafond sur le KPI le plus lourd. */
function anchorToCap(logs: SonatelKpiLog[], cap: number, save: (l: SonatelKpiLog) => Promise<unknown>) {
  const sum = round2(logs.reduce((s, l) => s + Number(l.penaltyAmount), 0));
  const drift = round2(cap - sum);
  if (Math.abs(drift) < 0.01) return;
  const biggest = logs
    .filter((l) => Number(l.penaltyAmount) > Math.abs(drift))
    .sort((a, b) => Number(b.penaltyAmount) - Number(a.penaltyAmount))[0];
  if (biggest) {
    biggest.penaltyAmount = String(round2(Number(biggest.penaltyAmount) + drift));
    void save(biggest);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Service
// ═══════════════════════════════════════════════════════════════
@Injectable()
export class KpiSonatelService {
  private readonly logger = new Logger(KpiSonatelService.name);

  constructor(
    @InjectRepository(SonatelKpiLog)
    private readonly logRepository: Repository<SonatelKpiLog>,
    @InjectRepository(SonatelKpiAlert)
    private readonly alertRepository: Repository<SonatelKpiAlert>,
    @InjectRepository(KpiTcoInput)
    private readonly tcoRepository: Repository<KpiTcoInput>,
    @InjectRepository(KpiMasteryPlan)
    private readonly masteryRepository: Repository<KpiMasteryPlan>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(ComplianceRecord)
    private readonly recordRepository: Repository<ComplianceRecord>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(InvoiceLine)
    private readonly invoiceLineRepository: Repository<InvoiceLine>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoicePenalty)
    private readonly invoicePenaltyRepository: Repository<InvoicePenalty>,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
  ) {}

  /** Registre des familles (pour les onglets du front). */
  families() {
    return KPI_FAMILIES.map((family) => {
      const defs = KPI_DEFS.filter((d) => d.family === family);
      return { family, label: FAMILY_LABELS[family], count: defs.length };
    });
  }

  // ─────────────────────────────────────────────
  //  Calcul mensuel
  // ─────────────────────────────────────────────
  /** Calcule et persiste tous les KPI Optimax du mois (upsert par KPI × date). */
  async calculateAll(companyId: string, period: string): Promise<SonatelKpiLog[]> {
    const ctx = await this.buildContext(companyId, period);
    const logs: SonatelKpiLog[] = [];

    for (const def of KPI_DEFS) {
      const { actual, units = 0, poPercent, details = {} } = def.compute(ctx);
      const reached = def.direction === 'up' ? actual >= def.target : actual <= def.target;
      const penaltyAmount = reached ? 0 : this.penaltyFor(def, actual, units, poPercent, ctx);

      const enriched: Record<string, unknown> = {
        ...details,
        label: def.label,
        family: def.family,
        direction: def.direction,
        formula: def.formula,
        penaltyMode: def.penalty.mode,
        penaltyLabel: this.penaltyLabel(def),
        tcoSegment: def.penalty.mode === 'TCO' ? def.penalty.segment : undefined,
        tco: def.penalty.mode === 'TCO' ? ctx.tco[def.penalty.segment] : undefined,
        units,
      };

      let log = await this.logRepository.findOne({ where: { companyId, kpiName: def.name, evaluationDate: ctx.start.toISOString().slice(0, 10) } });
      if (!log) log = this.logRepository.create({ companyId, kpiName: def.name, evaluationDate: ctx.start.toISOString().slice(0, 10) });
      log.family = def.family;
      log.penaltyMode = def.penalty.mode;
      log.target = String(def.target);
      log.actual = String(actual);
      log.status = reached ? 'atteint' : 'non_atteint';
      log.penaltyAmount = String(round2(penaltyAmount));
      log.unitCount = String(units);
      log.details = enriched;
      logs.push(await this.logRepository.save(log));
    }

    // Purge des logs d'un ancien registre (renommés/disparus) pour ce mois.
    const known = new Set(KPI_DEFS.map((d) => d.name));
    await this.logRepository
      .createQueryBuilder()
      .delete()
      .from(SonatelKpiLog)
      .where('company_id = :cid AND evaluation_date = :ed AND kpi_name NOT IN (:...known)', {
        cid: companyId,
        ed: ctx.start.toISOString().slice(0, 10),
        known: [...known],
      })
      .execute();

    // Plafonds : 20 % Production & SAV (hors ext/densif) ; 20 % du PO par lot ext/densif.
    await this.applyCaps(companyId, period, logs);
    this.logger.log(`KPI Optimax ${period} recalculés pour ${companyId} (${KPI_DEFS.length} indicateurs)`);
    return logs;
  }

  private async applyCaps(companyId: string, period: string, logs: SonatelKpiLog[]): Promise<void> {
    const { tco, tcoSource } = await this.resolveTcos(companyId, period);
    const prodSavBase = tco.PRODUCTION_EM + tco.PRODUCTION_HM_MM + tco.PRODUCTION_B2B + tco.AUTRE_TECHNO + tco.MAINTENANCE;
    const globalCap = round2(prodSavBase * 0.2);
    const extBase = tco.EXTENSION_LOT + tco.DENSIFICATION_LOT;
    const extCap = round2(extBase * 0.2);

    const extLogs = logs.filter((l) => EXT_FAMILIES.includes(l.family as KpiFamily));
    const otherLogs = logs.filter((l) => !EXT_FAMILIES.includes(l.family as KpiFamily));
    const extSum = extLogs.reduce((s, l) => s + Number(l.penaltyAmount), 0);
    const otherSum = otherLogs.reduce((s, l) => s + Number(l.penaltyAmount), 0);

    if (globalCap > 0 && otherSum > globalCap) {
      const scale = globalCap / otherSum;
      for (const l of otherLogs) {
        if (Number(l.penaltyAmount) > 0) {
          l.penaltyAmount = String(round2(Number(l.penaltyAmount) * scale));
          l.details = { ...l.details, capped: true, plafond: '20 % Production & SAV' };
          await this.logRepository.save(l);
        }
      }
      anchorToCap(otherLogs, globalCap, (l) => this.logRepository.save(l));
    }
    if (extCap > 0 && extSum > extCap) {
      const scale = extCap / extSum;
      for (const l of extLogs) {
        if (Number(l.penaltyAmount) > 0) {
          l.penaltyAmount = String(round2(Number(l.penaltyAmount) * scale));
          l.details = { ...l.details, capped: true, plafond: '20 % du PO du lot' };
          await this.logRepository.save(l);
        }
      }
      anchorToCap(extLogs, extCap, (l) => this.logRepository.save(l));
    }
  }

  /** Pénalité selon le mode contractuel : TCO ou forfait. */
  private penaltyFor(def: KpiDef, actual: number, units: number, poPercent: number | undefined, ctx: KpiContext): number {
    const p = def.penalty;
    if (p.mode === 'NONE') return 0;
    if (p.mode === 'TCO') {
      const gapPoints = def.direction === 'up' ? def.target - actual : actual - def.target;
      return (Math.max(0, gapPoints) / 100) * ctx.tco[p.segment];
    }
    if (p.mode === 'PO_PERCENT') {
      const base = ctx.tco.EXTENSION_LOT + ctx.tco.DENSIFICATION_LOT;
      return ((poPercent ?? 0) / 100) * base;
    }
    return Math.max(0, units) * p.perUnit;
  }

  private penaltyLabel(def: KpiDef): string {
    const p = def.penalty;
    if (p.mode === 'NONE') return 'Suivi — non pénalisé';
    if (p.mode === 'TCO') return '(Objectif − taux) × TCO du segment';
    if (p.mode === 'PO_PERCENT') return 'Amende 5 % ou 25 % du PO du lot';
    return `${p.perUnit.toLocaleString('fr-FR')} F par ${p.unit}`;
  }

  // ─────────────────────────────────────────────
  //  Contexte préchargé du mois
  // ─────────────────────────────────────────────
  private async buildContext(companyId: string, period: string): Promise<KpiContext> {
    const { start, end } = periodBounds(period);
    const weekStartFrom = new Date(start.getTime() - 7 * DAY).toISOString().slice(0, 10);

    const [missions, incidents, teams, records, attendance, movements, stockRaw, tcos] = await Promise.all([
      this.missionRepository.createQueryBuilder('m')
        .where('m.company_id = :cid AND (m.date_mission BETWEEN :s AND :e OR m.created_at BETWEEN :s AND :e)', { cid: companyId, s: start, e: end })
        .getMany(),
      this.incidentRepository.find({ where: { companyId } }),
      this.teamRepository.find({ where: { companyId } }),
      this.recordRepository.find({ where: { companyId } }),
      this.attendanceRepository.createQueryBuilder('a')
        .where('a.company_id = :cid AND a.week_start >= :ws AND a.week_start <= :we', { cid: companyId, ws: weekStartFrom, we: end.toISOString().slice(0, 10) })
        .getMany(),
      this.movementRepository.createQueryBuilder('mv')
        .where('mv.company_id = :cid AND mv.created_at BETWEEN :s AND :e', { cid: companyId, s: new Date(start.getTime() - 190 * DAY), e: end })
        .andWhere('mv.cancelled_at IS NULL')
        .getMany(),
      this.reportRepository.query(
        `SELECT i.id, i.reference, COALESCE(SUM(l.quantity), 0) AS total, i.threshold_alert,
                (SELECT MAX(mv.created_at) FROM stock_movements mv WHERE mv.stock_item_id = i.id) AS last_movement_at
         FROM stock_items i LEFT JOIN stock_levels l ON l.stock_item_id = i.id
         WHERE i.company_id = $1 GROUP BY i.id, i.reference, i.threshold_alert`,
        [companyId],
      ),
      this.resolveTcos(companyId, period),
    ]);

    const missionIds = missions.map((m) => m.id);
    const reports = missionIds.length > 0
      ? await this.reportRepository.find({ where: { companyId, missionId: In(missionIds) } })
      : [];
    const reportByMission = new Map(reports.map((r) => [r.missionId, r]));

    const stockRows: StockRow[] = (stockRaw as Array<{ id: string; reference: string; total: string; threshold_alert: number; last_movement_at: Date | null }>).map((r) => ({
      id: r.id,
      reference: r.reference,
      total: Number(r.total),
      threshold: Number(r.threshold_alert),
      lastMovementAt: r.last_movement_at ? new Date(r.last_movement_at) : null,
    }));

    return {
      companyId, period, start, end,
      missions, reportByMission, incidents, teams, records, attendance,
      stockRows, movements, tco: tcos.tco, tcoSource: tcos.tcoSource,
    };
  }

  /**
   * TCO par segment : saisie manuelle prioritaire, sinon facture du mois
   * (production répartie EM/HM-MM/B2B au prorata des missions), sinon 0.
   */
  private async resolveTcos(companyId: string, period: string): Promise<{ tco: Record<TcoSegment, number>; tcoSource: Record<TcoSegment, 'saisie' | 'facture' | 'aucune'> }> {
    const tco = Object.fromEntries(TCO_SEGMENTS.map((s) => [s, 0])) as Record<TcoSegment, number>;
    const tcoSource = Object.fromEntries(TCO_SEGMENTS.map((s) => [s, 'aucune'])) as Record<TcoSegment, 'saisie' | 'facture' | 'aucune'>;

    const inputs = await this.tcoRepository.find({ where: { companyId, period } });
    for (const input of inputs) {
      tco[input.segment] = Number(input.amount);
      tcoSource[input.segment] = 'saisie';
    }

    const { evaluationDate } = periodBounds(period);
    const invoice = await this.invoiceRepository
      .createQueryBuilder('i')
      .where('i.company_id = :cid AND i.period_start = :ps', { cid: companyId, ps: evaluationDate })
      .getOne();
    if (!invoice) return { tco, tcoSource };
    const lines = await this.invoiceLineRepository.find({ where: { companyId, invoiceId: invoice.id } });
    const production = lines.filter((l) => l.category === 'PRODUCTION').reduce((s, l) => s + Number(l.total), 0);
    const sav = lines.filter((l) => l.category === 'SAV').reduce((s, l) => s + Number(l.total), 0);

    // Répartition de la production au prorata des missions du segment.
    const missions = await this.missionRepository.find({ where: { companyId } });
    const inMonth = missions.filter((m) => m.dateMission >= periodBounds(period).start && m.dateMission <= periodBounds(period).end && m.typeTache === 'INSTALLATION');
    const counts: Record<string, number> = { EM: 0, HM_MM: 0, B2B: 0, AUTRE_TECHNO: 0 };
    for (const m of inMonth) counts[segmentOf(m)] = (counts[segmentOf(m)] ?? 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const fill = (segment: TcoSegment, key: string, pool: number) => {
      if (tcoSource[segment] === 'saisie') return;
      if (total > 0) {
        tco[segment] = round2(pool * (counts[key] / total));
        tcoSource[segment] = 'facture';
      }
    };
    fill('PRODUCTION_EM', 'EM', production);
    fill('PRODUCTION_HM_MM', 'HM_MM', production);
    fill('PRODUCTION_B2B', 'B2B', production);
    fill('AUTRE_TECHNO', 'AUTRE_TECHNO', production);
    if (tcoSource.MAINTENANCE !== 'saisie') {
      tco.MAINTENANCE = round2(sav);
      tcoSource.MAINTENANCE = 'facture';
    }
    return { tco, tcoSource };
  }

  // ─────────────────────────────────────────────
  //  TCO : saisie mensuelle
  // ─────────────────────────────────────────────
  async getTcoInputs(companyId: string, period: string) {
    const { tco, tcoSource } = await this.resolveTcos(companyId, period);
    const inputs = await this.tcoRepository.find({ where: { companyId, period } });
    const bySegment = new Map(inputs.map((i) => [i.segment, i]));
    return {
      period,
      segments: TCO_SEGMENTS.map((segment) => ({
        segment,
        label: segment,
        resolved: tco[segment],
        source: tcoSource[segment],
        manual: bySegment.has(segment) ? Number(bySegment.get(segment)!.amount) : null,
        note: bySegment.get(segment)?.note ?? null,
      })),
    };
  }

  async upsertTcoInputs(companyId: string, period: string, entries: Array<{ segment: TcoSegment; amount: number; note?: string }>) {
    for (const entry of entries) {
      if (!TCO_SEGMENTS.includes(entry.segment)) continue;
      let input = await this.tcoRepository.findOne({ where: { companyId, period, segment: entry.segment } });
      if (!input) input = this.tcoRepository.create({ companyId, period, segment: entry.segment });
      input.amount = String(entry.amount ?? 0);
      input.note = entry.note ?? null;
      await this.tcoRepository.save(input);
    }
    return this.getTcoInputs(companyId, period);
  }

  // ─────────────────────────────────────────────
  //  Plans de maîtrise (obligation contractuelle)
  // ─────────────────────────────────────────────
  async listMasteryPlans(companyId: string, period: string) {
    return this.masteryRepository.find({ where: { companyId, period }, order: { status: 'ASC' } });
  }

  async upsertMasteryPlan(companyId: string, period: string, kpiName: string, data: Partial<KpiMasteryPlan>) {
    if (!KPI_DEFS.some((d) => d.name === kpiName)) throw new NotFoundException(`KPI inconnu : ${kpiName}`);
    let plan = await this.masteryRepository.findOne({ where: { companyId, period, kpiName } });
    if (!plan) plan = this.masteryRepository.create({ companyId, period, kpiName });
    plan.analysis = data.analysis ?? plan.analysis ?? '';
    plan.actions = data.actions ?? plan.actions ?? '';
    plan.responsible = data.responsible ?? plan.responsible ?? null;
    plan.dueDate = data.dueDate ?? plan.dueDate ?? null;
    plan.status = data.status ?? plan.status ?? 'ouvert';
    return this.masteryRepository.save(plan);
  }

  // ─────────────────────────────────────────────
  //  Lecture : dashboard / alertes / historique
  // ─────────────────────────────────────────────
  async dashboard(companyId: string, period?: string) {
    const p = period ?? new Date().toISOString().slice(0, 7);
    const { evaluationDate } = periodBounds(p);
    const known = new Set(KPI_DEFS.map((d) => d.name));
    const logs = (await this.logRepository.find({ where: { companyId, evaluationDate }, order: { kpiName: 'ASC' } }))
      .filter((l) => known.has(l.kpiName));
    const nonAtteints = logs.filter((l) => l.status === 'non_atteint');

    const [tco, bonus] = await Promise.all([
      this.resolveTcos(companyId, p),
      this.bonus(companyId, p),
    ]);
    const prodSavBase = tco.tco.PRODUCTION_EM + tco.tco.PRODUCTION_HM_MM + tco.tco.PRODUCTION_B2B + tco.tco.AUTRE_TECHNO + tco.tco.MAINTENANCE;
    const extBase = tco.tco.EXTENSION_LOT + tco.tco.DENSIFICATION_LOT;
    const penaltiesTotal = round2(logs.reduce((s, l) => s + Number(l.penaltyAmount), 0));

    const families = KPI_FAMILIES.map((family) => {
      const entries = logs.filter((l) => l.family === family);
      return {
        family,
        label: FAMILY_LABELS[family],
        total: entries.length,
        atteints: entries.filter((e) => e.status === 'atteint').length,
        penalties: round2(entries.reduce((s, e) => s + Number(e.penaltyAmount), 0)),
      };
    });

    return {
      period: p,
      total: logs.length,
      atteints: logs.length - nonAtteints.length,
      nonAtteints: nonAtteints.length,
      penaltiesTotal,
      plafond: {
        baseProductionSav: round2(prodSavBase),
        globalCap: round2(prodSavBase * 0.2),
        baseExtDensif: round2(extBase),
        extCap: round2(extBase * 0.2),
        applique: penaltiesTotal,
      },
      bonus,
      tco: tco.tco,
      tcoSource: tco.tcoSource,
      families,
      kpis: logs,
    };
  }

  async checkAlerts(companyId: string, period?: string): Promise<SonatelKpiAlert[]> {
    const dash = await this.dashboard(companyId, period);
    const openAlerts = await this.alertRepository.find({ where: { companyId, isResolved: false } });
    const openByKpi = new Set(openAlerts.map((a) => a.kpiName));
    const created: SonatelKpiAlert[] = [];

    for (const log of dash.kpis.filter((k) => k.status === 'non_atteint')) {
      if (openByKpi.has(log.kpiName)) continue;
      const target = Number(log.target);
      const actual = Number(log.actual);
      const gap = round2(Math.abs(target - actual));
      const severity: 'warning' | 'critical' = gap > Math.max(2, target * 0.5) ? 'critical' : 'warning';
      created.push(
        await this.alertRepository.save(
          this.alertRepository.create({ companyId, kpiName: log.kpiName, currentValue: String(actual), target: String(target), gap: String(gap), severity }),
        ),
      );
    }
    if (created.length > 0) this.logger.warn(`${created.length} alerte(s) KPI ouverte(s)`);
    return created;
  }

  async listAlerts(companyId: string, resolved?: boolean) {
    const where: Record<string, unknown> = { companyId };
    if (resolved !== undefined) where.isResolved = resolved;
    return this.alertRepository.find({ where, order: { alertDate: 'DESC' } });
  }

  async resolveAlert(companyId: string, id: string) {
    const alert = await this.alertRepository.findOne({ where: { companyId, id } });
    if (!alert) throw new NotFoundException('Alerte introuvable');
    alert.isResolved = true;
    alert.resolvedAt = new Date();
    return this.alertRepository.save(alert);
  }

  async history(companyId: string, from?: string, to?: string) {
    const qb = this.logRepository
      .createQueryBuilder('l')
      .where('l.company_id = :cid', { cid: companyId })
      .orderBy('l.evaluationDate', 'DESC')
      .addOrderBy('l.kpiName', 'ASC');
    if (from) qb.andWhere('l.evaluation_date >= :from', { from: `${from}-01` });
    if (to) qb.andWhere('l.evaluation_date <= :to', { to: `${to}-31` });
    const logs = await qb.getMany();
    const byMonth = new Map<string, SonatelKpiLog[]>();
    for (const log of logs) {
      const month = log.evaluationDate.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), log]);
    }
    return {
      months: [...byMonth.entries()].map(([month, entries]) => ({
        month,
        atteints: entries.filter((e) => e.status === 'atteint').length,
        nonAtteints: entries.filter((e) => e.status === 'non_atteint').length,
        penaltiesTotal: round2(entries.reduce((s, e) => s + Number(e.penaltyAmount), 0)),
        kpis: entries,
      })),
    };
  }

  /** Rapport mensuel Optimax : synthèse + familles + détails + plafond + bonus + plans de maîtrise. */
  async generateReport(companyId: string, period: string) {
    const dash = await this.dashboard(companyId, period);
    const plans = await this.listMasteryPlans(companyId, period);
    const planByKpi = new Map(plans.map((p) => [p.kpiName, p]));
    return {
      period,
      summary: {
        total: dash.total,
        atteints: dash.atteints,
        nonAtteints: dash.nonAtteints,
        penaltiesTotal: dash.penaltiesTotal,
      },
      families: dash.families,
      plafond: dash.plafond,
      bonus: dash.bonus,
      tco: dash.tco,
      details: dash.kpis.map((k) => ({
        ...k,
        masteryPlan: planByKpi.get(k.kpiName) ?? null,
      })),
    };
  }

  /** Bonus : 3 mois consécutifs tous KPI atteints → +1 M FCFA par point de marge (plafond 5 M). */
  async bonus(companyId: string, period: string) {
    const [y, m] = period.split('-').map(Number);
    const months = [0, 1, 2].map((i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
    const logs = await this.logRepository
      .createQueryBuilder('l')
      .where('l.company_id = :cid AND l.evaluation_date IN (:...dates)', { cid: companyId, dates: months.map((mm) => `${mm}-01`) })
      .getMany();

    const byMonth = new Map<string, SonatelKpiLog[]>();
    for (const log of logs) {
      const month = log.evaluationDate.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), log]);
    }
    const eligible = months.every((mm) => {
      const entries = byMonth.get(mm) ?? [];
      return entries.length === KPI_DEFS.length && entries.every((e) => e.status === 'atteint');
    });

    let amount = 0;
    let margePoints = 0;
    if (eligible) {
      const margins: number[] = [];
      for (const def of KPI_DEFS) {
        const entries = months.flatMap((mm) => byMonth.get(mm) ?? []).filter((e) => e.kpiName === def.name);
        for (const e of entries) {
          margins.push(def.direction === 'up' ? Number(e.actual) - Number(e.target) : Number(e.target) - Number(e.actual));
        }
      }
      margePoints = Math.max(0, Math.floor(Math.min(...margins, 5)));
      amount = margePoints * 1_000_000;
    }
    return { eligible, months, margePoints, amount, plafond: 5_000_000 };
  }

  /** Pénalités de la période, appliquées à la facture du mois (InvoicePenalty). */
  async calculatePenalties(companyId: string, period: string, invoiceId?: string) {
    const { evaluationDate } = periodBounds(period);
    const invoice = invoiceId
      ? await this.invoiceRepository.findOne({ where: { companyId, id: invoiceId } })
      : await this.invoiceRepository.findOne({
          where: { companyId, periodStart: evaluationDate, kind: 'periodique', status: In(EDITABLE_INVOICE_STATUSES) },
          order: { createdAt: 'DESC' },
        });
    if (!invoice) throw new NotFoundException(`Aucune facture brouillon pour ${period} — générez-la d'abord`);
    if (!EDITABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(`Facture ${invoice.invoiceNumber} déjà émise (${invoice.status}) — pénalités non modifiables`);
    }

    const logs = await this.logRepository.find({ where: { companyId, evaluationDate } });
    const applicable = logs.filter((l) => l.status === 'non_atteint' && Number(l.penaltyAmount) > 0);

    await this.invoicePenaltyRepository.delete({ companyId, invoiceId: invoice.id });
    for (const log of applicable) {
      await this.invoicePenaltyRepository.insert({
        companyId,
        invoiceId: invoice.id,
        kpiName: log.kpiName,
        target: log.target,
        actual: log.actual,
        penaltyAmount: log.penaltyAmount,
      } as never);
    }
    await this.invoicesService.recomputeTotals(companyId, invoice.id);

    const total = round2(applicable.reduce((s, l) => s + Number(l.penaltyAmount), 0));
    this.logger.log(`Pénalités ${period} : ${total} FCFA appliqués à ${invoice.invoiceNumber}`);
    return {
      period,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber },
      penalties: applicable.map((l) => ({
        kpiName: l.kpiName,
        family: l.family,
        penaltyMode: l.penaltyMode,
        target: Number(l.target),
        actual: Number(l.actual),
        unitCount: Number(l.unitCount),
        penaltyAmount: Number(l.penaltyAmount),
      })),
      total,
    };
  }
}
