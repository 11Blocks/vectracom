import { BadRequestException, Body, Controller, Get, Post, Put, Param } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module } from '@nestjs/common';
import { IsBoolean, IsNumberString, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PricingRule } from './entities/pricing-rule.entity';

class CreatePricingRuleDto {
  @IsString() parentPartnerId!: string;
  @IsString() childPartnerId!: string;
  @IsOptional() @IsString() itemId?: string;
  @IsNumberString() percentage!: string;
  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}
class UpdatePricingRuleDto {
  @IsOptional() @IsNumberString() percentage?: string;
  @IsOptional() @IsString() effectiveFrom?: string | null;
  @IsOptional() @IsString() effectiveTo?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('pricing-rules')
@Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN, UserRole.DIRECTION)
export class PricingRulesController {
  constructor(@InjectRepository(PricingRule) private readonly repo: Repository<PricingRule>) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.repo.find({ where: { companyId: companyId! }, order: { createdAt: 'ASC' } });
  }

  @Post()
  async create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreatePricingRuleDto) {
    this.requireTenant(companyId);
    const percentage = Number(dto.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1000) {
      throw new BadRequestException('Pourcentage invalide (doit être > 0 et ≤ 1000)');
    }
    return this.repo.save(
      this.repo.create({
        companyId: companyId!,
        parentPartnerId: dto.parentPartnerId,
        childPartnerId: dto.childPartnerId,
        itemId: dto.itemId ?? null,
        percentage: percentage.toFixed(2),
        effectiveFrom: dto.effectiveFrom ?? null,
        effectiveTo: dto.effectiveTo ?? null,
      }),
    );
  }

  @Put(':id')
  async update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    this.requireTenant(companyId);
    const rule = await this.repo.findOne({ where: { companyId: companyId!, id } });
    if (!rule) throw new BadRequestException('Règle introuvable');
    if (dto.percentage !== undefined) rule.percentage = Number(dto.percentage).toFixed(2);
    if (dto.effectiveFrom !== undefined) rule.effectiveFrom = dto.effectiveFrom;
    if (dto.effectiveTo !== undefined) rule.effectiveTo = dto.effectiveTo;
    if (dto.active !== undefined) rule.active = dto.active;
    return this.repo.save(rule);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  controllers: [PricingRulesController],
  exports: [TypeOrmModule],
})
export class PricingModule {}
