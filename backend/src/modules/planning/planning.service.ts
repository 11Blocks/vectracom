import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity';

/** Consultation du planning : missions du tenant par période/statut. */
@Injectable()
export class PlanningService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
  ) {}

  async listMissions(
    companyId: string,
    filters: { from?: Date; to?: Date; status?: string },
  ) {
    const qb = this.missionRepository
      .createQueryBuilder('mission')
      .where('mission.company_id = :companyId', { companyId })
      .orderBy('mission.date_mission', filters.from || filters.to ? 'ASC' : 'DESC')
      .take(2000);

    if (filters.from) qb.andWhere('mission.date_mission >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('mission.date_mission <= :to', { to: filters.to });
    if (filters.status) qb.andWhere('mission.status = :status', { status: filters.status });

    return qb.getMany();
  }
}
