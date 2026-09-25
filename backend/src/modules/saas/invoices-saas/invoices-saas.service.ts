import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceSaas } from './entities/invoice-saas.entity';
import { SaasTransaction } from './entities/saas-transaction.entity';
import { SaasOverageBill } from '../entities/saas-overage-bill.entity';
import { Company } from '../../auth/entities/company.entity';
import { SaasService } from '../saas.service';
import { SubscriptionService } from '../saas.service';
import { SAAS_TVA_RATE } from '../saas-pricing';

/**
 * Facturation SaaS Green-T → clients : licences actives + options actives +
 * dépassements du mois. L'impayé pilote le blocage progressif du tenant
 * (retard_j15 / retard_j20 / suspendu — SubscriptionGuard Phase 1).
 */
@Injectable()
export class InvoicesSaasService {
  constructor(
    @InjectRepository(InvoiceSaas)
    private readonly invoiceRepository: Repository<InvoiceSaas>,
    @InjectRepository(SaasTransaction)
    private readonly transactionRepository: Repository<SaasTransaction>,
    @InjectRepository(SaasOverageBill)
    private readonly overageRepository: Repository<SaasOverageBill>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly saasService: SaasService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async generate(companyId: string, periodStart: string, periodEnd: string) {
    const start = periodStart.slice(0, 10);
    const end = periodEnd.slice(0, 10);
    const existing = await this.invoiceRepository.findOne({ where: { companyId, periodStart: start, periodEnd: end } });
    if (existing) throw new ConflictException(`Facture SaaS déjà générée (${existing.invoiceNumber})`);

    const [company, licenses, addons, overageBills] = await Promise.all([
      this.companyRepository.findOne({ where: { id: companyId } }),
      this.subscriptions.activeLicenses(companyId),
      this.saasService.activeAddons(companyId),
      this.saasService.openOverageBills(companyId, start),
    ]);
    if (!company) throw new NotFoundException('Tenant introuvable');

    const monthKey = start.slice(0, 7).replace('-', '');
    const seq = (await this.invoiceRepository.count({ where: { companyId } })) + 1;
    const invoiceNumber = `SAAS-${monthKey}-${String(seq).padStart(3, '0')}`;

    // Licences groupées par plan + options
    const licensesByPlan = new Map<string, number>();
    for (const license of licenses) {
      licensesByPlan.set(license.planCode, (licensesByPlan.get(license.planCode) ?? 0) + 1);
    }
    let totalHt = 0;
    const pendingTransactions: Array<{ amount: number; type: 'subscription' | 'overage'; description: string }> = [];
    for (const [planCode, count] of licensesByPlan) {
      const price = Number(licenses.find((l) => l.planCode === planCode)!.amount);
      totalHt += price * count;
      pendingTransactions.push({ amount: price * count, type: 'subscription', description: `${count} licence(s) ${planCode}` });
    }
    for (const addon of addons) {
      totalHt += Number(addon.priceMonthly);
      pendingTransactions.push({ amount: Number(addon.priceMonthly), type: 'subscription', description: `Option ${addon.addonType}` });
    }
    let overageTotal = 0;
    for (const bill of overageBills) {
      overageTotal += Number(bill.total);
      pendingTransactions.push({ amount: Number(bill.total), type: 'overage', description: `Dépassement ${bill.type}` });
    }
    totalHt += overageTotal;

    const totalTva = Math.round(totalHt * SAAS_TVA_RATE * 100) / 100;
    const totalTtc = Math.round((totalHt + totalTva) * 100) / 100;

    const invoice = await this.invoiceRepository.save(
      this.invoiceRepository.create({
        companyId,
        invoiceNumber,
        periodStart: start,
        periodEnd: end,
        totalHt: String(totalHt),
        totalTva: String(totalTva),
        totalTtc: String(totalTtc),
        status: 'pending',
      }),
    );

    for (const tx of pendingTransactions) {
      await this.transactionRepository.insert({
        companyId,
        invoiceId: invoice.id,
        amount: String(tx.amount),
        type: tx.type,
        description: tx.description,
      } as never);
    }
    // Les dépassements sont rattachés à la facture (facturés une seule fois).
    for (const bill of overageBills) {
      bill.invoiceId = invoice.id;
      await this.overageRepository.save(bill);
    }

    return this.detail(companyId, invoice.id);
  }

  async detail(companyId: string, id: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture SaaS introuvable');
    const transactions = await this.transactionRepository.find({ where: { companyId, invoiceId: id } });
    const overage = await this.overageRepository.find({ where: { invoiceId: id } });
    return { invoice, transactions, overage };
  }

  /** companyId null = tous les tenants (console Green-T), avec le nom du tenant. */
  async list(companyId: string | null, filters: { status?: string }) {
    const qb = this.invoiceRepository.createQueryBuilder('i').orderBy('i.periodStart', 'DESC');
    if (companyId) qb.where('i.company_id = :companyId', { companyId });
    if (filters.status) qb.andWhere('i.status = :status', { status: filters.status });
    const invoices = await qb.getMany();
    const ids = [...new Set(invoices.map((i) => i.companyId).filter(Boolean))] as string[];
    if (!ids.length) return invoices;
    const companies = await this.companyRepository.find({ where: ids.map((id) => ({ id })), select: ['id', 'name'] });
    const names = new Map(companies.map((c) => [c.id, c.name]));
    return invoices.map((i) => ({ ...i, companyName: names.get(i.companyId ?? '') ?? null }));
  }

  /** Paiement : la facture passe à paid et le tenant est réactivé s'il était retard/suspendu. */
  async markAsPaid(companyId: string, id: string, dto: { paymentMethod: string; reference?: string }) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture SaaS introuvable');
    if (invoice.status === 'paid') throw new BadRequestException('Facture déjà payée');
    if (invoice.status === 'cancelled') throw new BadRequestException('Facture annulée');

    invoice.status = 'paid';
    invoice.paymentDate = new Date().toISOString().slice(0, 10);
    invoice.paymentMethod = dto.paymentMethod as never;
    invoice.reference = dto.reference ?? null;
    await this.invoiceRepository.save(invoice);

    await this.companyRepository.update(
      { id: companyId },
      { subscriptionStatus: 'active' },
    );
    return this.detail(companyId, id);
  }

