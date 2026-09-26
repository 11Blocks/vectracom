import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Expense } from '../accounting/entities/expense.entity';
import { KpiSonatelService } from '../kpi-sonatel/kpi-sonatel.service';

const CLOSED = ['terminee', 'validee'];
const OPEN = ['planifiee', 'en_cours', 'a_completer'];

export type ReportId = 'performance' | 'olt' | 'stock-vehicles' | 'kpi' | 'incidents' | 'planning';

export interface ReportSection {
  name: string;
  rows: Array<Record<string, string | number>>;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly kpiService: KpiSonatelService,
  ) {}

  private async missionsInPeriod(companyId: string, startDate: string, endDate: string) {
    return this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :cid AND m.date_mission BETWEEN :s AND :e', {
        cid: companyId,
        s: new Date(startDate),
        e: new Date(`${endDate}T23:59:59.999Z`),
      })
      .getMany();
  }

  private async reportsFor(companyId: string, missionIds: string[]): Promise<
    Array<{ mission_id: string; field_status: string | null; failure_reason: string | null }>
  > {
    if (missionIds.length === 0) return [];
    return this.dataSource.query(
      `SELECT r.mission_id, r.field_status, r.failure_reason FROM mission_field_reports r
       WHERE r.company_id = $1 AND r.mission_id = ANY($2::uuid[])`,
      [companyId, missionIds],
    );
  }

  // ---------- Rapport 1 : performance missions & techniciens ----------

  async getPerformanceReport(companyId: string, startDate: string, endDate: string) {
    const missions = await this.missionsInPeriod(companyId, startDate, endDate);
    const closed = missions.filter((m) => CLOSED.includes(m.status));
    const reports = await this.reportsFor(companyId, closed.map((m) => m.id));
    const statusByMission = new Map(reports.map((r) => [r.mission_id, r.field_status]));

    const ok = closed.filter((m) => statusByMission.get(m.id) === 'succes').length;
    const nok = closed.filter((m) => statusByMission.get(m.id) === 'echec').length;
    const okRate = closed.length > 0 ? round2((ok / closed.length) * 100) : 0;

    const technicians = await this.technicianRepository.find({ where: { companyId } });
    const techById = new Map(technicians.map((t) => [t.id, t]));
    const byTechnician = technicians
      .map((t) => {
        const own = closed.filter((m) => m.technicianIds.includes(t.id));
        const ownOk = own.filter((m) => statusByMission.get(m.id) === 'succes').length;
        return {
          technicianId: t.id,
          fullName: t.fullName,
          isTeamLeader: t.isTeamLeader,
          missions: own.length,
          ok: ownOk,
          nok: own.length - ownOk,
          okRate: own.length > 0 ? round2((ownOk / own.length) * 100) : 0,
        };
      })
      .filter((row) => row.missions > 0)
      .sort((a, b) => b.missions - a.missions);

    const reasonCounts = new Map<string, number>();
    for (const r of reports) {
      if (r.field_status === 'echec' && r.failure_reason) {
        reasonCounts.set(r.failure_reason, (reasonCounts.get(r.failure_reason) ?? 0) + 1);
      }
    }
    const topFailureReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count }));

    return {
      report: 'performance' as const,
      period: { startDate, endDate },
      totalMissions: missions.length,
      closedMissions: closed.length,
      ok, nok, okRate, nokRate: closed.length > 0 ? round2((nok / closed.length) * 100) : 0,
      byTechnician,
      topFailureReasons,
    };
  }

  // ---------- Rapport 2 : activité par zone OLT ----------

  async getOltReport(companyId: string, startDate: string, endDate: string) {
    const missions = await this.missionsInPeriod(companyId, startDate, endDate);
    const reports = await this.reportsFor(companyId, missions.map((m) => m.id));
    const statusByMission = new Map(reports.map((r) => [r.mission_id, r.field_status]));

    const zones = new Map<string, { zone: string; recues: number; executees: number; enAttente: number; reussies: number }>();
    for (const mission of missions) {
      const olt = mission.sonatelOlt ?? '(non renseigne)';
      const entry = zones.get(olt) ?? { zone: olt, recues: 0, executees: 0, enAttente: 0, reussies: 0 };
      entry.recues++;
      if (CLOSED.includes(mission.status)) {
        entry.executees++;
        if (statusByMission.get(mission.id) === 'succes') entry.reussies++;
      } else if (OPEN.includes(mission.status)) {
        entry.enAttente++;
      }
      zones.set(olt, entry);
    }
    const byZone = [...zones.values()]
      .map((z) => ({
        ...z,
        tauxReussite: z.executees > 0 ? round2((z.reussies / z.executees) * 100) : null,
      }))
      .sort((a, b) => b.recues - a.recues);

    const executees = byZone.reduce((s, z) => s + z.executees, 0);
    const reussies = byZone.reduce((s, z) => s + z.reussies, 0);
    return {
      report: 'olt' as const,
      period: { startDate, endDate },
      byZone,
      total: missions.length,
      executees,
      enAttente: byZone.reduce((s, z) => s + z.enAttente, 0),
      successRate: executees > 0 ? round2((reussies / executees) * 100) : null,
    };
  }

  // ---------- Rapport 3 : usage stock & véhicules ----------

  async getStockVehiclesReport(companyId: string, startDate: string, endDate: string) {
    const movements = await this.dataSource.query(
      `SELECT sm.stock_item_id, SUM(sm.quantity) AS quantite
       FROM stock_movements sm
       WHERE sm.company_id = $1 AND sm.type = 'consommation' AND sm.cancelled_at IS NULL
         AND sm.created_at BETWEEN $2 AND $3
       GROUP BY sm.stock_item_id`,
      [companyId, new Date(startDate), new Date(`${endDate}T23:59:59.999Z`)],
    );
    const items = await this.stockItemRepository.find({ where: { companyId } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    const consumption: Array<{ reference: string; designation: string; quantity: number; unit: string }> = movements.map(
      (row: { stock_item_id: string; quantite: string }) => ({
        reference: itemById.get(row.stock_item_id)?.reference ?? row.stock_item_id,
        designation: itemById.get(row.stock_item_id)?.designation ?? '-',
        quantity: Number(row.quantite),
        unit: itemById.get(row.stock_item_id)?.unit ?? '',
      }),
    );

    const validees = await this.missionRepository
      .createQueryBuilder('m')
      .where("m.company_id = :cid AND m.status = 'validee' AND m.type_tache = 'INSTALLATION' AND m.date_mission BETWEEN :s AND :e", {
        cid: companyId, s: new Date(startDate), e: new Date(`${endDate}T23:59:59.999Z`),
      })
      .getCount();
    const totalConsumed = consumption.reduce((s, c) => s + c.quantity, 0);

    const vehicles = await this.vehicleRepository.find({ where: { companyId } });
    const expenses = await this.expenseRepository.find({
      where: { companyId, category: 'transport' },
    });
    const vehicleCosts = vehicles.map((v) => {
      const cost = expenses
        .filter((e) => e.vehicleId === v.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      return {
        vehicleId: v.id,
        immatriculation: v.immatriculation,
        modele: v.modele,
        kilometrage: v.kilometrage,
        coutTransport: round2(cost),
      };
    });

    return {
      report: 'stock-vehicles' as const,
      period: { startDate, endDate },
      consumption,
      totalConsumed,
      installationsValidees: validees,
      installationRatio: validees > 0 ? round2(totalConsumed / validees) : null,
      vehicleCosts,
      coutTransportTotal: round2(vehicleCosts.reduce((s, v) => s + v.coutTransport, 0)),
    };
  }

  // ---------- Rapport 4 : KPI SONATEL (mois + historique 12 mois) ----------

  async getKpiReport(companyId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('Format de mois attendu : YYYY-MM');
    }
    const base = await this.kpiService.generateReport(companyId, month);
    const history = await this.kpiService.history(companyId);

    const [y, m] = month.split('-').map(Number);
    const last12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      return d.toISOString().slice(0, 7);
    });
    const byMonth = new Map(history.months.map((h) => [h.month, h] as const));
    const history12 = last12
      .map((mm) => byMonth.get(mm) ?? null)
      .filter((h): h is NonNullable<typeof h> => h !== null && h.kpis.length > 0)
      .reverse();

    const details = base.details as unknown as Array<Record<string, unknown>>;
    const withFeux: Array<Record<string, unknown>> = details.map((d) => {
      const status = String(d.status);
      const gap = Math.abs(Number(d.target) - Number(d.actual));
      const feu = status === 'atteint' ? 'vert' : gap > 5 ? 'rouge' : 'orange';
      return { ...d, feu };
    });
    const nonAtteints = withFeux.filter((d) => d.status === 'non_atteint');

    return {
      report: 'kpi' as const,
      month,
      summary: base.summary,
      details: withFeux,
      nonAtteints,
      history: history12,
      penalties: {
        total: base.summary.penaltiesTotal,
        byKpi: nonAtteints.map((d) => ({ kpiName: d.kpiName, penaltyAmount: Number(d.penaltyAmount) })),
      },
      bonus: base.bonus,
    };
  }


  // ---------- Rapport 6 : planning (missions planifiées du mois) ----------

  async getPlanningReport(companyId: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('Format de mois attendu : YYYY-MM');
    }
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const missions = await this.missionRepository
      .createQueryBuilder('mi')
      .where('mi.company_id = :cid AND mi.date_mission BETWEEN :s AND :e', {
        cid: companyId,
        s: new Date(`${start}T00:00:00Z`),
        e: new Date(`${end}T23:59:59Z`),
      })
      .orderBy('mi.date_mission', 'ASC')
      .getMany();

    const byDay = new Map<string, number>();
    const byTeam = new Map<string, number>();
    for (const mi of missions) {
      const day = new Date(mi.dateMission).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const team = mi.importMeta?.teamLabel ?? mi.team?.name ?? 'Non affectée';
      byTeam.set(team, (byTeam.get(team) ?? 0) + 1);
    }
    return {
      report: 'planning' as const,
      month,
      total: missions.length,
      missions: missions.map((mi) => ({
        date: new Date(mi.dateMission).toISOString().slice(0, 10),
        dossier: mi.sonatelDossierNumber ?? '—',
        client: mi.clientSite,
        type: mi.typeTache,
        zone: mi.zone ?? '—',
        equipe: mi.importMeta?.teamLabel ?? mi.team?.name ?? '—',
        statut: mi.status,
      })),
      byDay: [...byDay.entries()].map(([day, count]) => ({ Jour: day, Missions: count })),
      byTeam: [...byTeam.entries()].map(([Equipe, Missions]) => ({ Equipe, Missions })),
    };
  }

  // ---------- Rapport 5 : incidents (PIO/PBO/Chambre — table Phase 16) ----------

  async getIncidentsReport(companyId: string, startDate: string, endDate: string) {
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await this.dataSource.query(
        `SELECT rubrique, zone, status, reported_at, resolved_at, severity
         FROM incidents
         WHERE company_id = $1 AND reported_at BETWEEN $2 AND $3`,
        [companyId, new Date(startDate), new Date(`${endDate}T23:59:59.999Z`)],
      );
    } catch {
      // Table incidents absente : le module Incidents (Phase 16) la crée.
      return {
        report: 'incidents' as const,
        period: { startDate, endDate },
        byRubrique: [], byStatus: [], byZone: [], tendance: [],
        averageResolutionTimeHours: null,
        note: 'Module Incidents non encore déployé (Phase 16)',
      };
    }

    const count = (key: string) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + 1);
      return [...m.entries()].map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count);
    };

    const resolved = rows.filter((r) => r.resolved_at);
    const avgHours =
      resolved.length > 0
        ? round2(
            resolved.reduce((s, r) => {
              const hours = (new Date(String(r.resolved_at)).getTime() - new Date(String(r.reported_at)).getTime()) / 3600000;
              return s + hours;
            }, 0) / resolved.length,
          )
        : null;

    const trend = new Map<string, number>();
    for (const r of rows) {
      const month = new Date(String(r.reported_at)).toISOString().slice(0, 7);
      trend.set(month, (trend.get(month) ?? 0) + 1);
    }

    return {
      report: 'incidents' as const,
      period: { startDate, endDate },
      byRubrique: count('rubrique'),
      byStatus: count('status'),
      byZone: count('zone'),
      tendance: [...trend.entries()].sort().map(([month, c]) => ({ month, count: c })),
      total: rows.length,
      averageResolutionTimeHours: avgHours,
      note: rows.length === 0 ? 'Aucun incident sur la période' : null,
    };
  }

  /** Tableau de sections (feuilles Excel / blocs PDF) pour un rapport donné. */
  async toSections(companyId: string, report: ReportId, params: { startDate?: string; endDate?: string; month?: string }): Promise<ReportSection[]> {
    const startDate = params.startDate ?? `${(params.month ?? new Date().toISOString().slice(0, 7))}-01`;
    const endDate = params.endDate ?? startDate;
    switch (report) {
      case 'performance': {
        const d = await this.getPerformanceReport(companyId, startDate, endDate);
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'Missions totales', Valeur: d.totalMissions },
              { Indicateur: 'Missions clôturées', Valeur: d.closedMissions },
              { Indicateur: 'OK', Valeur: d.ok },
              { Indicateur: 'NOK', Valeur: d.nok },
              { Indicateur: 'Taux OK (%)', Valeur: d.okRate },
              { Indicateur: 'Taux NOK (%)', Valeur: d.nokRate },
            ],
          },
          { name: 'Par technicien', rows: d.byTechnician as unknown as Array<Record<string, string | number>> },
          { name: 'Motifs NOK', rows: d.topFailureReasons as unknown as Array<Record<string, string | number>> },
        ];
      }
      case 'olt': {
        const d = await this.getOltReport(companyId, startDate, endDate);
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'Dossiers reçus', Valeur: d.total },
              { Indicateur: 'Exécutés', Valeur: d.executees },
              { Indicateur: 'En attente', Valeur: d.enAttente },
              { Indicateur: 'Taux réussite (%)', Valeur: d.successRate ?? 'n/a' },
            ],
          },
          { name: 'Par zone OLT', rows: d.byZone as unknown as Array<Record<string, string | number>> },
        ];
      }
      case 'stock-vehicles': {
        const d = await this.getStockVehiclesReport(companyId, startDate, endDate);
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'Matériel consommé (unités)', Valeur: d.totalConsumed },
              { Indicateur: 'Installations validées', Valeur: d.installationsValidees },
              { Indicateur: 'Ratio consommation/installation', Valeur: d.installationRatio ?? 'n/a' },
              { Indicateur: 'Coût transport total (FCFA)', Valeur: d.coutTransportTotal },
            ],
          },
          { name: 'Consommation', rows: d.consumption as unknown as Array<Record<string, string | number>> },
          { name: 'Vehicules', rows: d.vehicleCosts as unknown as Array<Record<string, string | number>> },
        ];
      }
      case 'kpi': {
        const d = await this.getKpiReport(companyId, params.month ?? new Date().toISOString().slice(0, 7));
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'KPI atteints', Valeur: d.summary.atteints },
              { Indicateur: 'KPI non atteints', Valeur: d.summary.nonAtteints },
              { Indicateur: 'Pénalités (FCFA)', Valeur: d.summary.penaltiesTotal },
              { Indicateur: 'Bonus éligible', Valeur: d.bonus.eligible ? 'oui' : 'non' },
              { Indicateur: 'Bonus (FCFA)', Valeur: d.bonus.amount },
            ],
          },
          { name: 'Detail KPI', rows: (d.details as unknown as Array<Record<string, unknown>>).map((k) => ({
            KPI: String(k.kpiName ?? ''), Cible: Number(k.target), Reel: Number(k.actual),
            Statut: String(k.status ?? ''), Feu: String(k.feu ?? ''), Penalite: Number(k.penaltyAmount),
          })) },
          { name: 'Historique', rows: d.history.map((h) => ({ Mois: h.month, Atteints: h.atteints, NonAtteints: h.nonAtteints, Penalites: h.penaltiesTotal })) },
        ];
      }
      case 'incidents': {
        const d = await this.getIncidentsReport(companyId, startDate, endDate);
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'Incidents', Valeur: d.total ?? 0 },
              { Indicateur: 'Délai moyen de correction (h)', Valeur: d.averageResolutionTimeHours ?? 'n/a' },
            ],
          },
          { name: 'Par rubrique', rows: d.byRubrique.map((r) => ({ Rubrique: r.key, Nombre: r.count })) },
          { name: 'Par zone', rows: d.byZone.map((r) => ({ Zone: r.key, Nombre: r.count })) },
          { name: 'Par statut', rows: d.byStatus.map((r) => ({ Statut: r.key, Nombre: r.count })) },
        ];
      }
      case 'planning': {
        const month = params.month ?? new Date().toISOString().slice(0, 7);
        const d = await this.getPlanningReport(companyId, month);
        return [
          {
            name: 'Synthese',
            rows: [
              { Indicateur: 'Mois', Valeur: d.month },
              { Indicateur: 'Missions planifiées', Valeur: d.total },
            ],
          },
          { name: 'Par jour', rows: d.byDay },
          { name: 'Par équipe', rows: d.byTeam },
          {
            name: 'Détail missions',
            rows: d.missions as unknown as Array<Record<string, string | number>>,
          },
        ];
      }
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
