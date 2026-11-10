import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { IsBoolean, IsNumberString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PricingRule } from './entities/pricing-rule.entity';
import { PricingService } from './pricing.service';
import { PRESTATIONS } from './prestations';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

class CreatePricingRuleDto {
  @IsUUID() parentPartnerId!: string;
  @IsUUID() childPartnerId!: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsString() prestationKey?: string | null;
  @IsNumberString() percentage!: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}
class UpdatePricingRuleDto {
  @IsOptional() @IsNumberString() percentage?: string;
  @IsOptional() @IsString() prestationKey?: string | null;
  @IsOptional() @IsString() effectiveFrom?: string | null;
  @IsOptional() @IsString() effectiveTo?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
class SimulateQueryDto {
  @IsUUID() fromPartnerId!: string;
  @IsOptional() @IsUUID() toPartnerId?: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsString() prestationKey?: string;
  @Matches(/^\d+$/, { message: 'basePrice doit être un entier ≥ 0 (FCFA)' }) basePrice!: string;
  @IsOptional() @Matches(DATE, { message: 'date attendue au format YYYY-MM-DD' }) date?: string;
}

@Controller('pricing-rules')
@Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN, UserRole.DIRECTION)
export class PricingRulesController {
  constructor(private readonly svc: PricingService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.svc.list(companyId!);
  }

  /** Prestations auxquelles une règle peut s'appliquer (clés des factures). */
  @Get('prestations')
  prestations() {
    return PRESTATIONS;
  }

  /** Simulation de la cascade — lecture seule, aucune facture n'est modifiée. */
  @Get('simulate')
  simulate(@CurrentUser('companyId') companyId: string | null, @Query() q: SimulateQueryDto) {
    this.requireTenant(companyId);
    return this.svc.simulate(companyId!, { ...q, basePrice: Number(q.basePrice) });
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreatePricingRuleDto) {
    this.requireTenant(companyId);
    return this.svc.create(companyId!, dto);
  }

  @Put(':id')
  update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    this.requireTenant(companyId);
    return this.svc.update(companyId!, id, dto);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  controllers: [PricingRulesController],
  providers: [PricingService],
  exports: [TypeOrmModule, PricingService],
})
export class PricingModule {}
