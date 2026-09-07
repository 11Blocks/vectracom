import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Mission, MissionStatus } from './entities/mission.entity';
import { Team } from '../teams/entities/team.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto';
import { ReassignMissionDto } from './dto/reassign-mission.dto';

/** Transitions autorisées du cycle de vie mission. */
const STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  planifiee: ['en_cours', 'a_completer'],
  en_cours: ['terminee', 'a_completer', 'planifiee'],
  terminee: ['validee', 'rejetee', 'a_completer'],
  a_completer: ['en_cours', 'planifiee'],
  validee: [],
  rejetee: ['a_completer'],
};

/** Statuts réservés aux validations back-office (pas au chef d'équipe). */
const BACK_OFFICE_STATUSES: MissionStatus[] = ['validee', 'rejetee'];

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  async create(companyId: string, dto: CreateMissionDto): Promise<Mission> {
    if (dto.sonatelDossierNumber) {
      const existing = await this.missionRepository.findOne({
        where: { companyId, sonatelDossierNumber: dto.sonatelDossierNumber },
      });
      if (existing) {
        throw new BadRequestException(
          `Une mission existe déjà pour le dossier ${dto.sonatelDossierNumber}`,
        );
      }
    }
    const mission = this.missionRepository.create({
      companyId,
      clientSite: dto.clientSite,
      typeTache: dto.typeTache,
      zone: dto.zone ?? null,
      teamId: dto.teamId ?? null,
      technicianIds: dto.technicianIds ?? [],
      vehicleId: dto.vehicleId ?? null,
      dateMission: new Date(dto.dateMission),
      status: 'planifiee',
      sonatelDossierNumber: dto.sonatelDossierNumber ?? null,
      sonatelProduit: dto.sonatelProduit ?? null,
      sonatelOlt: dto.sonatelOlt ?? null,
      partnerId: dto.partnerId ?? null,
      srPlaque: dto.srPlaque ?? null,
      segment: dto.segment ?? null,
      contactClient: dto.contactClient ?? null,
      coper: dto.coper ?? null,
      vaCap: dto.vaCap ?? null,
      piloteSonatel: dto.piloteSonatel ?? null,
      codeOperation: dto.codeOperation ?? null,
    });
    return this.missionRepository.save(mission);
  }

  async list(
    companyId: string,
    filters: {
      teamId?: string;
      technicianId?: string;
      from?: string;
      to?: string;
      status?: string;
      typeTache?: string;
    },
  ) {
    const qb = this.missionRepository
      .createQueryBuilder('mission')
      .where('mission.company_id = :companyId', { companyId })
      .orderBy('mission.date_mission', 'DESC')
      .take(500);

    if (filters.teamId) qb.andWhere('mission.team_id = :teamId', { teamId: filters.teamId });
    if (filters.technicianId) qb.andWhere(':techId = ANY(mission.technician_ids)', { techId: filters.technicianId });
    if (filters.from) qb.andWhere('mission.date_mission >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('mission.date_mission <= :to', { to: filters.to });
    if (filters.status) qb.andWhere('mission.status = :status', { status: filters.status });
    if (filters.typeTache) qb.andWhere('mission.type_tache = :type', { type: filters.typeTache });

    return qb.getMany();
  }

  async findOne(companyId: string, id: string): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { companyId, id },
      relations: ['fieldReport'],
    });
    if (!mission) throw new NotFoundException('Mission introuvable');
    return mission;
  }

  async findManyForExport(companyId: string, ids: string[]): Promise<Mission[]> {
    if (ids.length === 0) return [];
    return this.missionRepository.find({ where: { companyId, id: In(ids) } });
  }

  /**
   * Changement de statut avec contrôle des transitions.
   * chef_equipe : progression terrain uniquement (pas validee/rejetee).
   */
  async setStatus(companyId: string, id: string, dto: UpdateMissionStatusDto, role: string) {
    const mission = await this.findOne(companyId, id);
    const target = dto.status as MissionStatus;

    if (BACK_OFFICE_STATUSES.includes(target) && role === 'chef_equipe') {
      throw new BadRequestException('Validation/rejet réservés au back-office (admin/direction)');
    }
    if (target === 'rejetee' && !dto.rejectionReason) {
      throw new BadRequestException('Motif de rejet obligatoire (rejectionReason)');
    }
    const allowed = STATUS_TRANSITIONS[mission.status] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition interdite : ${mission.status} → ${target} (autorisées : ${allowed.join(', ') || 'aucune'})`,
      );
    }

    mission.status = target;
    await this.missionRepository.save(mission);
    return mission;
  }

  async getByDossier(companyId: string, dossierNumber: string): Promise<Mission | null> {
    return this.missionRepository.findOne({
      where: { companyId, sonatelDossierNumber: dossierNumber },
    });
  }

  /**
   * Réaffectation (équipe / binôme / véhicule / créneau).
   * Règles : mission non terminée, équipe active, pas de double affectation
   * d'une même équipe ni d'un même véhicule sur le même créneau jour.
   */
  async reassign(companyId: string, id: string, dto: ReassignMissionDto): Promise<Mission> {
    const mission = await this.findOne(companyId, id);
    if (['terminee', 'validee', 'rejetee'].includes(mission.status)) {
      throw new BadRequestException(`Réaffectation impossible depuis le statut ${mission.status}`);
    }

    if (dto.teamId !== undefined && dto.teamId) {
      const team = await this.teamRepository.findOne({ where: { companyId, id: dto.teamId } });
      if (!team) throw new NotFoundException('Équipe introuvable');
      if (!team.active) throw new BadRequestException(`L'équipe « ${team.name} » est désactivée — elle ne peut pas recevoir de mission`);
    }
    if (dto.vehicleId !== undefined && dto.vehicleId) {
      const vehicle = await this.vehicleRepository.findOne({ where: { companyId, id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Véhicule introuvable');
    }

    const newTeamId = dto.teamId !== undefined ? dto.teamId : mission.teamId;
    const newVehicleId = dto.vehicleId !== undefined ? dto.vehicleId : mission.vehicleId;
    const newDate = dto.dateMission ? new Date(dto.dateMission) : mission.dateMission;
    const dayStart = new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth(), newDate.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    if (newTeamId) {
      const clash = await this.missionRepository
        .createQueryBuilder('m')
        .where('m.company_id = :cid AND m.team_id = :tid AND m.id != :mid', { cid: companyId, tid: newTeamId, mid: id })
        .andWhere('m.date_mission >= :ds AND m.date_mission < :de', { ds: dayStart, de: dayEnd })
        .andWhere("m.status IN ('planifiee','en_cours','a_completer')")
        .getOne();
      if (clash) {
        throw new BadRequestException(`Double affectation refusée : l'équipe est déjà engagée sur « ${clash.clientSite} » ce jour-là`);
      }
    }
    if (newVehicleId) {
      const clash = await this.missionRepository
        .createQueryBuilder('m')
        .where('m.company_id = :cid AND m.vehicle_id = :vid AND m.id != :mid', { cid: companyId, vid: newVehicleId, mid: id })
        .andWhere('m.date_mission >= :ds AND m.date_mission < :de', { ds: dayStart, de: dayEnd })
        .andWhere("m.status IN ('planifiee','en_cours','a_completer')")
        .getOne();
      if (clash) {
        throw new BadRequestException(`Double affectation refusée : le véhicule est déjà engagé sur « ${clash.clientSite} » ce jour-là`);
      }
    }

    if (dto.teamId !== undefined) mission.teamId = dto.teamId;
    if (dto.technicianIds !== undefined) mission.technicianIds = dto.technicianIds;
    if (dto.vehicleId !== undefined) mission.vehicleId = dto.vehicleId;
    if (dto.dateMission) mission.dateMission = newDate;
    return this.missionRepository.save(mission);
  }

  async updateDetails(
    companyId: string,
    id: string,
    dto: import('./dto/update-mission-details.dto').UpdateMissionDetailsDto,
  ): Promise<Mission> {
    const mission = await this.findOne(companyId, id);
    if (dto.clientSite !== undefined) mission.clientSite = dto.clientSite;
    if (dto.zone !== undefined) mission.zone = dto.zone;
    if (dto.dateMission !== undefined) mission.dateMission = new Date(dto.dateMission);
    if (dto.partnerId !== undefined) mission.partnerId = dto.partnerId;
    if (dto.sonatelDossierNumber !== undefined) mission.sonatelDossierNumber = dto.sonatelDossierNumber;
    if (dto.sonatelProduit !== undefined) mission.sonatelProduit = dto.sonatelProduit;
    if (dto.sonatelOlt !== undefined) mission.sonatelOlt = dto.sonatelOlt;
    if (dto.srPlaque !== undefined) mission.srPlaque = dto.srPlaque;
    if (dto.segment !== undefined) mission.segment = dto.segment;
    if (dto.contactClient !== undefined) mission.contactClient = dto.contactClient;
    if (dto.coper !== undefined) mission.coper = dto.coper;
    if (dto.vaCap !== undefined) mission.vaCap = dto.vaCap;
    if (dto.piloteSonatel !== undefined) mission.piloteSonatel = dto.piloteSonatel;
    if (dto.codeOperation !== undefined) mission.codeOperation = dto.codeOperation;
    return this.missionRepository.save(mission);
  }

  async remove(companyId: string, id: string) {
    const mission = await this.findOne(companyId, id);
    if (['validee'].includes(mission.status)) {
      throw new BadRequestException('Mission validée — suppression interdite');
    }
    await this.missionRepository.remove(mission);
    return { deleted: true };
  }

}
