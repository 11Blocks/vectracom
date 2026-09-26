import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EXPENSE_CATEGORIES, Expense, ExpenseCategory } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { AuditService } from '../../common/audit/audit.service';
import { pageParams } from '../../common/pagination';

export interface MonthlySummaryLine {
  category: ExpenseCategory;
  count: number;
  total: number;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const today = () => new Date().toISOString().slice(0, 10);

export function monthBounds(month: string): { from: string; to: string } {
  if (!MONTH_RE.test(month)) throw new BadRequestException('Format de mois attendu : YYYY-MM');
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, dto: CreateExpenseDto, userId: string | null = null) {
    await this.assertLinks(companyId, dto);
    const saved = await this.expenseRepository.save(
      this.expenseRepository.create({
        companyId,
        category: dto.category as ExpenseCategory,
        amount: String(dto.amount),
        expenseDate: dto.expenseDate?.slice(0, 10) ?? today(),
        createdBy: userId,
        receiptPhotoUrl: dto.receiptPhotoUrl?.trim() || null,
        vehicleId: dto.vehicleId ?? null,
        technicianId: dto.technicianId ?? null,
        missionId: dto.missionId ?? null,
        description: dto.description?.trim() || null,
        aiExtracted: dto.aiExtracted ?? false,
      }),
    );
    await this.audit.log({
      companyId, actorId: userId, action: 'expense.create', entityType: 'expense', entityId: saved.id,
      payload: { category: saved.category, amount: dto.amount, date: saved.expenseDate },
    });
    return saved;
  }

  async list(
    companyId: string,
    filters: {
      category?: string; vehicleId?: string; technicianId?: string; missionId?: string;
      month?: string; from?: string; to?: string; search?: string; limit?: number; offset?: number;
    },
  ) {
    const { take, skip } = pageParams(filters, 2000);
    const qb = this.expenseRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.vehicle', 'vehicle')
      .leftJoinAndSelect('e.technician', 'tech')
      .leftJoinAndSelect('e.mission', 'mission')
      .where('e.company_id = :companyId', { companyId })
      .orderBy('e.expenseDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .take(take)
      .skip(skip);
    if (filters.month) {
      const { from, to } = monthBounds(filters.month);
      qb.andWhere('e.expense_date BETWEEN :from AND :to', { from, to });
    } else {
      if (filters.from) qb.andWhere('e.expense_date >= :from', { from: filters.from.slice(0, 10) });
      if (filters.to) qb.andWhere('e.expense_date <= :to', { to: filters.to.slice(0, 10) });
    }
    if (filters.category) qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.vehicleId) qb.andWhere('e.vehicle_id = :vehicleId', { vehicleId: filters.vehicleId });
    if (filters.technicianId) qb.andWhere('e.technician_id = :techId', { techId: filters.technicianId });
    if (filters.missionId) qb.andWhere('e.mission_id = :missionId', { missionId: filters.missionId });
    if (filters.search?.trim()) {
      qb.andWhere('(e.description ILIKE :q OR e.category ILIKE :q OR e.amount::text ILIKE :q)', { q: `%${filters.search.trim()}%` });
    }
    return qb.getManyAndCount();
  }

  async findOne(companyId: string, id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { companyId, id },
      relations: ['vehicle', 'technician', 'mission'],
    });
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return expense;
  }

  async remove(companyId: string, id: string, userId: string | null = null) {
    const expense = await this.findOne(companyId, id);
    await this.expenseRepository.remove(expense);
    await this.audit.log({
      companyId, actorId: userId, action: 'expense.delete', entityType: 'expense', entityId: id,
      payload: { category: expense.category, amount: Number(expense.amount), date: expense.expenseDate },
    });
    return { deleted: true };
  }

  async update(companyId: string, id: string, dto: UpdateExpenseDto, userId: string | null = null) {
    const expense = await this.findOne(companyId, id);
    await this.assertLinks(companyId, dto);
    const before = { category: expense.category, amount: Number(expense.amount), date: expense.expenseDate };
    if (dto.category !== undefined) expense.category = dto.category as ExpenseCategory;
    if (dto.amount !== undefined) expense.amount = String(dto.amount);
    if (dto.expenseDate !== undefined) expense.expenseDate = dto.expenseDate.slice(0, 10);
    if (dto.receiptPhotoUrl !== undefined) expense.receiptPhotoUrl = dto.receiptPhotoUrl?.trim() || null;
    if (dto.vehicleId !== undefined) { expense.vehicleId = dto.vehicleId ?? null; expense.vehicle = null; }
    if (dto.technicianId !== undefined) { expense.technicianId = dto.technicianId ?? null; expense.technician = null; }
    if (dto.missionId !== undefined) { expense.missionId = dto.missionId ?? null; expense.mission = null; }
    if (dto.description !== undefined) expense.description = dto.description?.trim() || null;
    if (dto.aiExtracted !== undefined) expense.aiExtracted = dto.aiExtracted;
    await this.expenseRepository.save(expense);
    await this.audit.log({
      companyId, actorId: userId, action: 'expense.update', entityType: 'expense', entityId: id,
      payload: { before, after: { category: expense.category, amount: Number(expense.amount), date: expense.expenseDate } },
    });
    return this.findOne(companyId, id);
  }

  /** Synthèse mensuelle par catégorie sur la date de dépense (mois YYYY-MM, défaut : mois courant). */
  async monthlySummary(companyId: string, month?: string): Promise<{
    month: string;
    lines: MonthlySummaryLine[];
    total: number;
  }> {
    const monthKey = month ?? new Date().toISOString().slice(0, 7);
    const { from, to } = monthBounds(monthKey);

    const rows = await this.expenseRepository.query(
      `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE company_id = $1 AND expense_date BETWEEN $2 AND $3
       GROUP BY category`,
      [companyId, from, to],
    );

    const totals = new Map<string, MonthlySummaryLine>(
      EXPENSE_CATEGORIES.map((c) => [c, { category: c, count: 0, total: 0 }]),
    );
    for (const row of rows) {
      const line = totals.get(row.category) ?? { category: row.category, count: 0, total: 0 };
      line.count = Number(row.count);
      line.total = Number(row.total);
      totals.set(row.category, line);
    }
    const lines = [...totals.values()];
    return {
      month: monthKey,
      lines,
      total: lines.reduce((sum, l) => sum + l.total, 0),
    };
  }

  /** Les rattachements (véhicule, technicien, mission) doivent appartenir au tenant. */
  private async assertLinks(companyId: string, dto: { vehicleId?: string | null; technicianId?: string | null; missionId?: string | null }) {
    const checks: Array<[string, string | null | undefined, string]> = [
      ['vehicles', dto.vehicleId, 'Véhicule'],
      ['technicians', dto.technicianId, 'Technicien'],
      ['missions', dto.missionId, 'Mission'],
    ];
    for (const [table, id, label] of checks) {
      if (!id) continue;
      const rows = await this.expenseRepository.query(`SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2`, [id, companyId]);
      if (!rows.length) throw new BadRequestException(`${label} inconnu pour ce tenant`);
    }
  }
}
