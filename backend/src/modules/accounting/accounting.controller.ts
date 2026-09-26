import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PageQueryDto, withTotal } from '../../common/pagination';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccountingService } from './accounting.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { EXPENSE_CATEGORIES } from './entities/expense.entity';

class ListExpensesQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @IsIn(EXPENSE_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() technicianId?: string;
  @IsOptional() @IsUUID() missionId?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() search?: string;
}

class SummaryQueryDto {
  @IsOptional()
  @IsString()
  month?: string;
}

@Controller('expenses')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get()
  async list(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: ListExpensesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireTenant(companyId);
    return withTotal(res, await this.accountingService.list(companyId!, query));
  }

  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string | null, @Query() query: SummaryQueryDto) {
    this.requireTenant(companyId);
    return this.accountingService.monthlySummary(companyId!, query.month);
  }

  /** Saisie terrain en 5 secondes (chef d'équipe autorisé). */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  create(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    this.requireTenant(companyId);
    return this.accountingService.create(companyId!, dto, userId);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string | null, @Param('id', ParseUUIDPipe) id: string) {
    this.requireTenant(companyId);
    return this.accountingService.findOne(companyId!, id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.CHEF_EQUIPE)
  update(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    this.requireTenant(companyId);
    return this.accountingService.update(companyId!, id, dto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireTenant(companyId);
    return this.accountingService.remove(companyId!, id, userId);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
