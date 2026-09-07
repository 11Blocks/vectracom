import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseCategory } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';

export interface MonthlySummaryLine {
  category: ExpenseCategory;
  count: number;
  total: number;
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(companyId: string, dto: CreateExpenseDto) {
    return this.expenseRepository.save(
      this.expenseRepository.create({
        companyId,
        category: dto.category as ExpenseCategory,
        amount: String(dto.amount),
        receiptPhotoUrl: dto.receiptPhotoUrl?.trim() ?? null,
        vehicleId: dto.vehicleId ?? null,
        technicianId: dto.technicianId ?? null,
        missionId: dto.missionId ?? null,
        description: dto.description?.trim() ?? null,
        aiExtracted: dto.aiExtracted ?? false,
      }),
    );
  }

  async list(
    companyId: string,
    filters: { category?: string; vehicleId?: string; technicianId?: string; missionId?: string },
  ) {
    const qb = this.expenseRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.vehicle', 'vehicle')
      .leftJoinAndSelect('e.technician', 'tech')
      .leftJoinAndSelect('e.mission', 'mission')
      .where('e.company_id = :companyId', { companyId })
      .orderBy('e.createdAt', 'DESC')
      .take(500);
    if (filters.category) qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.vehicleId) qb.andWhere('e.vehicle_id = :vehicleId', { vehicleId: filters.vehicleId });
    if (filters.technicianId) qb.andWhere('e.technician_id = :techId', { techId: filters.technicianId });
    if (filters.missionId) qb.andWhere('e.mission_id = :missionId', { missionId: filters.missionId });
    return qb.getMany();
  }

  async findOne(companyId: string, id: string) {
    const expense = await this.expenseRepository.findOne({
      where: { companyId, id },
      relations: ['vehicle', 'technician', 'mission'],
    });
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return expense;
  }

  async remove(companyId: string, id: string) {
    const expense = await this.findOne(companyId, id);
    await this.expenseRepository.remove(expense);
    return { deleted: true };
  }

  async update(companyId: string, id: string, dto: CreateExpenseDto) {
    const expense = await this.findOne(companyId, id);
    expense.category = dto.category as ExpenseCategory;
    expense.amount = String(dto.amount);
    if (dto.receiptPhotoUrl !== undefined) expense.receiptPhotoUrl = dto.receiptPhotoUrl?.trim() ?? null;
    if (dto.vehicleId !== undefined) expense.vehicleId = dto.vehicleId ?? null;
    if (dto.technicianId !== undefined) expense.technicianId = dto.technicianId ?? null;
    if (dto.missionId !== undefined) expense.missionId = dto.missionId ?? null;
    if (dto.description !== undefined) expense.description = dto.description?.trim() ?? null;
    if (dto.aiExtracted !== undefined) expense.aiExtracted = dto.aiExtracted;
    return this.expenseRepository.save(expense);
  }

  /** Synthèse mensuelle par catégorie (mois YYYY-MM, défaut : mois courant). */
  async monthlySummary(companyId: string, month?: string): Promise<{
    month: string;
    lines: MonthlySummaryLine[];
    total: number;
  }> {
    let monthKey = month ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
      throw new BadRequestException('Format de mois attendu : YYYY-MM');
    }

    const rows = await this.expenseRepository.query(
      `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE company_id = $1 AND to_char(created_at, 'YYYY-MM') = $2
       GROUP BY category`,
      [companyId, monthKey],
    );

    const totals = new Map<string, MonthlySummaryLine>(
      (['main_oeuvre', 'materiel', 'transport', 'divers'] as const).map((c) => [
        c,
        { category: c, count: 0, total: 0 },
      ]),
    );
    for (const row of rows) {
      const line = totals.get(row.category);
      if (line) {
        line.count = Number(row.count);
        line.total = Number(row.total);
      }
    }
    const lines = [...totals.values()];
    return {
      month: monthKey,
      lines,
      total: lines.reduce((sum, l) => sum + l.total, 0),
    };
  }
}
