import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CashBoxEntry, CashBoxType } from './entities/cash-box-entry.entity';
import { Expense } from './entities/expense.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { VehicleEvent } from '../vehicles/entities/vehicle-event.entity';
import { DailyAttendance } from '../hr/entities/daily-attendance.entity';
import { DailyWorker } from '../hr/entities/daily-worker.entity';
import { AuditService } from '../../common/audit/audit.service';
import { monthBounds } from './accounting.service';
import { pageParams } from '../../common/pagination';

export interface CashEntryInput {
  entryDate?: string;
  period?: string;
  type: string;
  rubrique?: string;
  amount: number;
  beneficiary?: string | null;
  teamId?: string | null;
  vehicleId?: string | null;
  note?: string | null;
}

const round = (n: number) => Math.round(n);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Lot P8 — Caisse : approvisionnements (entrées), dépenses caisse (sorties),
 * prêts d'équipe et leurs remboursements. Le solde ne tient compte que des
 * mouvements de caisse ; les sources automatiques (carburant véhicules,
 * salaires journaliers, dépenses saisies) donnent le coût complet du mois.
 */
@Injectable()
export class CashBoxService {
  constructor(
    @InjectRepository(CashBoxEntry)
    private readonly entryRepository: Repository<CashBoxEntry>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(PriceItem)
    private readonly priceRepository: Repository<PriceItem>,
    @InjectRepository(VehicleEvent)
    private readonly vehicleEventRepository: Repository<VehicleEvent>,
    @InjectRepository(DailyAttendance)
    private readonly attendanceRepository: Repository<DailyAttendance>,
    @InjectRepository(DailyWorker)
    private readonly workerRepository: Repository<DailyWorker>,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, dto: CashEntryInput, userId: string | null = null) {
    if (dto.type === 'remboursement_pret') {
      throw new BadRequestException('Un remboursement s’enregistre depuis la ligne du prêt (bouton « Rembourser »)');
    }
    const entryDate = this.resolveDate(dto);
    const rubrique = this.resolveRubrique(dto.type, dto.rubrique);
    if (!(dto.amount > 0)) throw new BadRequestException('Montant > 0 requis');
    await this.assertLinks(companyId, dto);
    const saved = await this.entryRepository.save(
      this.entryRepository.create({
        companyId,
        entryDate,
        period: entryDate.slice(0, 7),
        type: dto.type as CashBoxType,
        rubrique,
        amount: String(dto.amount),
        beneficiary: dto.beneficiary?.trim() || null,
        teamId: dto.teamId ?? null,
        vehicleId: dto.vehicleId ?? null,
        note: dto.note?.trim() || null,
        createdBy: userId,
      }),
    );
    await this.audit.log({
      companyId, actorId: userId, action: 'cash.create', entityType: 'cash_box_entry', entityId: saved.id,
      payload: { type: saved.type, rubrique, amount: dto.amount, date: entryDate },
    });
    return saved;
  }

  async update(companyId: string, id: string, dto: Partial<CashEntryInput>, userId: string | null = null) {
    const entry = await this.findActive(companyId, id);
    if (entry.type === 'remboursement_pret') {
      throw new BadRequestException('Remboursement non modifiable — annulez-le puis ressaisissez-le');
    }
    if (dto.type !== undefined && dto.type !== entry.type) {
      throw new BadRequestException('Le type d’une ligne n’est pas modifiable — annulez-la puis ressaisissez-la');
    }
    await this.assertLinks(companyId, dto);
    const before = { amount: Number(entry.amount), rubrique: entry.rubrique, date: entry.entryDate };
    if (dto.entryDate !== undefined) {
      entry.entryDate = this.resolveDate({ entryDate: dto.entryDate });
      entry.period = entry.entryDate.slice(0, 7);
    }
    if (dto.rubrique !== undefined) entry.rubrique = this.resolveRubrique(entry.type, dto.rubrique);
    if (dto.amount !== undefined) {
      if (!(dto.amount > 0)) throw new BadRequestException('Montant > 0 requis');
      if (entry.rubrique === 'pret_equipe' && dto.amount < Number(entry.repaidAmount)) {
        throw new BadRequestException(`Montant inférieur au déjà remboursé (${Number(entry.repaidAmount)} FCFA)`);
      }
      entry.amount = String(dto.amount);
    }
    if (dto.beneficiary !== undefined) entry.beneficiary = dto.beneficiary?.trim() || null;
    if (dto.teamId !== undefined) entry.teamId = dto.teamId ?? null;
    if (dto.vehicleId !== undefined) entry.vehicleId = dto.vehicleId ?? null;
    if (dto.note !== undefined) entry.note = dto.note?.trim() || null;
    const saved = await this.entryRepository.save(entry);
    await this.audit.log({
      companyId, actorId: userId, action: 'cash.update', entityType: 'cash_box_entry', entityId: id,
      payload: { before, after: { amount: Number(saved.amount), rubrique: saved.rubrique, date: saved.entryDate } },
    });
    return saved;
  }

