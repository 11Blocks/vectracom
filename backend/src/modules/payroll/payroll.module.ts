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
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TeamPayroll, PAYROLL_STATUSES, PayrollStatus } from './entities/team-payroll.entity';

class UpsertPayrollDto {
  @IsUUID() teamId!: string;
  @IsString() period!: string; // YYYY-MM
  @IsNumber() @Min(0) revenue!: number;
  @IsOptional() @IsUUID() chefId?: string | null;
  @IsOptional() @IsUUID() binomeId?: string | null;
  @IsOptional() @IsString() note?: string;
}

class PayrollStatusDto {
  @IsIn(PAYROLL_STATUSES as unknown as string[]) status!: string;
}

class PayrollService {
  constructor(@InjectRepository(TeamPayroll) private readonly repo: Repository<TeamPayroll>) {}

  /** Feuille de paie par équipe sur une période, avec répartition 65/35. */
  async list(companyId: string, period: string) {
    const rows: any[] = await this.repo.query(
      `SELECT t.id AS team_id, t.name AS team_name, t.repartition_chef_pct,
              p.id AS payroll_id, p.revenue, p.chef_share, p.binome_share,
              p.chef_id, p.binome_id, p.status, p.note,
              c.full_name AS chef_name, b.full_name AS binome_name,
              (SELECT count(*)::int FROM missions m
                WHERE m.team_id = t.id AND m.company_id = t.company_id
                  AND m.status = 'validee'
                  AND to_char(m.date_mission, 'YYYY-MM') = $2) AS missions_validees
         FROM teams t
         LEFT JOIN team_payrolls p ON p.team_id = t.id AND p.company_id = t.company_id AND p.period = $2
         LEFT JOIN technicians c ON c.id = p.chef_id
         LEFT JOIN technicians b ON b.id = p.binome_id
        WHERE t.company_id = $1
        ORDER BY t.name ASC`,
      [companyId, period],
    );
    return rows.map((r) => ({
      teamId: r.team_id,
      teamName: r.team_name,
      repartitionChefPct: Number(r.repartition_chef_pct ?? 65),
      payrollId: r.payroll_id,
      revenue: Number(r.revenue ?? 0),
      chefShare: Number(r.chef_share ?? 0),
      binomeShare: Number(r.binome_share ?? 0),
      chefId: r.chef_id,
      binomeId: r.binome_id,
      chefName: r.chef_name,
      binomeName: r.binome_name,
      status: r.status ?? 'brouillon',
      note: r.note,
      missionsValidees: Number(r.missions_validees ?? 0),
    }));
  }

  /** Crée ou met à jour la feuille de paie, en recalculant le 65/35. */
  async upsert(companyId: string, dto: UpsertPayrollDto) {
    if (!/^\d{4}-\d{2}$/.test(dto.period)) throw new BadRequestException('Période invalide (attendu YYYY-MM)');
    const team: any[] = await this.repo.query('SELECT repartition_chef_pct FROM teams WHERE id = $1 AND company_id = $2', [dto.teamId, companyId]);
    if (!team.length) throw new BadRequestException('Équipe introuvable pour ce tenant');

    const chefPct = Number(team[0].repartition_chef_pct ?? 65);
    const chefShare = Math.round((dto.revenue * chefPct) / 100);
    const binomeShare = dto.revenue - chefShare;

    let payroll = await this.repo.findOne({ where: { companyId, teamId: dto.teamId, period: dto.period } });
    if (payroll) {
      payroll.revenue = String(dto.revenue);
      payroll.chefShare = String(chefShare);
      payroll.binomeShare = String(binomeShare);
      payroll.chefId = dto.chefId ?? payroll.chefId;
      payroll.binomeId = dto.binomeId ?? payroll.binomeId;
      if (dto.note !== undefined) payroll.note = dto.note;
    } else {
      payroll = this.repo.create({
        companyId,
        teamId: dto.teamId,
        period: dto.period,
        revenue: String(dto.revenue),
        chefShare: String(chefShare),
        binomeShare: String(binomeShare),
        chefId: dto.chefId ?? null,
        binomeId: dto.binomeId ?? null,
        note: dto.note ?? null,
        status: 'brouillon',
      });
    }
    return this.repo.save(payroll);
  }

  async setStatus(companyId: string, id: string, status: PayrollStatus) {
    const p = await this.repo.findOne({ where: { companyId, id } });
    if (!p) throw new NotFoundException('Feuille de paie introuvable');
    p.status = status;
    return this.repo.save(p);
  }
}

@Controller('remuneration')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    const p = period ?? new Date().toISOString().slice(0, 7);
    return this.svc.list(companyId!, p);
  }

  @Post()
  upsert(@CurrentUser('companyId') companyId: string | null, @Body() dto: UpsertPayrollDto) {
    this.requireTenant(companyId);
    return this.svc.upsert(companyId!, dto);
  }

  @Post(':id/valider')
  validate(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.svc.setStatus(companyId!, id, 'validee');
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([TeamPayroll])],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [TypeOrmModule],
})
export class PayrollModule {}
