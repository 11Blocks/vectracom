import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team, TeamType } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Technician } from '../technicians/entities/technician.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
  ) {}

  async create(companyId: string, dto: CreateTeamDto): Promise<Team> {
    const existing = await this.teamRepository.findOne({
      where: { companyId, name: dto.name.trim() },
    });
    if (existing) throw new ConflictException(`L'équipe « ${dto.name} » existe déjà`);

    const team = this.teamRepository.create({
      companyId,
      name: dto.name.trim(),
      type: dto.type as TeamType,
      zone: dto.zone?.trim() ?? null,
    });
    return this.teamRepository.save(team);
  }

  async list(companyId: string, filters: { type?: string; zone?: string; active?: boolean }) {
    const qb = this.teamRepository
      .createQueryBuilder('team')
      .where('team.company_id = :companyId', { companyId })
      .orderBy('team.name', 'ASC');
    if (filters.type) qb.andWhere('team.type = :type', { type: filters.type });
    if (filters.zone) qb.andWhere('team.zone ILIKE :zone', { zone: `%${filters.zone}%` });
    if (filters.active !== undefined) qb.andWhere('team.active = :active', { active: filters.active });
    return qb.getMany();
  }

  async findOne(companyId: string, id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({ where: { companyId, id } });
    if (!team) throw new NotFoundException('Équipe introuvable');
    return team;
  }

  async update(companyId: string, id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(companyId, id);
    if (dto.name && dto.name !== team.name) {
      const existing = await this.teamRepository.findOne({
        where: { companyId, name: dto.name.trim() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`L'équipe « ${dto.name} » existe déjà`);
      }
    }
    Object.assign(team, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type as TeamType } : {}),
      ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    return this.teamRepository.save(team);
  }

  /**
   * Suppression : refusée si l'équipe a encore des techniciens (FK RESTRICT
   * côté base). Retirer d'abord les techniciens, ou désactiver l'équipe.
   */
  async remove(companyId: string, id: string) {
    const team = await this.findOne(companyId, id);
    const techCount = await this.technicianRepository.count({ where: { companyId, teamId: id } });
    if (techCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${techCount} technicien(s) rattaché(s). Retirez-les d'abord ou désactivez l'équipe (active=false).`,
      );
    }
    await this.teamRepository.remove(team);
    return { deleted: true };
  }
}