  /** Annulation : la ligne reste visible (barrée) mais sort des totaux. */
  async cancel(companyId: string, id: string, reason: string, userId: string | null = null) {
    const entry = await this.findActive(companyId, id);
    if (entry.rubrique === 'pret_equipe' && Number(entry.repaidAmount) > 0) {
      throw new BadRequestException('Prêt partiellement remboursé — annulez d’abord ses remboursements');
    }
    await this.entryRepository.manager.transaction(async (em) => {
      entry.cancelledAt = new Date();
      entry.cancelReason = reason.trim();
      await em.save(entry);
      if (entry.type === 'remboursement_pret' && entry.loanEntryId) {
        const loan = await em.findOne(CashBoxEntry, { where: { companyId, id: entry.loanEntryId } });
        if (loan) {
          loan.repaidAmount = String(Math.max(0, Number(loan.repaidAmount) - Number(entry.amount)));
          await em.save(loan);
        }
      }
    });
    await this.audit.log({
      companyId, actorId: userId, action: 'cash.cancel', entityType: 'cash_box_entry', entityId: id,
      payload: { type: entry.type, rubrique: entry.rubrique, amount: Number(entry.amount), reason },
    });
    return entry;
  }

  /** Remboursement (partiel) d'un prêt d'équipe : crée une entrée de caisse liée au prêt. */
  async repay(companyId: string, id: string, amount: number, entryDate?: string, userId: string | null = null) {
    const loan = await this.findActive(companyId, id);
    if (loan.rubrique !== 'pret_equipe') throw new BadRequestException('Remboursement réservé aux prêts d’équipe');
    const remaining = Number(loan.amount) - Number(loan.repaidAmount);
    if (!(amount > 0)) throw new BadRequestException('Montant > 0 requis');
    if (amount > remaining + 0.001) throw new BadRequestException(`Le reste à rembourser est de ${round(remaining)} FCFA`);
    const date = this.resolveDate({ entryDate });
    const repayment = await this.entryRepository.manager.transaction(async (em) => {
      loan.repaidAmount = String(Number(loan.repaidAmount) + amount);
      await em.save(loan);
      return em.save(
        em.create(CashBoxEntry, {
          companyId,
          entryDate: date,
          period: date.slice(0, 7),
          type: 'remboursement_pret',
          rubrique: 'pret_equipe',
          amount: String(amount),
          beneficiary: loan.beneficiary,
          teamId: loan.teamId,
          loanEntryId: loan.id,
          note: `Remboursement du prêt du ${loan.entryDate}`,
          createdBy: userId,
        }),
      );
    });
    await this.audit.log({
      companyId, actorId: userId, action: 'cash.repay', entityType: 'cash_box_entry', entityId: loan.id,
      payload: { amount, repaymentId: repayment.id },
    });
    return { loan, repayment };
  }

