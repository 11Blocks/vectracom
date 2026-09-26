import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DashboardSummary {
  days: number;
  activity: Array<{ day: string; missions: number; incidents: number | null }>;
  kpis: {
    todayMissions: number;
    lateMissions: number;
    pendingValidation: number;
    openCriticalIncidents: number | null;
  };
  lastMissionDate: string | null;
  lastIncidentDate: string | null;
}

/** Agrégats du tableau de bord tenant, calculés en SQL (pas de plafond de liste). */
@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async summary(companyId: string, days: number, withIncidents: boolean): Promise<DashboardSummary> {
    const activity: Array<{ day: string; missions: number; incidents: number | null }> = (
      await this.db.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                (SELECT count(*) FROM missions m
                  WHERE m.company_id = $1 AND m.date_mission >= d AND m.date_mission < d + interval '1 day')::int AS missions,
                CASE WHEN $3 THEN (SELECT count(*) FROM incidents i
                  WHERE i.company_id = $1 AND i.reported_at >= d AND i.reported_at < d + interval '1 day')::int END AS incidents
           FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') AS d
          ORDER BY d`,
        [companyId, days, withIncidents],
      )
    ).map((r: { day: string; missions: number; incidents: number | null }) => ({
      day: r.day,
      missions: Number(r.missions),
      incidents: r.incidents === null ? null : Number(r.incidents),
    }));

    const [m] = await this.db.query(
      `SELECT count(*) FILTER (WHERE date_mission >= current_date AND date_mission < current_date + 1)::int AS today,
              count(*) FILTER (WHERE status = 'planifiee' AND date_mission < current_date)::int AS late,
              count(*) FILTER (WHERE status = 'terminee')::int AS pending,
              max(date_mission) FILTER (WHERE date_mission < current_date + 1) AS last
         FROM missions WHERE company_id = $1`,
      [companyId],
    );

    let openCritical: number | null = null;
    let lastIncident: Date | null = null;
    if (withIncidents) {
      const [i] = await this.db.query(
        `SELECT count(*) FILTER (WHERE severity IN ('CRITICAL', 'MAJEUR') AND status NOT IN ('corrige', 'cloture'))::int AS critical,
                max(reported_at) AS last
           FROM incidents WHERE company_id = $1`,
        [companyId],
      );
      openCritical = Number(i.critical);
      lastIncident = i.last;
    }

    return {
      days,
      activity,
      kpis: {
        todayMissions: Number(m.today),
        lateMissions: Number(m.late),
        pendingValidation: Number(m.pending),
        openCriticalIncidents: openCritical,
      },
      lastMissionDate: m.last ? new Date(m.last).toISOString() : null,
      lastIncidentDate: lastIncident ? new Date(lastIncident).toISOString() : null,
    };
  }
}
