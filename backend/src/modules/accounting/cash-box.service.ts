import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashBoxEntry } from './entities/cash-box-entry.entity';
import { Expense } from './entities/expense.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { VehicleEvent } from '../vehicles/entities/vehicle-event.entity';
import { DailyAttendance } from '../hr/entities/daily-attendance.entity';
import { DailyWorker } from '../hr/entities/daily-worker.entity';

/**
 * Lot P8 — Appro caisse par rubrique + comptabilité matière.
 * Agrège les sources réelles de la plateforme : événements véhicules
 * (carburant/réparations), dépenses IA, salaires journaliers pointés,
 * et valorise les mouvements de stock au bordereau.
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
  ) {}

  /** Saisie manuelle d'une ligne d'appro caisse. */
  async create(companyId: string, dto: {
    period?: string; type: string; rubrique: string; amount: number;
    beneficiary?: string; teamId?: string; vehicleId?: string; note?: string;
  }) {
    const period = dto.period ?? new Date().toISOString().slice(0, 7);
    if (dto.amount <= 0) throw new BadRequestException('Montant > 0 requis');
    return this.entryRepository.save(
      this.entryRepository.create({
        companyId,
        period,
        type: dto.type as CashBoxEntry['type'],
        rubrique: dto.rubrique,
        amount: String(dto.amount),
        beneficiary: dto.beneficiary ?? null,
        teamId: dto.teamId ?? null,
        vehicleId: dto.vehicleId ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  /** Enregistre un remboursement partiel de prêt d'équipe. */
  async repay(companyId: string, id: string, amount: number) {
    const entry = await this.entryRepository.findOne({ where: { companyId, id } });
    if (!entry) throw new NotFoundException('Ligne introuvable');
    if (entry.rubrique !== 'pret_equipe') throw new BadRequestException('Remboursement réservé aux prêts d\'équipe');
    entry.repaidAmount = String(Number(entry.repaidAmount) + amount);
    return this.entryRepository.save(entry);
  }

  list(companyId: string, period?: string) {
    const where: Record<string, unknown> = { companyId };
    if (period) where.period = period;
    return this.entryRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  /**
   * Synthèse du mois : lignes saisies + agrégats automatiques des sources
   * réelles (carburant/réparations véhicules, salaires journaliers pointés,
   * dépenses validées) par rubrique.
   */
  async summary(companyId: string, period: string) {
    const from = `${period}-01`;
    const [y, m] = period.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

    const entries = await this.entryRepository.find({ where: { companyId, period } });

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
      .where('x.company_id = :cid AND x.created_at BETWEEN :from AND :to', { cid: companyId, from, to: `${to}T23:59:59Z` })
      .getMany();

    const byRubrique = new Map<string, number>();
    const add = (rubrique: string, amount: number) => byRubrique.set(rubrique, (byRubrique.get(rubrique) ?? 0) + amount);
    for (const e of entries) add(e.rubrique, Number(e.amount));
    add('carburant', fuelCost);
    add('depannage_vehicule', repairCost);
    add('salaire_journalier', wagesCost);
    for (const x of expenses) add(x.category, Number(x.amount));

    const manualTotal = entries.reduce((s, e) => s + Number(e.amount), 0);
    const autoTotal = fuelCost + repairCost + wagesCost + expenses.reduce((s, x) => s + Number(x.amount), 0);

    return {
      period,
      byRubrique: [...byRubrique.entries()]
        .map(([rubrique, total]) => ({ rubrique, total: Math.round(total) }))
        .sort((a, b) => b.total - a.total),
      sources: {
        manualEntries: entries.length,
        fuelCost: Math.round(fuelCost),
        repairCost: Math.round(repairCost),
        journalierWages: Math.round(wagesCost),
        expenses: expenses.length,
      },
      manualTotal: Math.round(manualTotal),
      automaticTotal: Math.round(autoTotal),
      grandTotal: Math.round(manualTotal + autoTotal),
    };
  }

  /**
   * Comptabilité matière : valorisation des mouvements de stock du mois
   * au bordereau 3STB 2025 (sorties valorisées par article).
   */
  async material(companyId: string, period: string) {
    const from = `${period}-01`;
    const [y, m] = period.split('-').map(Number);
    const to = `${new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)}T23:59:59Z`;

    const movements = await this.movementRepository
      .createQueryBuilder('mv')
      .where('mv.company_id = :cid AND mv.created_at BETWEEN :from AND :to', { cid: companyId, from, to })
      .getMany();

    const items = (await this.movementRepository.query(
      'SELECT id, reference, designation FROM stock_items WHERE company_id = $1',
      [companyId],
    )) as Array<{ id: string; reference: string; designation: string }>;
    const itemById = new Map<string, { id: string; reference: string; designation: string }>(items.map((i) => [i.id, i]));

    const prices = await this.priceRepository.find({ where: { companyId, version: '2025', isActive: true, priceGrid: 'BORDEREAU_3STB' } });
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
      movementsCount: movements.length,
      byType: Object.entries(byType).map(([type, v]) => ({ type, count: v.count, value: Math.round(v.value) })),
      consommations: [...byItem.values()]
        .map((l) => ({ ...l, value: Math.round(l.value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 50),
      consommationsValue: Math.round([...byItem.values()].reduce((s, l) => s + l.value, 0)),
    };
  }
}
