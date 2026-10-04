import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Between, IsNull, Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermanenceSlot, PERMANENCE_TYPES, PermanenceType } from './entities/permanence-slot.entity';
import { Team } from '../teams/entities/team.entity';

/**
 * Jours fériés civils du Sénégal (fixes). Les fêtes musulmanes (Korité,
 * Tabaski, Maouloud, Tamkharit) sont lunaires → à ajouter chaque année.
 */
const SENEGAL_HOLIDAYS: Array<[number, number]> = [
  [1, 1], // Nouvel An
  [4, 4], // Fête de l'Indépendance
  [4, 6], // Lundi de Pâques (2026)
  [5, 1], // Fête du Travail
  [5, 14], // Ascension (2026)
  [5, 25], // Lundi de Pentecôte (2026)
  [8, 15], // Assomption
  [11, 1], // Toussaint
  [12, 25], // Noël
];

/** Équipes concernées par défaut selon le type de permanence. */
const TYPE_TO_TEAM_TYPE: Record<PermanenceType, string> = { SAV: 'SAV', PRODUCTION: 'PROD' };

@Injectable()
export class PermanenceService {
  constructor(
    @InjectRepository(PermanenceSlot)
    private readonly slotRepo: Repository<PermanenceSlot>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  /** Génère les créneaux (week-ends + jours fériés) pour une année. Idempotent. */
  async generateCalendar(companyId: string, year: number, type: PermanenceType) {
    const holidaySet = new Set(SENEGAL_HOLIDAYS.map(([m, d]) => `${m}-${d}`));
    let created = 0;
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(`${d.getUTCMonth() + 1}-${d.getUTCDate()}`);
      if (!isWeekend && !isHoliday) continue;
      const day = d.toISOString().slice(0, 10);
      const exists = await this.slotRepo.findOne({ where: { companyId, type, day } });
      if (exists) continue;
      await this.slotRepo.insert({ companyId, type, day, teamId: null, zone: null });
      created++;
    }
    return { year, type, created };
  }

  /** Assignation tournante équitable des créneaux non affectés (round-robin). */
  async assignRotation(companyId: string, type: PermanenceType, teamIds?: string[]) {
    const slots = await this.slotRepo.find({
      where: { companyId, type, teamId: IsNull() },
      order: { day: 'ASC' },
    });
    if (slots.length === 0) return { type, assigned: 0, teamCount: 0 };

    let teams = teamIds ?? [];
    if (teams.length === 0) {
      const wantedType = TYPE_TO_TEAM_TYPE[type];
      let rows = await this.teamRepo.find({ where: { companyId, active: true, type: wantedType as Team['type'] }, select: ['id'] });
      if (rows.length === 0) rows = await this.teamRepo.find({ where: { companyId, active: true }, select: ['id'] });
      teams = rows.map((t) => t.id);
    }
    if (teams.length === 0) throw new BadRequestException('Aucune équipe active pour la rotation');

    for (let i = 0; i < slots.length; i++) {
      slots[i].teamId = teams[i % teams.length];
    }
    await this.slotRepo.save(slots);
    return { type, assigned: slots.length, teamCount: teams.length };
  }

  /** Liste des créneaux (avec nom d'équipe) sur une plage. */
  async list(companyId: string, type: PermanenceType, from: string, to: string) {
    const rows: any[] = await this.slotRepo.query(
      `SELECT s.*, t.name AS team_name
         FROM permanence_slots s
         LEFT JOIN teams t ON t.id = s.team_id
        WHERE s.company_id = $1 AND s.type = $2 AND s.day BETWEEN $3 AND $4
        ORDER BY s.day ASC`,
      [companyId, type, from, to],
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      teamId: r.team_id,
      teamName: r.team_name,
      day: r.day,
      zone: r.zone,
    }));
  }

  /** Affecte (ou libère) une équipe sur un créneau précis. */
  async assignSlot(companyId: string, id: string, teamId: string | null) {
    const slot = await this.slotRepo.findOne({ where: { companyId, id } });
    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (teamId) {
      const team = await this.teamRepo.findOne({ where: { companyId, id: teamId } });
      if (!team) throw new BadRequestException('Équipe introuvable pour ce tenant');
    }
    slot.teamId = teamId;
    await this.slotRepo.save(slot);
    return slot;
  }
}

class GenerateDto {
  @IsIn(PERMANENCE_TYPES as unknown as string[]) type!: string;
  @IsString() year!: string;
}
class AssignDto {
  @IsIn(PERMANENCE_TYPES as unknown as string[]) type!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) teamIds?: string[];
}
class AssignSlotDto {
  @IsOptional() @IsUUID() teamId?: string | null;
}

@Controller('permanence')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class PermanenceController {
  constructor(private readonly svc: PermanenceService) {}

  @Post('generate')
  generate(@CurrentUser('companyId') companyId: string | null, @Body() dto: GenerateDto) {
    this.requireTenant(companyId);
    const year = Number(dto.year);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new BadRequestException('Année invalide');
    }
    return this.svc.generateCalendar(companyId!, year, dto.type as PermanenceType);
  }

  @Post('assign')
  assign(@CurrentUser('companyId') companyId: string | null, @Body() dto: AssignDto) {
    this.requireTenant(companyId);
    return this.svc.assignRotation(companyId!, dto.type as PermanenceType, dto.teamIds);
  }

  @Put(':id')
  assignSlot(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: AssignSlotDto) {
    this.requireTenant(companyId);
    return this.svc.assignSlot(companyId!, id, dto.teamId ?? null);
  }

  @Get()
  list(
    @CurrentUser('companyId') companyId: string | null,
    @Query('type') type: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    this.requireTenant(companyId);
    const t = (type ?? 'SAV') as PermanenceType;
    const f = from ?? new Date().toISOString().slice(0, 10);
    const tDate = to ?? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    return this.svc.list(companyId!, t, f, tDate);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PermanenceSlot, Team])],
  controllers: [PermanenceController],
  providers: [PermanenceService],
  exports: [PermanenceService, TypeOrmModule],
})
export class PermanenceModule {}
