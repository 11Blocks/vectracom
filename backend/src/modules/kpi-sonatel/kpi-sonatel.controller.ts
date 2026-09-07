import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsBooleanString, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KpiSonatelService } from './kpi-sonatel.service';
import { MASTERY_PLAN_STATUSES } from './entities/kpi-mastery-plan.entity';
import { TCO_SEGMENTS } from './entities/kpi-tco-input.entity';

class AlertsQueryDto {
  @IsOptional()
  @IsBooleanString()
  resolved?: string;
}

class TcoEntryDto {
  @IsIn(TCO_SEGMENTS as unknown as string[])
  segment!: (typeof TCO_SEGMENTS)[number];

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class TcoBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TcoEntryDto)
  entries!: TcoEntryDto[];
}

class MasteryPlanDto {
  @IsString()
  kpiName!: string;

  @IsOptional()
  @IsString()
  analysis?: string;

  @IsOptional()
  @IsString()
  actions?: string;

  @IsOptional()
  @IsString()
  responsible?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn(MASTERY_PLAN_STATUSES as unknown as string[])
  status?: (typeof MASTERY_PLAN_STATUSES)[number];
}

function assertPeriod(period: string | undefined): string {
  if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new BadRequestException('Format de période attendu : YYYY-MM');
  }
  return period ?? new Date().toISOString().slice(0, 7);
}

@Controller('kpi-sonatel')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class KpiSonatelController {
  constructor(private readonly kpiService: KpiSonatelService) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.dashboard(companyId!, assertPeriod(period));
  }

  /** Registre des familles Optimax (onglets du front). */
  @Get('families')
  families() {
    return { families: this.kpiService.families() };
  }

  /** Saisie mensuelle du TCO par segment + montants résolus (facture par défaut). */
  @Get('tco')
  tco(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.getTcoInputs(companyId!, assertPeriod(period));
  }

  @Put('tco')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN, UserRole.DIRECTION)
  putTco(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period: string | undefined,
    @Body() body: TcoBodyDto,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.upsertTcoInputs(companyId!, assertPeriod(period), body.entries);
  }

  /** Plans de maîtrise exigés pour chaque ICP non atteint. */
  @Get('mastery-plans')
  masteryPlans(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.listMasteryPlans(companyId!, assertPeriod(period));
  }

  @Put('mastery-plans')
  putMasteryPlan(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period: string | undefined,
    @Body() body: MasteryPlanDto,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.upsertMasteryPlan(companyId!, assertPeriod(period), body.kpiName, body);
  }

  @Get('alerts')
  alerts(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: AlertsQueryDto,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.listAlerts(companyId!, query.resolved === undefined ? undefined : query.resolved === 'true');
  }

  @Post('alerts/:id/resolve')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  resolveAlert(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.kpiService.resolveAlert(companyId!, id);
  }

  @Get('history')
  history(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.history(companyId!, from, to);
  }

  @Get('report')
  report(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.generateReport(companyId!, assertPeriod(period));
  }

  /** Recalcul forcé des KPI + vérification des alertes (aussi appelé par le cron quotidien). */
  @Post('recalculate')
  @Roles(UserRole.ADMIN)
  async recalculate(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    const p = assertPeriod(period);
    const logs = await this.kpiService.calculateAll(companyId!, p);
    const alerts = await this.kpiService.checkAlerts(companyId!, p);
    return {
      period: p,
      calculated: logs.length,
      nonAtteints: logs.filter((l) => l.status === 'non_atteint').length,
      penaltiesTotal: Math.round(logs.reduce((s, l) => s + Number(l.penaltyAmount), 0) * 100) / 100,
      newAlerts: alerts.length,
    };
  }

  @Get('penalties')
  async penalties(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
  ) {
    this.requireTenant(companyId);
    const p = assertPeriod(period);
    const dash = await this.kpiService.dashboard(companyId!, p);
    const applicable = dash.kpis.filter((k) => k.status === 'non_atteint');
    return {
      period: p,
      penalties: applicable.map((k) => ({
        kpiName: k.kpiName,
        family: k.family,
        penaltyMode: k.penaltyMode,
        target: Number(k.target),
        actual: Number(k.actual),
        unitCount: Number(k.unitCount),
        penaltyAmount: Number(k.penaltyAmount),
      })),
      total: round(applicable.reduce((s, k) => s + Number(k.penaltyAmount), 0)),
      plafond: dash.plafond,
    };
  }

  /** Application des pénalités à la facture du mois (InvoicePenalty). */
  @Post('penalties/apply')
  @Roles(UserRole.ADMIN)
  applyPenalties(
    @CurrentUser('companyId') companyId: string | null,
    @Query('period') period?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    this.requireTenant(companyId);
    return this.kpiService.calculatePenalties(companyId!, assertPeriod(period), invoiceId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
