import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { classifyBlocage } from '../../common/sonatel-vocabulary';

/**
 * Lot P9 — Dashboard performance ONECOMIT (fichiers Dashboard_Performance S27→S30).
 * Enrichissement : ND S27, semaine ISO, OLT normalisés, motifs COMMENTAIRES bruts,
 * TACHES EFFECTUEES, Adresse / Date Validation / horaires / GPS, export Excel ONECOMIT.
 */
@Injectable()
export class PerformanceDashboardService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
  ) {}

  /** Numéro de semaine ISO (S27, S30…). */
  static isoWeek(d: Date): number {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /** Bornes lundi→dimanche UTC d'une semaine ISO. */
  static weekBounds(week: number, year?: number): { from: string; to: string } {
    const y = year ?? new Date().getUTCFullYear();
    // Le 4 janvier est toujours dans la semaine ISO 1
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1);
    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }

  /** Résout from/to à partir de dates libres ou d'une semaine ISO (?week=30&year=2026). */
  resolvePeriod(from?: string, to?: string, week?: number, year?: number): { start: Date; end: Date; week: number; from: string; to: string } {
    if (week && week >= 1 && week <= 53) {
      const b = PerformanceDashboardService.weekBounds(week, year);
      return {
        start: new Date(`${b.from}T00:00:00Z`),
        end: new Date(`${b.to}T23:59:59Z`),
        week,
        from: b.from,
        to: b.to,
      };
    }
    const now = new Date();
    const start = from ? new Date(`${from.slice(0, 10)}T00:00:00Z`) : new Date(now.getTime() - 7 * 86400000);
    const end = to ? new Date(`${to.slice(0, 10)}T23:59:59Z`) : now;
    return {
      start,
      end,
      week: PerformanceDashboardService.isoWeek(end),
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  /**
   * Vue principale : performance par équipe et par OLT (format fichiers réels).
   * OK = validee, fieldStatus succes, ou terminee sans motif de blocage (DAILY OK).
   */
  async dashboard(companyId: string, from?: string, to?: string, week?: number, year?: number) {
    const period = this.resolvePeriod(from, to, week, year);
    const { start, end } = period;

    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.team', 'team')
      .where('m.company_id = :cid AND m.date_mission BETWEEN :s AND :e', { cid: companyId, s: start, e: end })
      .getMany();
    const reports = missions.length
      ? await this.reportRepository
          .createQueryBuilder('r')
          .where('r.company_id = :cid', { cid: companyId })
          .andWhere('r.mission_id IN (:...ids)', { ids: missions.map((m) => m.id) })
          .getMany()
      : [];
    const reportByMission = new Map(reports.map((r) => [r.missionId, r]));

    const isOk = (m: Mission): boolean => {
      const r = reportByMission.get(m.id);
      if (m.status === 'validee') return true;
      if (r?.fieldStatus === 'succes') return true;
      return m.status === 'terminee' && !m.blocageMotif;
    };

    const byTeam = new Map<string, { cas: number; ok: number }>();
    const byOlt = new Map<string, { cas: number; ok: number }>();
    const nokMotifs = new Map<string, number>(); // libellés COMMENTAIRES bruts
    const nokCodes = new Map<string, number>(); // codes normalisés (complément)
    const tachesAgg = new Map<string, number>();
    let vaCapOui = 0;
    let vaCapTotal = 0;
    let nbsiRepeats = 0;

    for (const m of missions) {
      const team = m.importMeta?.teamLabel ?? m.team?.name ?? 'Non affectée';
      if (!byTeam.has(team)) byTeam.set(team, { cas: 0, ok: 0 });
      const t = byTeam.get(team)!;
      t.cas += 1;
      const ok = isOk(m);
      if (ok) t.ok += 1;

      const olt = normalizeOlt(m.sonatelOlt ?? m.zone) ?? 'N/A';
      if (!byOlt.has(olt)) byOlt.set(olt, { cas: 0, ok: 0 });
      const o = byOlt.get(olt)!;
      o.cas += 1;
      if (ok) o.ok += 1;

      if (!ok) {
        const raw = (m.blocageMotif ?? reportByMission.get(m.id)?.failureReason ?? 'AUTRE').trim() || 'AUTRE';
        nokMotifs.set(raw, (nokMotifs.get(raw) ?? 0) + 1);
        const code = m.blocageCode ?? classifyBlocage(raw).motif ?? 'autre';
        nokCodes.set(code, (nokCodes.get(code) ?? 0) + 1);
      }

      if (m.tachesEffectuees) {
        const key = m.tachesEffectuees.trim().toUpperCase();
        tachesAgg.set(key, (tachesAgg.get(key) ?? 0) + 1);
      }
      if (m.vaCap) {
        vaCapTotal += 1;
        if (/^oui$/i.test(m.vaCap.trim())) vaCapOui += 1;
      }
      if ((m.nbsi ?? 0) > 1) nbsiRepeats += 1;
    }

    const teams = [...byTeam.entries()]
      .map(([equipe, v]) => ({
        equipe,
        cas: v.cas,
        ok: v.ok,
        nok: v.cas - v.ok,
        taux: v.cas > 0 ? Math.round((v.ok / v.cas) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.taux - a.taux || b.cas - a.cas);

    const olts = [...byOlt.entries()]
      .map(([olt, v]) => ({
        olt,
        cas: v.cas,
        ok: v.ok,
        nok: v.cas - v.ok,
        taux: v.cas > 0 ? Math.round((v.ok / v.cas) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.cas - a.cas);

    const totalCas = missions.length;
    const totalOk = missions.filter(isOk).length;

    return {
      period: { from: period.from, to: period.to },
      week: period.week,
      summary: {
        totalCas,
        totalOk,
        totalNok: totalCas - totalOk,
        taux: totalCas > 0 ? Math.round((totalOk / totalCas) * 1000) / 10 : 0,
        vaCapOui,
        vaCapTotal,
        nbsiRepeats,
      },
      teams,
      olts,
      // Motifs NOK = libellés COMMENTAIRES Excel (SATURATION PBO, ZONE CLIENT NON FIBREE…)
      nokMotifs: [...nokMotifs.entries()]
        .map(([motif, count]) => ({ motif, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      nokCodes: [...nokCodes.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      tachesEffectuees: [...tachesAgg.entries()]
        .map(([tache, count]) => ({ tache, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async interpret(companyId: string, from?: string, to?: string, week?: number, year?: number) {
    const dash = await this.dashboard(companyId, from, to, week, year);
    const points: string[] = [];
    const { summary, teams, olts, nokMotifs, week: w } = dash;

    points.push(
      `Semaine S${w} : ${summary.totalCas} demandes, ${summary.totalOk} OK (${summary.taux} %), ${summary.totalNok} NOK.`,
    );

    if (teams.length) {
      const best = teams[0];
      const worst = [...teams].filter((t) => t.cas >= 5).sort((a, b) => a.taux - b.taux)[0] ?? teams[teams.length - 1];
      points.push(`Meilleure équipe : ${best.equipe} (${best.taux} % sur ${best.cas} cas).`);
      if (worst && worst.equipe !== best.equipe) {
        points.push(`Point d'attention : ${worst.equipe} à ${worst.taux} % — prioriser coaching / affectation.`);
      }
    }

    if (olts.length) {
      const topVol = olts[0];
      const weak = [...olts].filter((o) => o.cas >= 10).sort((a, b) => a.taux - b.taux)[0];
      points.push(`OLT le plus chargé : ${topVol.olt} (${topVol.cas} cas, ${topVol.taux} % OK).`);
      if (weak) points.push(`OLT sous-performant : ${weak.olt} à ${weak.taux} % — revoir dispositif / SURCH.`);
    }

    if (nokMotifs.length) {
      const top = nokMotifs.slice(0, 3).map((m) => `${m.motif} (${m.count})`).join(', ');
      points.push(`Top motifs NOK : ${top}.`);
    }

    if (summary.vaCapTotal > 0) {
      const tauxVa = Math.round((summary.vaCapOui / summary.vaCapTotal) * 100);
      points.push(`VA CAP : ${summary.vaCapOui}/${summary.vaCapTotal} dossiers validés (${tauxVa} %).`);
    }
    if (summary.nbsiRepeats > 0) {
      points.push(`${summary.nbsiRepeats} dossier(s) avec NBSI > 1 (répétitions).`);
    }

    return {
      variant: 'ai' as const,
      disclaimer: 'Proposition IA — validation humaine requise avant toute décision opérationnelle.',
      bullets: points,
      period: dash.period,
      week: w,
    };
  }

  /** Année ISO de la semaine (le 29/12 peut appartenir à S1 de l'année suivante). */
  static isoWeekYear(d: Date): number {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    return date.getUTCFullYear();
  }

  private static weekKey(d: Date): string {
    return `${PerformanceDashboardService.isoWeekYear(d)}-W${String(PerformanceDashboardService.isoWeek(d)).padStart(2, '0')}`;
  }

  /** Semaines ISO contiguës jusqu'à la semaine courante, semaines sans activité à 0. */
  async trend(companyId: string, weeks = 5) {
    const now = new Date();
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
    const start = new Date(monday.getTime() - (weeks - 1) * 7 * 86400000);
    const end = new Date(monday.getTime() + 7 * 86400000);

    const buckets = new Map<string, { week: number; year: number; cas: number; ok: number }>();
    for (let i = 0; i < weeks; i++) {
      const d = new Date(start.getTime() + i * 7 * 86400000);
      buckets.set(PerformanceDashboardService.weekKey(d), {
        week: PerformanceDashboardService.isoWeek(d),
        year: PerformanceDashboardService.isoWeekYear(d),
        cas: 0,
        ok: 0,
      });
    }

    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :cid AND m.date_mission >= :s AND m.date_mission < :e', { cid: companyId, s: start, e: end })
      .getMany();
    const reports = missions.length
      ? await this.reportRepository
          .createQueryBuilder('r')
          .where('r.company_id = :cid', { cid: companyId })
          .andWhere('r.mission_id IN (:...ids)', { ids: missions.map((m) => m.id) })
          .getMany()
      : [];
    const successByMission = new Set(reports.filter((r) => r.fieldStatus === 'succes').map((r) => r.missionId));

    for (const m of missions) {
      const e = buckets.get(PerformanceDashboardService.weekKey(new Date(m.dateMission)));
      if (!e) continue;
      e.cas += 1;
      if (m.status === 'validee' || successByMission.has(m.id) || (m.status === 'terminee' && !m.blocageMotif)) e.ok += 1;
    }
    return {
      weeks: [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, v]) => ({
          key,
          week: `S${v.week}`,
          year: v.year,
          cas: v.cas,
          ok: v.ok,
          nok: v.cas - v.ok,
          taux: v.cas > 0 ? Math.round((v.ok / v.cas) * 100) : 0,
        })),
    };
  }

  /** Dernière semaine ISO ayant des missions (jusqu'à aujourd'hui) : période par défaut de l'écran. */
  async latestWeek(companyId: string): Promise<{ week: number; year: number; from: string; to: string; last: string } | null> {
    const row = await this.missionRepository
      .createQueryBuilder('m')
      .select('MAX(m.date_mission)', 'last')
      .where('m.company_id = :cid AND m.date_mission <= :now', { cid: companyId, now: new Date() })
      .getRawOne<{ last: Date | string | null }>();
    if (!row?.last) return null;
    const d = new Date(row.last);
    const week = PerformanceDashboardService.isoWeek(d);
    const year = PerformanceDashboardService.isoWeekYear(d);
    return { week, year, ...PerformanceDashboardService.weekBounds(week, year), last: d.toISOString() };
  }

  /** Export Excel format ONECOMIT : feuilles Dashboard + Dashboard_OLT (+ synthèse). */
  async exportExcel(companyId: string, from?: string, to?: string, week?: number, year?: number): Promise<Buffer> {
    const dash = await this.dashboard(companyId, from, to, week, year);
    const book = XLSX.utils.book_new();

    const teamRows: (string | number)[][] = [
      ['DASHBOARD INSTALLATION PAR EQUIPE'],
      ['Equipe', 'Nombre de cas', 'OK (installé)', 'NOK (non installé)', 'Taux % OK'],
      ...dash.teams.map((t) => [t.equipe, t.cas, t.ok, t.nok, t.taux / 100]),
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(teamRows), 'Dashboard');

    const oltRows: (string | number)[][] = [
      ['DASHBOARD INSTALLATION PAR OLT'],
      ['OLT', 'Nombre de cas', 'OK (installé)', 'NOK (non installé)', 'Taux OK %'],
      ...dash.olts.map((o) => [o.olt, o.cas, o.ok, o.nok, o.taux / 100]),
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(oltRows), 'Dashboard_OLT');

    const synth: (string | number)[][] = [
      ['SYNTHÈSE'],
      ['Semaine', `S${dash.week}`],
      ['Période', `${dash.period.from} → ${dash.period.to}`],
      ['Demandes', dash.summary.totalCas],
      ['OK', dash.summary.totalOk],
      ['NOK', dash.summary.totalNok],
      ['Taux OK %', dash.summary.taux / 100],
      [],
      ['Motif NOK', 'Count'],
      ...dash.nokMotifs.map((m) => [m.motif, m.count]),
      [],
      ['Tâche effectuée', 'Count'],
      ...dash.tachesEffectuees.map((t) => [t.tache, t.count]),
    ];
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(synth), 'Synthese');

    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /**
   * Import feuille DAILY (S27→S30) :
   * ND / ND installes, OLT normalisé, TACHES EFFECTUEES, Adresse, Date Validation,
   * H ARRIVEE/DEPART, GPS depuis OBSERVATIONS.
   */
  async importDaily(companyId: string, rows: Array<Record<string, unknown>>) {
    // Normaliser les clés (trim) — S27 a « ND installes » avec espace final
    const normalized = rows.map(normalizeRowKeys);

    let created = 0;
    let updated = 0;
    const ndCounts = new Map<string, number>();
    for (const row of normalized) {
      const nd = pickNd(row);
      if (nd) ndCounts.set(nd, (ndCounts.get(nd) ?? 0) + 1);
    }

    for (const row of normalized) {
      const dossier = str(row['Demande']);
      if (!dossier) continue;
      const statut = String(row['STATUT'] ?? '').toUpperCase();
      const commentaire = str(row['COMMENTAIRES']);
      const observations = str(row['OBSERVATIONS']);
      const tachesEffectuees = str(row['TACHES EFFECTUEES'] ?? row['TACHE EFFECTUEE']);
      const nd = pickNd(row);
      const vaCap = str(row['VA CAP'] ?? row['VA_CAP'] ?? row['BOUCLAGE']);
      const nbsi = nd ? (ndCounts.get(nd) ?? 1) : 1;
      const olt = normalizeOlt(str(row['OLT']));
      const gps = extractGps(observations) ?? extractGps(commentaire);
      const adresse = str(row['Adresse']);
      const dateValidation = parseDateOrNull(row['Date Validation']);
      const hArrivee = parseTimeOnDay(row['H ARRIVEE'] ?? row['H Arrivee'], row["Date d'intervention"]);
      const hDepart = parseTimeOnDay(row['H DEPART'] ?? row['H Depart'], row["Date d'intervention"]);

      let mission = await this.missionRepository.findOne({ where: { companyId, sonatelDossierNumber: dossier } });
      if (!mission) {
        mission = this.missionRepository.create({
          companyId,
          clientSite: str(row['Nom du Client']) ?? '(client)',
          typeTache: mapTask(str(row['Tâches'] ?? row['Taches']), tachesEffectuees),
          zone: olt,
          dateMission: parseDate(row["Date d'intervention"] ?? row['Date intervention']),
          status: statut === 'OK' ? 'terminee' : statut === 'NOK' ? 'rejetee' : 'planifiee',
          sonatelDossierNumber: dossier,
          sonatelOlt: olt,
          sonatelProduit: str(row['Commande Client']),
          commandeClient: str(row['Commande Client']),
          segment: str(row['SEGMENT']),
          srPlaque: str(row['SR/PLAQUE']),
          coper: str(row['Coper'] ?? row['COPER']),
          typeLogement: str(row['Type de logement']),
          clientAvise: str(row['Client avisé'] ?? row['Client avise']),
          ageDays: num(row['Age']),
          contactClient: str(row['Contact client']),
          heure: str(row['Heure']),
          piloteSonatel: str(row['Pilote SONATEL']) ?? str(row['PILOTES REGIS']),
          gpsEasyWork: gps,
          heureArrivee: hArrivee,
          heureDepartReelle: hDepart,
          codeOperation: tachesEffectuees,
          vaCap,
          nbsi,
          tachesEffectuees,
          // Motif NOK = COMMENTAIRES brut Excel (pas OBSERVATIONS seul)
          blocageMotif: statut === 'NOK' ? (commentaire ?? observations) : null,
          blocageCode: statut === 'NOK' ? classifyBlocage(commentaire ?? observations ?? '').motif : null,
          importSource: 'DAILY',
          importMeta: {
            teamLabel: str(row['EQUIPE']),
            technicians: [],
            sourceFile: 'Dashboard_Performance DAILY',
            nd,
            st: str(row['ST']),
            adresse,
            dateValidation: dateValidation ? dateValidation.toISOString().slice(0, 10) : null,
            observations,
          },
        });
        created++;
      } else {
        if (statut === 'OK' && !['validee'].includes(mission.status)) mission.status = 'terminee';
        if (statut === 'NOK') {
          mission.status = mission.status === 'validee' ? mission.status : 'rejetee';
          if (commentaire || observations) {
            mission.blocageMotif = commentaire ?? observations;
            mission.blocageCode = classifyBlocage(commentaire ?? observations ?? '').motif;
          }
        }
        mission.importMeta = {
          ...(mission.importMeta ?? {}),
          teamLabel: str(row['EQUIPE']) ?? mission.importMeta?.teamLabel,
          nd: nd ?? mission.importMeta?.nd,
          st: str(row['ST']) ?? mission.importMeta?.st,
          sourceFile: 'Dashboard_Performance DAILY',
          adresse: adresse ?? mission.importMeta?.adresse,
          dateValidation: dateValidation
            ? dateValidation.toISOString().slice(0, 10)
            : mission.importMeta?.dateValidation,
          observations: observations ?? mission.importMeta?.observations,
        };
        if (vaCap) mission.vaCap = vaCap;
        if (nbsi > (mission.nbsi ?? 0)) mission.nbsi = nbsi;
        if (tachesEffectuees) {
          mission.tachesEffectuees = tachesEffectuees;
          mission.codeOperation = tachesEffectuees;
        }
        if (str(row['SR/PLAQUE'])) mission.srPlaque = str(row['SR/PLAQUE']);
        if (olt) {
          mission.sonatelOlt = olt;
          mission.zone = olt;
        }
        if (gps && !mission.gpsEasyWork) mission.gpsEasyWork = gps;
        if (hArrivee) mission.heureArrivee = hArrivee;
        if (hDepart) mission.heureDepartReelle = hDepart;
        updated++;
      }
      await this.missionRepository.save(mission);
    }
    return { created, updated, total: rows.length };
  }
}

/** Trim des clés Excel (S27 : « ND installes »). */
function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim()] = v;
  }
  return out;
}

/** ND (S28+) ou « ND installes » (S27). */
function pickNd(row: Record<string, unknown>): string | null {
  for (const key of Object.keys(row)) {
    const k = key.trim().toLowerCase().replace(/\s+/g, ' ');
    if (k === 'nd' || k.startsWith('nd install')) {
      const v = str(row[key]);
      if (v) return v;
    }
  }
  return null;
}

/** Normalise les OLT pour éviter Mbodjene/MBODJENE, Porokhane/POROKHANE… */
function normalizeOlt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  const key = cleaned.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const canon: Record<string, string> = {
    mbour: 'Mbour',
    thiaroye: 'Thiaroye',
    touba: 'Touba',
    kaolack: 'Kaolack',
    kaffrine: 'Kaffrine',
    fatick: 'Fatick',
    koungheul: 'Koungheul',
    popenguine: 'Popenguine',
    nioro: 'Nioro',
    sokone: 'Sokone',
    fimela: 'Fimela',
    mbodjene: 'Mbodjene',
    porokhane: 'Porokhane',
    thies: 'Thies',
    tivaouane: 'Tivaouane',
    ndiassane: 'Ndiassane',
    mboro: 'Mboro',
  };
  return canon[key] ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/** Extrait lat,lng depuis OBSERVATIONS (ex. Saturation_…_14.425844,-16.955900_SOFA). */
function extractGps(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  return `${m[1]},${m[2]}`;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || /^(n\/a|na|n#a|-)$/i.test(s)) return null;
  return s;
}

function num(v: unknown): number | null {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s);
  return isFinite(n) ? Math.round(n) : null;
}

function mapTask(t: string | null, tachesEffectuees?: string | null): string {
  const v = `${t ?? ''} ${tachesEffectuees ?? ''}`.toLowerCase();
  if (v.includes('finalisation')) return 'INSTALLATION';
  if (v.includes('tirage') || v.includes('gpon')) return 'DEPLOIEMENT';
  if (v.includes('survey+install')) return 'INSTALLATION';
  if (v.includes('reconduction')) return 'INSTALLATION';
  if (v.includes('deplacement') || v.includes('déplacement')) return 'SAV';
  if (v.includes('installation')) return 'INSTALLATION';
  if (v.includes('sav') || v.includes('dérangement')) return 'SAV';
  if (v.includes('upgrade')) return 'DENSIFICATION';
  if (v.includes('survey')) return 'SURVEY';
  return 'INSTALLATION';
}

function parseDate(v: unknown): Date {
  const d = parseDateOrNull(v);
  return d ?? new Date();
}

function parseDateOrNull(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'number' && isFinite(v)) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000);
  }
  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse « 09:30 » ou Date Excel sur le jour d'intervention. */
function parseTimeOnDay(timeVal: unknown, dayVal: unknown): Date | null {
  const day = parseDateOrNull(dayVal) ?? new Date();
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) return timeVal;
  const s = str(timeVal);
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const d = new Date(day);
  d.setUTCHours(Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0);
  return d;
}
