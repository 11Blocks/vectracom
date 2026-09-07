import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CashBoxService } from './cash-box.service';

class CreateEntryDto {
  @IsOptional() @IsString() period?: string;

  @IsIn(['appro', 'depense', 'remboursement_pret'])
  type!: string;

  @IsString() rubrique!: string;

  @IsNumber() @Min(0.01) amount!: number;

  @IsOptional() @IsString() beneficiary?: string;

  @IsOptional() @IsUUID() teamId?: string;

  @IsOptional() @IsUUID() vehicleId?: string;

  @IsOptional() @IsString() note?: string;
}

class RepayDto {
  @IsNumber() @Min(0.01) amount!: number;
}

@Controller('cash-box')
@Roles(UserRole.ADMIN, UserRole.FINANCE_ADMIN, UserRole.DIRECTION)
export class CashBoxController {
  constructor(private readonly cashBox: CashBoxService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    return this.cashBox.list(companyId!, period);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateEntryDto) {
    this.requireTenant(companyId);
    return this.cashBox.create(companyId!, dto);
  }

  @Post(':id/repay')
  repay(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: RepayDto,
  ) {
    this.requireTenant(companyId);
    return this.cashBox.repay(companyId!, id, dto.amount);
  }

  /** Synthèse du mois par rubrique (sources manuelles + automatiques). */
  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    return this.cashBox.summary(companyId!, period ?? new Date().toISOString().slice(0, 7));
  }

  /** Comptabilité matière : mouvements valorisés au bordereau. */
  @Get('material')
  material(@CurrentUser('companyId') companyId: string | null, @Query('period') period?: string) {
    this.requireTenant(companyId);
    return this.cashBox.material(companyId!, period ?? new Date().toISOString().slice(0, 7));
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
