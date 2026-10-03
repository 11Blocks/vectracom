import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Renfort, RENFORT_STATUSES, RenfortStatus } from './entities/renfort.entity';

class CreateRenfortDto {
  @IsUUID() teamId!: string;
  @IsOptional() @IsUUID() fromZoneId?: string | null;
  @IsOptional() @IsUUID() toZoneId?: string | null;
  @IsISO8601() startDate!: string;
  @IsISO8601() endDate!: string;
  @IsOptional() @IsNumber() @Min(0) perdiemPerDay?: number;
  @IsOptional() @IsString() note?: string;
}

class UpdateRenfortDto {
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() fromZoneId?: string | null;
  @IsOptional() @IsUUID() toZoneId?: string | null;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsNumber() @Min(0) perdiemPerDay?: number;
  @IsOptional() @IsString() note?: string | null;
}

class RenfortStatusDto {
  @IsIn(RENFORT_STATUSES as unknown as string[]) status!: string;
}

class RenfortsService {
  constructor(@InjectRepository(Renfort) private readonly repo: Repository<Renfort>) {}

  private async assertTeam(companyId: string, teamId: string) {
    const rows = await this.repo.query('SELECT 1 FROM teams WHERE id = $1 AND company_id = $2', [teamId, companyId]);
    if (!rows.length) throw new BadRequestException('Équipe introuvable pour ce tenant');
  }

  async list(companyId: string, status?: string) {
    const rows: any[] = await this.repo.query(
      `SELECT r.*,
              t.name AS team_name,
              zf.name AS from_zone_name,
              zt.name AS to_zone_name,
              (SELECT count(*)::int FROM technicians tech WHERE tech.team_id = r.team_id AND tech.active = true) AS member_count
         FROM renforts r
         LEFT JOIN teams t ON t.id = r.team_id
         LEFT JOIN zones zf ON zf.id = r.from_zone_id
         LEFT JOIN zones zt ON zt.id = r.to_zone_id
        WHERE r.company_id = $1
          ${status ? 'AND r.status = $2' : ''}
        ORDER BY r.start_date DESC`,
      status ? [companyId, status] : [companyId],
    );
    return rows.map((r) => this.enrich(r));
  }

  async findOne(companyId: string, id: string) {
    const rows: any[] = await this.repo.query(
      `SELECT r.*,
              t.name AS team_name,
              zf.name AS from_zone_name,
              zt.name AS to_zone_name,
              (SELECT count(*)::int FROM technicians tech WHERE tech.team_id = r.team_id AND tech.active = true) AS member_count
         FROM renforts r
         LEFT JOIN teams t ON t.id = r.team_id
         LEFT JOIN zones zf ON zf.id = r.from_zone_id
         LEFT JOIN zones zt ON zt.id = r.to_zone_id
        WHERE r.company_id = $1 AND r.id = $2`,
      [companyId, id],
    );
    if (!rows.length) throw new NotFoundException('Renfort introuvable');
    return this.enrich(rows[0]);
  }

  /** Calcule jours + coût total perdiem (perdiem/jour × jours × membres). */
  private enrich(r: any) {
    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const members = Number(r.member_count ?? 0);
    const perdiemPerDay = Number(r.perdiem_per_day ?? 0);
    const totalPerdiem = perdiemPerDay * days * members;
    return {
      id: r.id,
      companyId: r.company_id,
      teamId: r.team_id,
      teamName: r.team_name,
      fromZoneId: r.from_zone_id,
      fromZoneName: r.from_zone_name,
      toZoneId: r.to_zone_id,
      toZoneName: r.to_zone_name,
      startDate: r.start_date,
      endDate: r.end_date,
      perdiemPerDay,
      days,
      members,
      totalPerdiem,
      status: r.status,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async create(companyId: string, dto: CreateRenfortDto) {
    await this.assertTeam(companyId, dto.teamId);
    const start = dto.startDate.slice(0, 10);
    const end = dto.endDate.slice(0, 10);
    if (end < start) throw new BadRequestException('La date de fin doit être ≥ date de début');
    return this.repo.save(
      this.repo.create({
        companyId,
        teamId: dto.teamId,
        fromZoneId: dto.fromZoneId ?? null,
        toZoneId: dto.toZoneId ?? null,
        startDate: start,
        endDate: end,
        perdiemPerDay: dto.perdiemPerDay ?? 1000,
        status: 'actif',
        note: dto.note ?? null,
      }),
    );
  }

  async update(companyId: string, id: string, dto: UpdateRenfortDto) {
    const renfort = await this.repo.findOne({ where: { companyId, id } });
    if (!renfort) throw new NotFoundException('Renfort introuvable');
    if (dto.teamId !== undefined && dto.teamId !== renfort.teamId) await this.assertTeam(companyId, dto.teamId);
    if (dto.teamId !== undefined) renfort.teamId = dto.teamId;
    if (dto.fromZoneId !== undefined) renfort.fromZoneId = dto.fromZoneId;
    if (dto.toZoneId !== undefined) renfort.toZoneId = dto.toZoneId;
    if (dto.startDate !== undefined) renfort.startDate = dto.startDate.slice(0, 10);
    if (dto.endDate !== undefined) renfort.endDate = dto.endDate.slice(0, 10);
    if (dto.perdiemPerDay !== undefined) renfort.perdiemPerDay = dto.perdiemPerDay;
    if (dto.note !== undefined) renfort.note = dto.note;
    if (renfort.endDate < renfort.startDate) throw new BadRequestException('La date de fin doit être ≥ date de début');
    return this.repo.save(renfort);
  }

  async setStatus(companyId: string, id: string, status: RenfortStatus) {
    const renfort = await this.repo.findOne({ where: { companyId, id } });
    if (!renfort) throw new NotFoundException('Renfort introuvable');
    renfort.status = status;
    return this.repo.save(renfort);
  }
}

@Controller('renforts')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class RenfortsController {
  constructor(private readonly svc: RenfortsService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query('status') status?: string) {
    this.requireTenant(companyId);
    return this.svc.list(companyId!, status);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.svc.findOne(companyId!, id);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateRenfortDto) {
    this.requireTenant(companyId);
    return this.svc.create(companyId!, dto);
  }

  @Put(':id')
  update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdateRenfortDto) {
    this.requireTenant(companyId);
    return this.svc.update(companyId!, id, dto);
  }

  @Post(':id/status')
  setStatus(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: RenfortStatusDto) {
    this.requireTenant(companyId);
    return this.svc.setStatus(companyId!, id, dto.status as RenfortStatus);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Renfort])],
  controllers: [RenfortsController],
  providers: [RenfortsService],
  exports: [TypeOrmModule],
})
export class RenfortsModule {}
