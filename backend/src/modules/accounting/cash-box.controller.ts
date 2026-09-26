import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PageQueryDto, withTotal } from '../../common/pagination';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CashBoxService } from './cash-box.service';
import { EXPENSE_CATEGORIES } from './entities/expense.entity';

const RUBRIQUES = [...EXPENSE_CATEGORIES, 'approvisionnement'] as string[];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

class CreateEntryDto {
  @IsOptional() @Matches(MONTH) period?: string;

  @IsOptional() @IsDateString() entryDate?: string;

  @IsIn(['appro', 'depense'])
  type!: string;

  @IsOptional() @IsIn(RUBRIQUES) rubrique?: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;

  @IsOptional() @IsString() @MaxLength(200) beneficiary?: string;

  @IsOptional() @IsUUID() teamId?: string;

  @IsOptional() @IsUUID() vehicleId?: string;

  @IsOptional() @IsString() note?: string;
}

class UpdateEntryDto {
  @IsOptional() @IsDateString() entryDate?: string;
  @IsOptional() @IsIn(RUBRIQUES) rubrique?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount?: number;
  @IsOptional() @IsString() @MaxLength(200) beneficiary?: string | null;
  @IsOptional() @IsUUID() teamId?: string | null;
  @IsOptional() @IsUUID() vehicleId?: string | null;
  @IsOptional() @IsString() note?: string | null;
}

class RepayDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsDateString() entryDate?: string;
}

class CancelEntryDto {
  @IsString() @MinLength(3) reason!: string;
}

class PeriodQueryDto {
  @IsOptional() @Matches(MONTH, { message: 'Format de mois attendu : YYYY-MM' }) period?: string;
}

class ListEntriesQueryDto extends PageQueryDto {
  @IsOptional() @Matches(MONTH, { message: 'Format de mois attendu : YYYY-MM' }) period?: string;
}

@Controller('cash-box')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class CashBoxController {
  constructor(private readonly cashBox: CashBoxService) {}

  @Get()
  async list(
    @CurrentUser('companyId') companyId: string | null,
    @Query() q: ListEntriesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireTenant(companyId);
    return withTotal(res, await this.cashBox.list(companyId!, q.period, q));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string, @Body() dto: CreateEntryDto) {
    this.requireTenant(companyId);
    return this.cashBox.create(companyId!, dto, userId);
  }

  /** Synthèse du mois : solde, entrées/sorties, prêts, coût complet. */
  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string | null, @Query() q: PeriodQueryDto) {
    this.requireTenant(companyId);
    return this.cashBox.summary(companyId!, q.period ?? new Date().toISOString().slice(0, 7));
  }

  /** Comptabilité matière : mouvements valorisés au bordereau. */
  @Get('material')
  material(@CurrentUser('companyId') companyId: string | null, @Query() q: PeriodQueryDto) {
    this.requireTenant(companyId);
    return this.cashBox.material(companyId!, q.period ?? new Date().toISOString().slice(0, 7));
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    this.requireTenant(companyId);
    return this.cashBox.update(companyId!, id, dto, userId);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelEntryDto,
  ) {
    this.requireTenant(companyId);
    return this.cashBox.cancel(companyId!, id, dto.reason, userId);
  }

  @Post(':id/repay')
  @Roles(UserRole.ADMIN)
  repay(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepayDto,
  ) {
    this.requireTenant(companyId);
    return this.cashBox.repay(companyId!, id, dto.amount, dto.entryDate, userId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
