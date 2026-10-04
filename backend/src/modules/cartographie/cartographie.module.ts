import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientFeedback } from './entities/client-feedback.entity';

class CreateFeedbackDto {
  @IsUUID() missionId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) cleanliness?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) behavior?: number;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() clientName?: string;
}

class CartographieService {
  constructor(@InjectRepository(ClientFeedback) private readonly fb: Repository<ClientFeedback>) {}

  /** Zones : productives / saturées / bloquées, dérivées des missions. */
  async zones(companyId: string, period?: string) {
    const rows: any[] = await this.fb.query(
      `SELECT COALESCE(NULLIF(m.zone, ''), 'Sans zone') AS zone,
              count(*)::int AS total,
              count(*) FILTER (WHERE m.status IN ('terminee','validee'))::int AS terminees,
              count(*) FILTER (WHERE m.status = 'validee')::int AS validees,
              count(*) FILTER (WHERE m.blocage_motif IS NOT NULL)::int AS bloquees,
              count(*) FILTER (WHERE m.status IN ('planifiee','en_cours','a_completer'))::int AS en_cours
         FROM missions m
        WHERE m.company_id = $1
          ${period ? `AND to_char(m.date_mission, 'YYYY-MM') = $2` : ''}
        GROUP BY zone
        ORDER BY total DESC`,
      period ? [companyId, period] : [companyId],
    );
    return rows.map((r) => {
      const total = Number(r.total);
      const terminees = Number(r.terminees);
      const validees = Number(r.validees);
      const bloquees = Number(r.bloquees);
      const enCours = Number(r.en_cours);
      const taux = total > 0 ? Math.round((terminees / total) * 100) : 0;
      let statut = 'normale';
      if (total > 0 && bloquees > 0 && terminees === 0) statut = 'bloquee';
      else if (total > 0 && terminees === 0 && enCours / total >= 0.5) statut = 'saturee';
      else if (total > 0 && taux >= 70) statut = 'productive';
      return { zone: r.zone, total, terminees, validees, bloquees, enCours, tauxReussite: taux, statut };
    });
  }

  /** Mois disponibles (pour basculer sur le dernier mois avec données). */
  async periodes(companyId: string) {
    const rows: any[] = await this.fb.query(
      `SELECT to_char(m.date_mission, 'YYYY-MM') AS month, count(*)::int AS total
         FROM missions m
        WHERE m.company_id = $1 AND m.date_mission IS NOT NULL
        GROUP BY month
        ORDER BY month DESC`,
      [companyId],
    );
    return rows.map((r) => ({ month: r.month, total: Number(r.total) }));
  }

  /** Classement des équipes : taux de réussite + satisfaction client. */
  async equipes(companyId: string, period?: string) {
    const periodCond = period ? `AND to_char(m.date_mission, 'YYYY-MM') = $2` : '';
    const params = period ? [companyId, period] : [companyId];
    const rows: any[] = await this.fb.query(
      `SELECT t.id, t.name,
              count(m.id)::int AS total,
              count(m.id) FILTER (WHERE m.status = 'validee')::int AS validees,
              ROUND(AVG(f.rating), 1) AS satisfaction,
              count(f.id)::int AS feedbacks
         FROM teams t
         LEFT JOIN missions m ON m.team_id = t.id AND m.company_id = t.company_id
           ${periodCond}
         LEFT JOIN client_feedback f ON f.team_id = t.id AND f.company_id = t.company_id
        WHERE t.company_id = $1
        GROUP BY t.id, t.name
        ORDER BY validees DESC, satisfaction DESC NULLS LAST`,
      params,
    );
    return rows.map((r) => {
      const total = Number(r.total);
      const validees = Number(r.validees);
      return {
        teamId: r.id,
        teamName: r.name,
        total,
        validees,
        tauxReussite: total > 0 ? Math.round((validees / total) * 100) : 0,
        satisfaction: r.satisfaction === null ? null : Number(r.satisfaction),
        feedbacks: Number(r.feedbacks),
      };
    });
  }

  async createFeedback(companyId: string, dto: CreateFeedbackDto) {
    const mission: any[] = await this.fb.query(
      'SELECT id, team_id FROM missions WHERE id = $1 AND company_id = $2',
      [dto.missionId, companyId],
    );
    if (!mission.length) throw new BadRequestException('Mission introuvable pour ce tenant');
    return this.fb.save(
      this.fb.create({
        companyId,
        missionId: dto.missionId,
        teamId: mission[0].team_id ?? null,
        rating: dto.rating,
        cleanliness: dto.cleanliness ?? null,
        behavior: dto.behavior ?? null,
        comment: dto.comment ?? null,
        clientName: dto.clientName ?? null,
      }),
    );
  }

  async listFeedback(companyId: string, teamId?: string) {
    const rows: any[] = await this.fb.query(
      `SELECT f.*, m.client_site AS mission_label, t.name AS team_name
         FROM client_feedback f
         LEFT JOIN missions m ON m.id = f.mission_id
         LEFT JOIN teams t ON t.id = f.team_id
        WHERE f.company_id = $1
          ${teamId ? 'AND f.team_id = $2' : ''}
        ORDER BY f.created_at DESC`,
      teamId ? [companyId, teamId] : [companyId],
    );
    return rows.map((r) => ({
      id: r.id,
      missionId: r.mission_id,
      missionLabel: r.mission_label,
      teamId: r.team_id,
      teamName: r.team_name,
      rating: r.rating,
      cleanliness: r.cleanliness,
      behavior: r.behavior,
      comment: r.comment,
      clientName: r.client_name,
      createdAt: r.created_at,
    }));
  }
}

@Controller('cartographie')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class CartographieController {
  constructor(private readonly svc: CartographieService) {}

  @Get('zones')
  zones(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    return this.svc.zones(companyId!, period);
  }

  @Get('periodes')
  periodes(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.svc.periodes(companyId!);
  }

  @Get('equipes')
  equipes(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    return this.svc.equipes(companyId!, period);
  }

  @Post('feedback')
  feedback(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateFeedbackDto) {
    this.requireTenant(companyId);
    return this.svc.createFeedback(companyId!, dto);
  }

  @Get('feedback')
  listFeedback(@CurrentUser('companyId') companyId: string | null, @Query('teamId') teamId?: string) {
    this.requireTenant(companyId);
    return this.svc.listFeedback(companyId!, teamId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ClientFeedback])],
  controllers: [CartographieController],
  providers: [CartographieService],
  exports: [TypeOrmModule],
})
export class CartographieModule {}