  list(companyId: string, period?: string, page: { limit?: number; offset?: number } = {}) {
    const { take, skip } = pageParams(page, 2000);
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .where('e.company_id = :companyId', { companyId })
      .orderBy('e.entryDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .take(take)
      .skip(skip);
    if (period) {
      const { from, to } = monthBounds(period);
      qb.andWhere('e.entry_date BETWEEN :from AND :to', { from, to });
    }
    return qb.getManyAndCount();
  }

  /**
   * Synthèse du mois : solde de caisse (ouverture → clôture), entrées, sorties
   * caisse par rubrique, prêts en cours, et coût complet incluant les sources
   * automatiques (carburant/réparations véhicules, salaires journaliers, dépenses).
   */
  async summary(companyId: string, period: string) {
    const { from, to } = monthBounds(period);

    const [opening] = (await this.entryRepository.query(
      `SELECT COALESCE(SUM(CASE WHEN type IN ('appro','remboursement_pret') THEN amount ELSE -amount END), 0) AS balance
         FROM cash_box_entries
        WHERE company_id = $1 AND cancelled_at IS NULL AND entry_date < $2`,
      [companyId, from],
    )) as Array<{ balance: string }>;
    const openingBalance = Number(opening?.balance ?? 0);

    const entries = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.company_id = :cid AND e.cancelled_at IS NULL AND e.entry_date BETWEEN :from AND :to', { cid: companyId, from, to })
      .getMany();
    const sum = (type: CashBoxType) => entries.filter((e) => e.type === type).reduce((s, e) => s + Number(e.amount), 0);
    const appro = sum('appro');
    const repayments = sum('remboursement_pret');
    const cashSpending = sum('depense');

    const vehicleEvents = await this.vehicleEventRepository
      .createQueryBuilder('e')
      .where('e.company_id = :cid AND e.event_date BETWEEN :from AND :to', { cid: companyId, from, to })
      .getMany();
    const fuelCost = vehicleEvents.filter((e) => e.type === 'carburant').reduce((s, e) => s + Number(e.cost), 0);
    const repairCost = vehicleEvents.filter((e) => e.type === 'reparation' || e.type === 'piece').reduce((s, e) => s + Number(e.cost), 0);

    const attendances = await this.attendanceRepository
      .createQueryBuilder('a')
      .where('a.company_id = :cid AND a.day BETWEEN :from AND :to', { cid: companyId, from, to })
      .getMany();
    const workers = await this.workerRepository.find({ where: { companyId } });
    const rateByWorker = new Map(workers.map((w) => [w.id, Number(w.dailyRate)]));
    const wagesCost = attendances.reduce((s, a) => s + (rateByWorker.get(a.dailyWorkerId) ?? 0) * Number(a.daysWorked), 0);

    const expenses = await this.expenseRepository
      .createQueryBuilder('x')
      .where('x.company_id = :cid AND x.expense_date BETWEEN :from AND :to', { cid: companyId, from, to })
      .getMany();
    const expensesTotal = expenses.reduce((s, x) => s + Number(x.amount), 0);

    const byRubrique = new Map<string, { cash: number; automatic: number }>();
    const add = (rubrique: string, kind: 'cash' | 'automatic', amount: number) => {
      if (!amount) return;
      const r = byRubrique.get(rubrique) ?? { cash: 0, automatic: 0 };
      r[kind] += amount;
      byRubrique.set(rubrique, r);
    };
    for (const e of entries) if (e.type === 'depense') add(e.rubrique, 'cash', Number(e.amount));
    add('carburant', 'automatic', fuelCost);
    add('depannage_vehicule', 'automatic', repairCost);
    add('salaire_journalier', 'automatic', wagesCost);
    for (const x of expenses) add(x.category, 'automatic', Number(x.amount));

    const [loans] = (await this.entryRepository.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount - repaid_amount), 0) AS outstanding
         FROM cash_box_entries
        WHERE company_id = $1 AND cancelled_at IS NULL AND rubrique = 'pret_equipe' AND type = 'depense'
          AND amount > repaid_amount`,
      [companyId],
    )) as Array<{ count: string; outstanding: string }>;

    const automaticTotal = fuelCost + repairCost + wagesCost + expensesTotal;
    const inflows = appro + repayments;
    return {
      period,
      openingBalance: round(openingBalance),
      inflows: { appro: round(appro), repayments: round(repayments), total: round(inflows) },
      cashSpending: round(cashSpending),
      closingBalance: round(openingBalance + inflows - cashSpending),
      byRubrique: [...byRubrique.entries()]
        .map(([rubrique, v]) => ({ rubrique, cash: round(v.cash), automatic: round(v.automatic), total: round(v.cash + v.automatic) }))
        .sort((a, b) => b.total - a.total),
      sources: {
        manualEntries: entries.length,
        fuelCost: round(fuelCost),
        repairCost: round(repairCost),
        journalierWages: round(wagesCost),
        expenses: expenses.length,
        expensesTotal: round(expensesTotal),
      },
      loans: { count: Number(loans?.count ?? 0), outstanding: round(Number(loans?.outstanding ?? 0)) },
      automaticTotal: round(automaticTotal),
      totalCost: round(cashSpending + automaticTotal),
    };
  }

  /**
   * Comptabilité matière : valorisation des mouvements de stock du mois
   * à la version active la plus récente du bordereau 3STB.
   */
  async material(companyId: string, period: string) {
    const { from, to } = monthBounds(period);

    const movements = await this.movementRepository
      .createQueryBuilder('mv')
      .where('mv.company_id = :cid AND mv.created_at BETWEEN :from AND :to', { cid: companyId, from, to: `${to}T23:59:59.999Z` })
      .andWhere('mv.cancelled_at IS NULL')
      .getMany();

    const items = (await this.movementRepository.query(
      'SELECT id, reference, designation FROM stock_items WHERE company_id = $1',
      [companyId],
    )) as Array<{ id: string; reference: string; designation: string }>;
    const itemById = new Map<string, { id: string; reference: string; designation: string }>(items.map((i) => [i.id, i]));

    const activePrices = await this.priceRepository.find({ where: { companyId, isActive: true, priceGrid: 'BORDEREAU_3STB' } });
    const priceVersion = activePrices.map((p) => p.version).sort().pop() ?? null;
    const prices = activePrices.filter((p) => p.version === priceVersion);
    // Correspondance approximative désignation ↔ item bordereau (mot-clé principal).
    const priceOf = (designation: string): number => {
      const key = designation.toLowerCase();
      const match = prices.find((p) => {
        const d = p.designation.toLowerCase();
        const words = d.split(/[ ,]/).filter((w) => w.length > 4);
        return words.some((w) => key.includes(w));
      });
      return match ? Number(match.unitPrice) : 0;
    };

    const byType: Record<string, { count: number; value: number }> = {};
    const byItem = new Map<string, { reference: string; designation: string; qty: number; unitPrice: number; value: number }>();
    for (const mv of movements) {
      const item = itemById.get(mv.stockItemId);
      if (!item) continue;
      const pu = priceOf(item.designation);
      const value = pu * mv.quantity;
      const entry = (byType[mv.type] ??= { count: 0, value: 0 });
      entry.count += 1;
      entry.value += value;
      if (mv.type === 'consommation') {
        const line = byItem.get(item.id) ?? { reference: item.reference, designation: item.designation, qty: 0, unitPrice: pu, value: 0 };
        line.qty += mv.quantity;
        line.value += value;
        byItem.set(item.id, line);
      }
    }

    return {
      period,
      priceVersion,
      movementsCount: movements.length,
      byType: Object.entries(byType).map(([type, v]) => ({ type, count: v.count, value: round(v.value) })),
      consommations: [...byItem.values()]
        .map((l) => ({ ...l, value: round(l.value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50),
      consommationsValue: round([...byItem.values()].reduce((s, l) => s + l.value, 0)),
    };
  }

  private async findActive(companyId: string, id: string) {
    const entry = await this.entryRepository.findOne({ where: { companyId, id, cancelledAt: IsNull() } });
    if (!entry) throw new NotFoundException('Ligne de caisse introuvable ou annulée');
    return entry;
  }

  private resolveDate(dto: { entryDate?: string; period?: string }): string {
    if (dto.entryDate) {
      const d = dto.entryDate.slice(0, 10);
      if (d > today()) throw new BadRequestException('Date dans le futur');
      return d;
    }
    if (dto.period) {
      const { from, to } = monthBounds(dto.period);
      const t = today();
      return t >= from && t <= to ? t : from;
    }
    return today();
  }

  private resolveRubrique(type: string, rubrique?: string): string {
    if (type === 'appro') {
      if (rubrique === 'pret_equipe') throw new BadRequestException('Un prêt d’équipe est une sortie de caisse (type « dépense »)');
      return rubrique?.trim() || 'approvisionnement';
    }
    if (!rubrique?.trim()) throw new BadRequestException('Rubrique requise pour une dépense');
    return rubrique.trim();
  }

  private async assertLinks(companyId: string, dto: { teamId?: string | null; vehicleId?: string | null }) {
    const checks: Array<[string, string | null | undefined, string]> = [
      ['teams', dto.teamId, 'Équipe'],
      ['vehicles', dto.vehicleId, 'Véhicule'],
    ];
    for (const [table, id, label] of checks) {
      if (!id) continue;
      const rows = await this.entryRepository.query(`SELECT 1 FROM ${table} WHERE id = $1 AND company_id = $2`, [id, companyId]);
      if (!rows.length) throw new BadRequestException(`${label} inconnu pour ce tenant`);
    }
  }
}
