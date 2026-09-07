import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Company } from '../auth/entities/company.entity';
import { InvoiceSaas } from './invoices-saas/entities/invoice-saas.entity';
import { InvoicesSaasService } from './invoices-saas/invoices-saas.service';
import { SaasService } from './saas.service';

/**
 * Tâches SaaS :
 * - 1er du mois : facturation du mois écoulé pour chaque tenant actif
 * - quotidien : suivi d'usage + passage en impayé des factures échues
 *   (J+15 relance, J+20 lecture seule, J+30 suspension — SubscriptionGuard).
 */
@Injectable()
export class SaasCronService {
  private readonly logger = new Logger(SaasCronService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(InvoiceSaas)
    private readonly invoiceRepository: Repository<InvoiceSaas>,
    private readonly invoicesSaas: InvoicesSaasService,
    private readonly saasService: SaasService,
  ) {}

  static previousMonthBounds(now = new Date()): { periodStart: string; periodEnd: string } {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
  }

  async runMonthlyBilling(now = new Date()) {
    const { periodStart, periodEnd } = SaasCronService.previousMonthBounds(now);
    const companies = await this.companyRepository.find({ where: { active: true }, select: ['id', 'name'] });
    const results: Array<Record<string, unknown>> = [];
    for (const company of companies) {
      try {
        const detail = await this.invoicesSaas.generate(company.id, periodStart, periodEnd);
        results.push({ company: company.name, invoice: detail.invoice.invoiceNumber, ttc: Number(detail.invoice.totalTtc) });
      } catch (err) {
        results.push({ company: company.name, skipped: err instanceof Error ? err.message : String(err) });
      }
    }
    this.logger.log(`Facturation mensuelle ${periodStart} : ${results.length} tenant(s) traité(s)`);
    return results;
  }

  async runDailyUsageTracking() {
    const companies = await this.companyRepository.find({ where: { active: true }, select: ['id'] });
    for (const company of companies) {
      await this.saasService.getUsage(company.id, new Date().toISOString());
    }
    return { companies: companies.length };
  }

  /** Factures pending dont la période est échue → impayé + blocage progressif. */
  async runOverdueChecks(now = new Date()) {
    const threshold = new Date(now.getTime() - 15 * 86400000).toISOString().slice(0, 10);
    const pending = await this.invoiceRepository
      .createQueryBuilder('i')
      .where("i.status = 'pending' AND i.period_end < :threshold", { threshold })
      .getMany();

    const results = [];
    for (const invoice of pending) {
      if (!invoice.companyId) continue;
      const outcome = await this.invoicesSaas.markAsOverdue(invoice.companyId, invoice.id, now);
      results.push({ invoice: invoice.invoiceNumber, daysLate: outcome.daysLate, companyStatus: outcome.companyStatus });
      this.logger.warn(`Relance ${invoice.invoiceNumber} : ${outcome.daysLate} j de retard → ${outcome.companyStatus}`);
    }
    return results;
  }
}
