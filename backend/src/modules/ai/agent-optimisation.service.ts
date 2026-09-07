import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity';
import { Team } from '../teams/entities/team.entity';

/**
 * Agent Optimisation : regroupe les missions du jour par zone (tournées) et
 * propose un ordre + une répartition par équipe. Propositions uniquement.
 */
@Injectable()
export class AgentOptimisationService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  async optimizeTour(companyId: string, date: string) {
    const day = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId AND m.date_mission BETWEEN :s AND :e', { companyId, s: new Date(day), e: new Date(dayEnd) })
      .andWhere('m.status IN (:...st)', { st: ['planifiee', 'en_cours'] })
      .getMany();

    const byZone = new Map<string, Mission[]>();
    for (const mission of missions) {
      const zone = (mission.zone ?? 'non renseignée').toLowerCase();
      byZone.set(zone, [...(byZone.get(zone) ?? []), mission]);
    }

    const tours = [...byZone.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([zone, zoneMissions], index) => ({
        ordre: index + 1,
        zone,
        missions: zoneMissions.map((m) => ({ id: m.id, clientSite: m.clientSite, type: m.typeTache })),
        distanceEstimeeKm: zoneMissions.length * 4,
        gain: `Regroupement ${zoneMissions.length} mission(s) — déplacements mutualisés`,
      }));

    return {
      date,
      missionsTotal: missions.length,
      tours,
      gainEstime: `${missions.length - tours.length} trajet(s) inter-zones évité(s)`,
      autoExecute: false,
    };
  }

  async suggestSchedule(companyId: string, date: string) {
    const teams = await this.teamRepository.find({ where: { companyId, active: true } });
    const tours = await this.optimizeTour(companyId, date);
    const assignments = tours.tours.map((tour, i) => ({
      teamId: teams[i % Math.max(teams.length, 1)]?.id ?? null,
      teamName: teams[i % Math.max(teams.length, 1)]?.name ?? 'à assigner',
      zone: tour.zone,
      missionIds: tour.missions.map((m) => m.id),
    }));
    return { date, assignments, autoExecute: false, note: 'Planning proposé — validation par le planificateur' };
  }
}