  /**
   * Impayé : positionne le blocage progressif du tenant selon l'ancienneté
   * de la fin de période — J+15 relance (retard_j15), J+20 lecture seule
   * (retard_j20), J+30 suspension totale (suspendu).
   */
  async markAsOverdue(companyId: string, id: string, now = new Date()) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture SaaS introuvable');
    if (invoice.status !== 'pending' && invoice.status !== 'overdue') {
      throw new BadRequestException(`Facture ${invoice.status} — passage en impayé impossible`);
    }
    const daysLate = Math.floor((now.getTime() - new Date(`${invoice.periodEnd}T23:59:59Z`).getTime()) / 86400000);
    const companyStatus =
      daysLate >= 30 ? 'suspendu' : daysLate >= 20 ? 'retard_j20' : daysLate >= 15 ? 'retard_j15' : 'retard_j1';

    invoice.status = 'overdue';
    await this.invoiceRepository.save(invoice);
    await this.companyRepository.update({ id: companyId }, { subscriptionStatus: companyStatus });
    return { invoice: await this.invoiceRepository.findOne({ where: { id } }), daysLate, companyStatus };
  }

  /** Totaux par statut (console Green-T : encours, impayés, encaissé). */
  async summary(companyId: string | null) {
    const qb = this.invoiceRepository
      .createQueryBuilder('i')
      .select('i.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(i.total_ttc),0)', 'amount')
      .groupBy('i.status');
    if (companyId) qb.where('i.company_id = :companyId', { companyId });
    const rows: { status: string; count: string; amount: string }[] = await qb.getRawMany();
    return Object.fromEntries(rows.map((r) => [r.status, { count: Number(r.count), amount: Number(r.amount) }]));
  }

  async cancel(companyId: string, id: string) {
    const invoice = await this.invoiceRepository.findOne({ where: { companyId, id } });
    if (!invoice) throw new NotFoundException('Facture SaaS introuvable');
    if (invoice.status === 'paid') throw new BadRequestException('Facture payée — annulation impossible');
    invoice.status = 'cancelled';
    await this.invoiceRepository.save(invoice);
    return this.detail(companyId, id);
  }
}
