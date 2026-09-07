import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Roles, UserRole, GREEN_T_ROLES } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SaasService, SubscriptionService } from './saas.service';
import { InvoicesSaasService } from './invoices-saas/invoices-saas.service';
import { SaasLimitDto } from './dto/saas-limit.dto';
import { AssignLicenseDto, RevokeLicenseDto } from './dto/assign-license.dto';
import { GenerateInvoiceSaasDto } from './dto/generate-invoice-saas.dto';
import { PayInvoiceSaasDto } from './dto/pay-invoice-saas.dto';
import { INVOICE_SAAS_STATUSES } from './invoices-saas/entities/invoice-saas.entity';

class UsageQueryDto {
  @IsOptional() @IsString() month?: string;
}

class TrackUsageDto {
  @IsIn(['photos', 'ia', 'api', 'storage_mb'])
  type!: string;

  @IsInt()
  @Min(1)
  amount!: number;
}

class InvoicesQueryDto {
  @IsOptional() @IsString() @IsIn(INVOICE_SAAS_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsUUID() companyId?: string;
}

class TenantScopedQuery {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

@Controller('saas')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
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
  addons(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.saasService.getAddons(companyId!);
  }

  @Post('addons/:addonType/activate')
  @Roles(UserRole.ADMIN)
  activateAddon(@CurrentUser('companyId') companyId: string | null, @Param('addonType') addonType: string) {
    this.requireTenant(companyId);
    return this.saasService.activateAddon(companyId!, addonType);
  }

  @Post('addons/:addonType/deactivate')
  @Roles(UserRole.ADMIN)
  deactivateAddon(@CurrentUser('companyId') companyId: string | null, @Param('addonType') addonType: string) {
    this.requireTenant(companyId);
    return this.saasService.deactivateAddon(companyId!, addonType);
  }

  // ------------------- Limites & usage -------------------

  @Get('limits')
  limits(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.saasService.getLimits(companyId!);
  }

  @Put('limits')
  @Roles(UserRole.ADMIN)
  updateLimits(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: SaasLimitDto,
  ) {
    this.requireTenant(companyId);
    return this.saasService.updateLimits(companyId!, dto);
  }

  @Get('usage')
  usage(@CurrentUser('companyId') companyId: string | null, @Query() query: UsageQueryDto) {
    this.requireTenant(companyId);
    return this.saasService.getUsage(companyId!, query.month ?? new Date().toISOString());
  }

  @Post('usage/track')
  @Roles(UserRole.ADMIN)
  trackUsage(@CurrentUser('companyId') companyId: string | null, @Body() dto: TrackUsageDto) {
    this.requireTenant(companyId);
    return this.saasService.trackUsage(companyId!, dto.type as never, dto.amount);
  }

  @Get('overage')
  overage(
    @CurrentUser('companyId') companyId: string | null,
    @Query('month') month?: string,
  ) {
    this.requireTenant(companyId);
    return this.saasService.calculateOverage(companyId!, month ?? new Date().toISOString());
  }

  // ------------------- Licences -------------------

  @Get('licenses')
  licenses(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.subscriptions.getCompanyLicenses(companyId!);
  }

  @Post('licenses/assign')
  @Roles(UserRole.ADMIN)
  assignLicense(@CurrentUser('companyId') companyId: string | null, @Body() dto: AssignLicenseDto) {
    this.requireTenant(companyId);
    return this.subscriptions.assignLicense(companyId!, dto);
  }

  @Post('licenses/revoke')
  @Roles(UserRole.ADMIN)
  revokeLicense(@CurrentUser('companyId') companyId: string | null, @Body() dto: RevokeLicenseDto) {
    this.requireTenant(companyId);
    return this.subscriptions.revokeLicense(companyId!, dto.userId);
  }

  // ------------------- Factures SaaS -------------------

  @Get('invoices')
  invoices(@CurrentUser('companyId') companyId: string | null, @Query() query: InvoicesQueryDto) {
    this.requireTenant(companyId);
    return this.invoicesSaas.list(companyId!, { status: query.status });
  }

  @Post('invoices/generate')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  cancel(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.invoicesSaas.cancel(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }

  /**
   * Console Green-T : super_admin/finance_admin agissent sur n'importe quel
   * tenant via ?companyId= — indispensable pour encaisser un impayé d'un
   * tenant suspendu (le paiement ne peut plus venir du tenant lui-même).
   */
  private resolveTenant(companyId: string | null, role: string, requested?: string): string {
    if (companyId) return companyId;
    if (requested && GREEN_T_ROLES.includes(role as never)) return requested;
    throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
