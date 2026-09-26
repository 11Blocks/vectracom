import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { withTotal } from '../../common/pagination';
import { Roles, UserRole, GREEN_T_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SaasService, SubscriptionService } from './saas.service';
import { InvoicesSaasService } from './invoices-saas/invoices-saas.service';
import { SaasLimitDto } from './dto/saas-limit.dto';
import { AssignLicenseDto, RevokeLicenseDto } from './dto/assign-license.dto';
import { GenerateInvoiceSaasDto } from './dto/generate-invoice-saas.dto';
import { PayInvoiceSaasDto } from './dto/pay-invoice-saas.dto';
import { INVOICE_SAAS_STATUSES } from './invoices-saas/entities/invoice-saas.entity';

class TenantScopedQuery {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

class UsageQueryDto extends TenantScopedQuery {
  @IsOptional() @IsString() month?: string;
}

class TrackUsageDto {
  @IsIn(['photos', 'ia', 'api', 'storage_mb'])
  type!: string;

  @IsInt()
  @Min(1)
  amount!: number;
}

class InvoicesQueryDto extends TenantScopedQuery {
  @IsOptional() @IsString() @IsIn(INVOICE_SAAS_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

/**
 * Tenant (admin/direction) : sa propre souscription.
 * Console Green-T : n'importe quel tenant via ?companyId= ; finance_admin gère, support_admin consulte.
 */
@Controller('saas')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
export class SaasController {
  constructor(
    private readonly saasService: SaasService,
    private readonly subscriptions: SubscriptionService,
    private readonly invoicesSaas: InvoicesSaasService,
  ) {}

  // ------------------- Catalogue & options -------------------

  @Get('plans')
  plans() {
    return this.saasService.getPlans();
  }

  @Get('addons')
  addons(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
  ) {
    return this.saasService.getAddons(this.resolveTenant(companyId, role, query.companyId));
  }

  @Post('addons/:addonType/activate')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  activateAddon(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('addonType') addonType: string,
  ) {
    return this.saasService.activateAddon(this.resolveTenant(companyId, role, query.companyId), addonType);
  }

  @Post('addons/:addonType/deactivate')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  deactivateAddon(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('addonType') addonType: string,
  ) {
    return this.saasService.deactivateAddon(this.resolveTenant(companyId, role, query.companyId), addonType);
  }

  // ------------------- Limites & usage -------------------

  @Get('limits')
  limits(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
  ) {
    return this.saasService.getLimits(this.resolveTenant(companyId, role, query.companyId));
  }

  @Put('limits')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  updateLimits(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Body() dto: SaasLimitDto,
  ) {
    return this.saasService.updateLimits(this.resolveTenant(companyId, role, query.companyId), dto);
  }

  @Get('usage')
  usage(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: UsageQueryDto,
  ) {
    return this.saasService.getUsage(
      this.resolveTenant(companyId, role, query.companyId),
      query.month ?? new Date().toISOString(),
    );
  }

  @Post('usage/track')
  @Roles(UserRole.ADMIN)
  trackUsage(@CurrentUser('companyId') companyId: string | null, @Body() dto: TrackUsageDto) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.saasService.trackUsage(companyId, dto.type as never, dto.amount);
  }

  @Get('overage')
  overage(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: UsageQueryDto,
  ) {
    return this.saasService.calculateOverage(
      this.resolveTenant(companyId, role, query.companyId),
      query.month ?? new Date().toISOString(),
    );
  }

  // ------------------- Licences -------------------

  @Get('licenses')
  licenses(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
  ) {
    return this.subscriptions.getCompanyLicenses(this.resolveTenant(companyId, role, query.companyId));
  }

  @Post('licenses/assign')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  assignLicense(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Body() dto: AssignLicenseDto,
  ) {
    return this.subscriptions.assignLicense(this.resolveTenant(companyId, role, query.companyId), dto);
  }

  @Post('licenses/revoke')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  revokeLicense(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Body() dto: RevokeLicenseDto,
  ) {
    return this.subscriptions.revokeLicense(this.resolveTenant(companyId, role, query.companyId), dto.userId);
  }

  // ------------------- Factures SaaS -------------------

  /** Console Green-T sans ?companyId= : factures de tous les tenants. */
  @Get('invoices')
  async invoices(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: InvoicesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenant = companyId ?? (this.isConsole(role) ? query.companyId ?? null : this.resolveTenant(companyId, role));
    return withTotal(res, await this.invoicesSaas.list(tenant, { status: query.status, search: query.search, limit: query.limit, offset: query.offset }));
  }

  @Get('invoices-summary')
  invoicesSummary(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
  ) {
    const tenant = companyId ?? (this.isConsole(role) ? query.companyId ?? null : this.resolveTenant(companyId, role));
    return this.invoicesSaas.summary(tenant);
  }

  @Post('invoices/generate')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  generateInvoice(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Body() dto: GenerateInvoiceSaasDto,
  ) {
    const tenant = this.resolveTenant(companyId, role, query.companyId);
    return this.invoicesSaas.generate(tenant, dto.periodStart, dto.periodEnd);
  }

  @Get('invoices/:id')
  invoiceDetail(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('id') id: string,
  ) {
    const tenant = this.resolveTenant(companyId, role, query.companyId);
    return this.invoicesSaas.detail(tenant, id);
  }

  @Put('invoices/:id/pay')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  pay(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('id') id: string,
    @Body() dto: PayInvoiceSaasDto,
  ) {
    const tenant = this.resolveTenant(companyId, role, query.companyId);
    return this.invoicesSaas.markAsPaid(tenant, id, dto);
  }

  @Put('invoices/:id/overdue')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  overdue(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('id') id: string,
  ) {
    const tenant = this.resolveTenant(companyId, role, query.companyId);
    return this.invoicesSaas.markAsOverdue(tenant, id);
  }

  @Put('invoices/:id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN)
  cancel(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('role') role: string,
    @Query() query: TenantScopedQuery,
    @Param('id') id: string,
  ) {
    return this.invoicesSaas.cancel(this.resolveTenant(companyId, role, query.companyId), id);
  }

  private isConsole(role: string): boolean {
    return GREEN_T_ROLES.includes(role);
  }

  /**
   * Tenant : toujours son propre companyId (le TenantGuard refuse un autre ?companyId=).
   * Console Green-T : tenant désigné par ?companyId= — indispensable pour encaisser
   * l'impayé d'un tenant suspendu (le paiement ne peut plus venir du tenant lui-même).
   */
  private resolveTenant(companyId: string | null, role: string, requested?: string): string {
    if (companyId) return companyId;
    if (this.isConsole(role)) {
      if (requested) return requested;
      throw new BadRequestException('Console Green-T : précisez le tenant (?companyId=)');
    }
    throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
