import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Technician, ContractType } from './entities/technician.entity';
import { Team } from '../teams/entities/team.entity';
import { Mission } from '../missions/entities/mission.entity';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
  ) {}

  async create(companyId: string, dto: CreateTechnicianDto): Promise<Technician> {
    const team = await this.teamRepository.findOne({ where: { companyId, id: dto.teamId } });
    if (!team) throw new BadRequestException('Équipe inconnue pour ce tenant');

    if (dto.teamLeaderId) {
      await this.assertSameCompany(companyId, dto.teamLeaderId);
    }

    const technician = this.technicianRepository.create({
      companyId,
      teamId: dto.teamId,
      userId: dto.userId ?? null,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() ?? null,
      isTeamLeader: dto.isTeamLeader ?? false,
      teamLeaderId: dto.teamLeaderId ?? null,
      habilitationSstExpiration: dto.habilitationSstExpiration?.slice(0, 10) ?? null,
      habilitationConduiteExpiration: dto.habilitationConduiteExpiration?.slice(0, 10) ?? null,
      experienceYears: dto.experienceYears ?? null,
      contractType: (dto.contractType as ContractType) ?? null,
      competences: dto.competences ?? [],
      documents: (dto.documents as unknown as Technician["documents"]) ?? [],
    });
    return this.technicianRepository.save(technician);
  }

  async list(
    companyId: string,
    filters: { teamId?: string; competence?: string; leadersOnly?: boolean; active?: boolean },
  ) {
    const qb = this.technicianRepository
      .createQueryBuilder('tech')
      .leftJoinAndSelect('tech.team', 'team')
      .where('tech.company_id = :companyId', { companyId })
      .orderBy('tech.full_name', 'ASC');

    if (filters.teamId) qb.andWhere('tech.team_id = :teamId', { teamId: filters.teamId });
    if (filters.leadersOnly) qb.andWhere('tech.is_team_leader = true');
    if (filters.active !== undefined) qb.andWhere('tech.active = :active', { active: filters.active });
    if (filters.competence) {
      qb.andWhere(`tech.competences @> :competence::jsonb`, { competence: JSON.stringify([filters.competence]) });
    }
    return qb.getMany();
  }

  async findOne(companyId: string, id: string): Promise<Technician> {
    const technician = await this.technicianRepository.findOne({
      where: { companyId, id },
      relations: ['team', 'teamLeader'],
    });
    if (!technician) throw new NotFoundException('Technicien introuvable');
    return technician;
  }

  async byTeam(companyId: string, teamId: string): Promise<Technician[]> {
    await this.teamRepository.findOne({ where: { companyId, id: teamId } }).then((t) => {
      if (!t) throw new NotFoundException('Équipe introuvable');
    });
    return this.technicianRepository.find({
      where: { companyId, teamId },
      order: { isTeamLeader: 'DESC', fullName: 'ASC' },
    });
  }

  async update(companyId: string, id: string, dto: UpdateTechnicianDto): Promise<Technician> {
    const technician = await this.findOne(companyId, id);

    if (dto.teamId && dto.teamId !== technician.teamId) {
      const team = await this.teamRepository.findOne({ where: { companyId, id: dto.teamId } });
      if (!team) throw new BadRequestException('Équipe inconnue pour ce tenant');
    }
    if (dto.teamLeaderId) {
      if (dto.teamLeaderId === id) {
        throw new BadRequestException('Un technicien ne peut pas être son propre binôme');
      }
      await this.assertSameCompany(companyId, dto.teamLeaderId);
    }

    Object.assign(technician, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
      ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
      ...(dto.isTeamLeader !== undefined ? { isTeamLeader: dto.isTeamLeader } : {}),
      ...(dto.teamLeaderId !== undefined ? { teamLeaderId: dto.teamLeaderId } : {}),
      ...(dto.habilitationSstExpiration !== undefined
        ? { habilitationSstExpiration: dto.habilitationSstExpiration?.slice(0, 10) ?? null }
        : {}),
      ...(dto.habilitationConduiteExpiration !== undefined
        ? { habilitationConduiteExpiration: dto.habilitationConduiteExpiration?.slice(0, 10) ?? null }
        : {}),
      ...(dto.experienceYears !== undefined ? { experienceYears: dto.experienceYears } : {}),
      ...(dto.contractType !== undefined ? { contractType: dto.contractType as ContractType } : {}),
      ...(dto.competences !== undefined ? { competences: dto.competences } : {}),
      ...(dto.documents !== undefined ? { documents: dto.documents as unknown as Technician['documents'] } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    return this.technicianRepository.save(technician);
  }

  /**
   * Suppression : le technicien est retiré des missions qui le référencent
   * (technician_ids est un tableau sans FK), les binômes sont détachés.
   */
  async remove(companyId: string, id: string) {
    const technician = await this.findOne(companyId, id);
    const binomes = await this.technicianRepository.find({ where: { companyId, teamLeaderId: id } });
    for (const binome of binomes) {
      binome.teamLeaderId = null;
      await this.technicianRepository.save(binome);
    }
    await this.missionRepository.query(
      `UPDATE missions SET technician_ids = array_remove(technician_ids, $1) WHERE company_id = $2`,
      [id, companyId],
    );
    await this.technicianRepository.remove(technician);
    return { deleted: true, detachedBinomes: binomes.length };
  }

  private async assertSameCompany(companyId: string, technicianId: string) {
    const leader = await this.technicianRepository.findOne({
      where: { companyId, id: technicianId },
    });
    if (!leader) throw new BadRequestException('Technicien de référence introuvable pour ce tenant');
  }
}
