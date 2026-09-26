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
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../../common/audit/audit.service';

/** Transitions autorisées du cycle de vie mission. */
const STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  planifiee: ['en_cours', 'a_completer', 'annulee'],
  en_cours: ['terminee', 'a_completer', 'planifiee', 'annulee'],
  terminee: ['validee', 'rejetee', 'a_completer'],
  a_completer: ['en_cours', 'planifiee', 'annulee'],
  // Dé-validation (admin, mission non facturée) : retour en contrôle.
  validee: ['terminee'],
  rejetee: ['a_completer'],
  // Réouverture d'une mission annulée.
  annulee: ['planifiee'],
};

/** Statuts réservés aux validations back-office (pas au chef d'équipe). */
const BACK_OFFICE_STATUSES: MissionStatus[] = ['validee', 'rejetee', 'annulee'];
const ACTIVE_STATUSES = "('planifiee','en_cours','a_completer')";

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
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
    await this.assertLinks(companyId, dto);
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
      search?: string;
      invoiced?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const qb = this.missionRepository
      .createQueryBuilder('mission')
      .leftJoinAndSelect('mission.team', 'team')
      .where('mission.company_id = :companyId', { companyId })
      .orderBy('mission.dateMission', 'DESC')
      .addOrderBy('mission.createdAt', 'DESC')
      .take(Math.min(filters.limit ?? 2000, 5000))
      .skip(filters.offset ?? 0);

    if (filters.teamId) qb.andWhere('mission.team_id = :teamId', { teamId: filters.teamId });
    if (filters.technicianId) qb.andWhere(':techId = ANY(mission.technician_ids)', { techId: filters.technicianId });
    if (filters.from) qb.andWhere('mission.date_mission >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('mission.date_mission <= :to', { to: filters.to });
    if (filters.status) qb.andWhere('mission.status = :status', { status: filters.status });
    if (filters.typeTache) qb.andWhere('mission.type_tache = :type', { type: filters.typeTache });
    if (filters.search?.trim()) {
      qb.andWhere(
        '(mission.client_site ILIKE :q OR mission.sonatel_dossier_number ILIKE :q OR mission.zone ILIKE :q OR team.name ILIKE :q)',
        { q: `%${filters.search.trim()}%` },
      );
    }
    if (filters.invoiced === 'true') qb.andWhere('mission.invoice_id IS NOT NULL');
    if (filters.invoiced === 'false') qb.andWhere('mission.invoice_id IS NULL');

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
  async setStatus(companyId: string, id: string, dto: UpdateMissionStatusDto, role: string, userId: string | null = null) {
    const mission = await this.findOne(companyId, id);
    const target = dto.status as MissionStatus;
    const from = mission.status;
    const reason = dto.rejectionReason?.trim();

    if (BACK_OFFICE_STATUSES.includes(target) && !['admin', 'direction', 'super_admin'].includes(role)) {
      throw new BadRequestException('Validation, rejet et annulation réservés au back-office (admin/direction)');
    }
    if (mission.invoiceId) {
      throw new BadRequestException('Mission déjà facturée — annulez la facture (avoir) avant de modifier son statut');
    }
    if ((target === 'rejetee' || target === 'annulee') && !reason) {
      throw new BadRequestException(target === 'rejetee' ? 'Motif de rejet obligatoire (rejectionReason)' : 'Motif d’annulation obligatoire (rejectionReason)');
    }
    if (from === 'validee' && target === 'terminee') {
      if (role !== 'admin' && role !== 'super_admin') throw new BadRequestException('Dé-validation réservée à l’administrateur');
      if (!reason) throw new BadRequestException('Motif de dé-validation obligatoire (rejectionReason)');
    }
    const allowed = STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition interdite : ${from} → ${target} (autorisées : ${allowed.join(', ') || 'aucune'})`,
      );
    }

    mission.status = target;
    if (target === 'rejetee') {
      mission.rejectionReason = reason!;
      mission.rejectedAt = new Date();
    } else if (target === 'validee') {
      mission.rejectionReason = null;
    } else if (target === 'annulee') {
      mission.cancelReason = reason!;
      mission.cancelledAt = new Date();
    } else if (from === 'annulee') {
      mission.cancelReason = null;
      mission.cancelledAt = null;
    }
    await this.missionRepository.save(mission);
    // La validation interne du rapport suit le statut de la mission.
    if (target === 'validee' || target === 'rejetee' || (from === 'validee' && target === 'terminee')) {
      await this.missionRepository.query(
        `UPDATE mission_field_reports SET internal_validation_status = $3, updated_at = now()
          WHERE company_id = $1 AND mission_id = $2`,
        [companyId, id, target === 'terminee' ? 'en_attente' : target],
      );
    }
    await this.audit.log({
      companyId, actorId: userId, action: 'mission.status', entityType: 'mission', entityId: id,
      payload: { from, to: target, ...(reason ? { reason } : {}) },
    });
    return mission;
  }

  /**
   * Changement de statut en masse (validation, rejet, annulation) : chaque
   * mission est traitée indépendamment, les refus sont renvoyés un par un.
   */
  async bulkStatus(
    companyId: string,
    ids: string[],
    apply: (id: string) => Promise<unknown>,
  ): Promise<{ ok: number; failed: Array<{ id: string; clientSite: string | null; error: string }> }> {
    const missions = await this.missionRepository.find({ where: { companyId, id: In(ids) }, select: ['id', 'clientSite'] });
    const known = new Map(missions.map((m) => [m.id, m.clientSite]));
    const failed: Array<{ id: string; clientSite: string | null; error: string }> = [];
    let ok = 0;
    for (const id of ids) {
      if (!known.has(id)) {
        failed.push({ id, clientSite: null, error: 'Mission introuvable' });
        continue;
      }
      try {
        await apply(id);
        ok++;
      } catch (err) {
        failed.push({ id, clientSite: known.get(id) ?? null, error: (err as Error).message });
      }
    }
    return { ok, failed };
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
    if (['terminee', 'validee', 'rejetee', 'annulee'].includes(mission.status)) {
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

    // Une équipe enchaîne plusieurs missions par jour : on contrôle sa capacité
    // journalière (Paramètres → Missions), pas une mission unique.
    const teamChanged = newTeamId !== mission.teamId || newDate.getTime() !== new Date(mission.dateMission).getTime();
    if (newTeamId && teamChanged) {
      const capacity = await this.settings.getTeamDailyCapacity(companyId);
      if (capacity > 0) {
        const count = await this.missionRepository
          .createQueryBuilder('m')
          .where('m.company_id = :cid AND m.team_id = :tid AND m.id != :mid', { cid: companyId, tid: newTeamId, mid: id })
          .andWhere('m.date_mission >= :ds AND m.date_mission < :de', { ds: dayStart, de: dayEnd })
          .andWhere(`m.status IN ${ACTIVE_STATUSES}`)
          .getCount();
        if (count >= capacity) {
          throw new BadRequestException(
            `Capacité atteinte : l'équipe a déjà ${count} mission(s) active(s) ce jour-là (maximum ${capacity}, réglable dans Paramètres → Missions)`,
          );
        }
      }
    }
    // Un véhicule ne peut pas servir deux équipes différentes le même jour.
    if (newVehicleId) {
      const clash = await this.missionRepository
        .createQueryBuilder('m')
        .where('m.company_id = :cid AND m.vehicle_id = :vid AND m.id != :mid', { cid: companyId, vid: newVehicleId, mid: id })
        .andWhere('m.date_mission >= :ds AND m.date_mission < :de', { ds: dayStart, de: dayEnd })
        .andWhere(`m.status IN ${ACTIVE_STATUSES}`)
        .andWhere(newTeamId ? '(m.team_id IS NULL OR m.team_id != :tid)' : '1=1', { tid: newTeamId })
        .getOne();
      if (clash) {
        throw new BadRequestException(`Véhicule déjà engagé par une autre équipe sur « ${clash.clientSite} » ce jour-là`);
      }
    }

    await this.assertLinks(companyId, { technicianIds: dto.technicianIds });
    if (dto.teamId !== undefined && dto.teamId !== mission.teamId) {
      mission.importMeta = { ...(mission.importMeta ?? {}), teamAssignedBy: 'manual' };
    }
    if (dto.teamId !== undefined) mission.teamId = dto.teamId;
    if (dto.technicianIds !== undefined) mission.technicianIds = dto.technicianIds;
    if (dto.vehicleId !== undefined) mission.vehicleId = dto.vehicleId;
    if (dto.dateMission) mission.dateMission = newDate;
    return this.missionRepository.save(mission);
  }

  /** Équipe, véhicule, techniciens et partenaire référencés doivent appartenir au tenant. */
  private async assertLinks(
    companyId: string,
    dto: { teamId?: string | null; vehicleId?: string | null; partnerId?: string | null; technicianIds?: string[] | null },
  ) {
    for (const [table, id, label] of [
      ['teams', dto.teamId, 'Équipe'],
      ['vehicles', dto.vehicleId, 'Véhicule'],
      ['partners', dto.partnerId, 'Partenaire'],
    ] as const) {
      if (!id) continue;
      const rows = await this.missionRepository.query(`SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2`, [id, companyId]);
      if (!rows.length) throw new BadRequestException(`${label} introuvable pour ce tenant`);
    }
    const techIds = [...new Set(dto.technicianIds ?? [])];
    if (techIds.length) {
      const rows = await this.missionRepository.query(
        'SELECT count(*)::int AS n FROM technicians WHERE id = ANY($1::uuid[]) AND company_id = $2',
        [techIds, companyId],
      );
      if (rows[0].n !== techIds.length) throw new BadRequestException('Technicien(s) introuvable(s) pour ce tenant');
    }
  }

  async updateDetails(
    companyId: string,
    id: string,
    dto: import('./dto/update-mission-details.dto').UpdateMissionDetailsDto,
  ): Promise<Mission> {
    const mission = await this.findOne(companyId, id);
    await this.assertLinks(companyId, { partnerId: dto.partnerId });
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

  async remove(companyId: string, id: string, userId: string | null = null) {
    const mission = await this.findOne(companyId, id);
    if (mission.invoiceId) throw new BadRequestException('Mission facturée — suppression interdite');
    if (['validee', 'terminee'].includes(mission.status)) {
      throw new BadRequestException(`Mission ${mission.status} — suppression interdite (annulez-la ou dé-validez-la)`);
    }
    await this.missionRepository.remove(mission);
    await this.audit.log({
      companyId, actorId: userId, action: 'mission.delete', entityType: 'mission', entityId: id,
      payload: { clientSite: mission.clientSite, dossier: mission.sonatelDossierNumber, status: mission.status },
    });
    return { deleted: true };
  }

}
