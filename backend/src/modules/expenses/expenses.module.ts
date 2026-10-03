import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MissionExpense, EXPENSE_TYPES, ExpenseType } from './entities/mission-expense.entity';

class CreateExpenseDto {
  @IsOptional() @IsUUID() teamId?: string | null;
  @IsOptional() @IsUUID() missionId?: string | null;
  @IsIn(EXPENSE_TYPES as unknown as string[]) expenseType!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsISO8601() expenseDate?: string;
  @IsOptional() @IsString() note?: string;
}

class UpdateExpenseDto {
  @IsOptional() @IsUUID() teamId?: string | null;
  @IsOptional() @IsUUID() missionId?: string | null;
  @IsOptional() @IsIn(EXPENSE_TYPES as unknown as string[]) expenseType?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsISO8601() expenseDate?: string;
  @IsOptional() @IsString() note?: string | null;
}

@Controller('expenses')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string | null,
    @Query('type') type?: string,
    @Query('teamId') teamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.requireTenant(companyId);
    return this.svc.list(companyId!, { type, teamId, from, to });
  }

  @Get('summary')
  summary(@CurrentUser('companyId') companyId: string | null, @Query('from') from?: string, @Query('to') to?: string) {
    this.requireTenant(companyId);
    return this.svc.summary(companyId!, from, to);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string, @Body() dto: CreateExpenseDto) {
    this.requireTenant(companyId);
    return this.svc.create(companyId!, dto, userId);
  }

  @Put(':id')
  update(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    this.requireTenant(companyId);
    return this.svc.update(companyId!, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.svc.remove(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}

class ExpensesService {
  constructor(@InjectRepository(MissionExpense) private readonly repo: Repository<MissionExpense>) {}

  async list(companyId: string, f: { type?: string; teamId?: string; from?: string; to?: string }) {
    const rows: any[] = await this.repo.query(
      `SELECT e.*, t.name AS team_name, m.client_site AS mission_label
         FROM mission_expenses e
         LEFT JOIN teams t ON t.id = e.team_id
         LEFT JOIN missions m ON m.id = e.mission_id
        WHERE e.company_id = $1
          ${f.type ? 'AND e.expense_type = $2' : ''}
        ORDER BY e.expense_date DESC, e.created_at DESC`,
      f.type ? [companyId, f.type] : [companyId],
    );
    let list = rows.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      missionId: r.mission_id,
      missionLabel: r.mission_label,
      expenseType: r.expense_type,
      amount: Number(r.amount),
      expenseDate: r.expense_date,
      note: r.note,
      createdAt: r.created_at,
    }));
    if (f.teamId) list = list.filter((x) => x.teamId === f.teamId);
    if (f.from) list = list.filter((x) => x.expenseDate >= f.from!);
    if (f.to) list = list.filter((x) => x.expenseDate <= f.to!);
    return list;
  }

  /** Totaux par type de frais sur une période. */
  async summary(companyId: string, from?: string, to?: string) {
    const rows: any[] = await this.repo.query(
      `SELECT expense_type, sum(amount)::numeric AS total, count(*)::int AS n
         FROM mission_expenses
        WHERE company_id = $1
          ${from ? 'AND expense_date >= $2' : ''}
        GROUP BY expense_type
        ORDER BY expense_type`,
      from ? [companyId, from] : [companyId],
    );
    const byType: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;
    for (const r of rows) {
      const total = Number(r.total);
      grandTotal += total;
      byType[r.expense_type] = { total, count: Number(r.n) };
    }
    return { byType, grandTotal };
  }

  async create(companyId: string, dto: CreateExpenseDto, userId: string) {
    return this.repo.save(
      this.repo.create({
        companyId,
        teamId: dto.teamId ?? null,
        missionId: dto.missionId ?? null,
        expenseType: dto.expenseType as ExpenseType,
        amount: dto.amount,
        expenseDate: dto.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        note: dto.note ?? null,
        createdBy: userId,
      }),
    );
  }

  async update(companyId: string, id: string, dto: UpdateExpenseDto) {
    const e = await this.repo.findOne({ where: { companyId, id } });
    if (!e) throw new NotFoundException('Frais introuvable');
    if (dto.teamId !== undefined) e.teamId = dto.teamId;
    if (dto.missionId !== undefined) e.missionId = dto.missionId;
    if (dto.expenseType !== undefined) e.expenseType = dto.expenseType as ExpenseType;
    if (dto.amount !== undefined) e.amount = dto.amount;
    if (dto.expenseDate !== undefined) e.expenseDate = dto.expenseDate.slice(0, 10);
    if (dto.note !== undefined) e.note = dto.note;
    return this.repo.save(e);
  }

  async remove(companyId: string, id: string) {
    const e = await this.repo.findOne({ where: { companyId, id } });
    if (!e) throw new NotFoundException('Frais introuvable');
    await this.repo.remove(e);
    return { deleted: true };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([MissionExpense])],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [TypeOrmModule],
})
export class ExpensesModule {}
