import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../auth/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { SaasAddon } from '../saas/entities/saas-addon.entity';
import { InvoiceSaas } from '../saas/invoices-saas/entities/invoice-saas.entity';
import { SaasTransaction } from '../saas/invoices-saas/entities/saas-transaction.entity';

/** Durée de vie moyenne d'un client (mois) — hypothèse business documentée. */
export const AVERAGE_LIFETIME_MONTHS = 24;

/**
 * KPI business SaaS, calculés depuis les données réelles de la Phase 13
 * (licences actives, options, factures, transactions) et des tenants.
 */
@Injectable()
export class BusinessMonitoringService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(SaasAddon)
    private readonly addonRepository: Repository<SaasAddon>,
    @InjectRepository(InvoiceSaas)
    private readonly invoiceRepository: Repository<InvoiceSaas>,
    @InjectRepository(SaasTransaction)
    private readonly transactionRepository: Repository<SaasTransaction>,
  ) {}

  /** MRR : licences actives (mensualisées) + options actives. */
  async calculateMRR(companyId?: string): Promise<number> {
    const subs = await this.subscriptionRepository.find({
      where: companyId ? { companyId, status: 'active' } : { status: 'active' },
    });
    let mrr = subs.reduce((sum, s) => {
      // Licence annuelle ramenée au mois.
      return sum + (s.billingCycle === 'annual' ? Number(s.amount) / 12 : Number(s.amount));
    }, 0);

    const addons = await this.addonRepository.find({
      where: companyId ? { companyId, isActive: true } : { isActive: true },
    });
    mrr += addons.reduce((sum, a) => sum + Number(a.priceMonthly), 0);
    return Math.round(mrr * 100) / 100;
  }

  async calculateARR(companyId?: string): Promise<number> {
    return Math.round((await this.calculateMRR(companyId)) * 12 * 100) / 100;
  }

  /** Churn : tenants résiliés / (actifs + résiliés). */
  async calculateChurn(companyId?: string) {
    if (companyId) {
      const company = await this.companyRepository.findOne({ where: { id: companyId } });
      const resilie = company?.subscriptionStatus === 'resilie' ? 1 : 0;
      return Math.round((resilie / 1) * 10000) / 100;
    }
    const companies = await this.companyRepository.find();
    const actifs = companies.filter((c) => c.subscriptionStatus !== 'resilie').length;
    const resilie = companies.filter((c) => c.subscriptionStatus === 'resilie').length;
    const rate = actifs + resilie > 0 ? (resilie / (actifs + resilie)) * 100 : 0;
    return Math.round(rate * 100) / 100;
  }

  /**
   * NRR : MRR courant / revenu du mois précédent (factures SaaS du mois - 1).
   * Null sans revenu antérieur (plateforme jeune).
   */
  async calculateNRR(companyId?: string) {
    const currentMrr = await this.calculateMRR(companyId);
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevStart = prev.toISOString().slice(0, 10);
    const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);

    const qb = this.invoiceRepository
      .createQueryBuilder('i')
      .where('i.period_start = :start AND i.period_end = :end', { start: prevStart, end: prevEnd })
      .andWhere("i.status IN ('paid','pending')");
    if (companyId) qb.andWhere('i.company_id = :companyId', { companyId });
    const invoices = await qb.getMany();
    const previousRevenue = invoices.reduce((s, i) => s + Number(i.totalHt), 0);

    const rate = previousRevenue > 0 ? Math.round((currentMrr / previousRevenue) * 10000) / 100 : null;
    return { rate, currentMrr, previousRevenue: Math.round(previousRevenue * 100) / 100 };
  }

  /** ARPU : revenu encaissé (factures payées) / utilisateurs actifs. */
  async calculateARPU(companyId?: string) {
    const paidQb = this.invoiceRepository
      .createQueryBuilder('i')
      .where("i.status = 'paid'");
    if (companyId) paidQb.andWhere('i.company_id = :companyId', { companyId });
    const paid = await paidQb.getMany();
    const totalRevenue = paid.reduce((s, i) => s + Number(i.totalHt), 0);

    const usersQb = this.userRepository.createQueryBuilder('u').where('u.active = true');
    if (companyId) usersQb.andWhere('u.company_id = :companyId', { companyId });
    const activeUsers = await usersQb.getCount();

    const value = activeUsers > 0 ? Math.round((totalRevenue / activeUsers) * 100) / 100 : 0;
    return { value, activeUsers, totalRevenue: Math.round(totalRevenue * 100) / 100 };
  }

  /** LTV = ARPU × durée de vie moyenne (24 mois par hypothèse). */
  async calculateLTV(companyId?: string) {
    const arpu = await this.calculateARPU(companyId);
    return {
      value: Math.round(arpu.value * AVERAGE_LIFETIME_MONTHS * 100) / 100,
      averageLifetimeMonths: AVERAGE_LIFETIME_MONTHS,
    };
  }

  /** CAC : coût d'acquisition (transactions onboarding) / nouveaux clients du mois. */
  async calculateCAC(companyId?: string) {
    const onboarding = await this.transactionRepository
      .createQueryBuilder('t')
      .where("t.type = 'onboarding'")
      .getMany();
    const acquisitionCost = onboarding.reduce((s, t) => s + Number(t.amount), 0);

    const now = new Date();
    const monthStart = `${now.toISOString().slice(0, 7)}-01`;
    const companies = await this.companyRepository
      .createQueryBuilder('c')
      .where('c.created_at >= :monthStart', { monthStart })
      .getCount();

    const value = companies > 0 ? Math.round((acquisitionCost / companies) * 100) / 100 : null;
    return { value, acquisitionCost, newCustomers: companies };
  }

  /** Vue consolidée : tous les KPI + volumétrie tenants/licences/options. */
  async getBusinessDashboard() {
    const [mrr, arr, churnRaw, nrr, arpu, ltv, cac] = await Promise.all([
      this.calculateMRR(),
      this.calculateARR(),
      this.churnDetails(),
      this.calculateNRR(),
      this.calculateARPU(),
      this.calculateLTV(),
      this.calculateCAC(),
    ]);

    const companies = await this.companyRepository.find();
    const [subs, addons] = await Promise.all([
      this.subscriptionRepository
        .createQueryBuilder('s')
        .where("s.status = 'active'")
        .getMany(),
      this.addonRepository.find({ where: { isActive: true } }),
    ]);

    const byPlan = new Map<string, { count: number; monthly: number }>();
    for (const sub of subs) {
      const monthly = sub.billingCycle === 'annual' ? Number(sub.amount) / 12 : Number(sub.amount);
      const entry = byPlan.get(sub.planCode) ?? { count: 0, monthly: 0 };
      entry.count += 1;
      entry.monthly += monthly;
      byPlan.set(sub.planCode, entry);
    }
    const byAddon = new Map<string, { count: number; monthly: number }>();
    for (const addon of addons) {
      const entry = byAddon.get(addon.addonType) ?? { count: 0, monthly: 0 };
      entry.count += 1;
      entry.monthly += Number(addon.priceMonthly);
      byAddon.set(addon.addonType, entry);
    }

    return {
      mrr,
      arr,
      churn: churnRaw,
      nrr,
      arpu,
      ltv,
      cac,
      tenants: {
        actifs: companies.filter((c) => c.subscriptionStatus !== 'resilie').length,
        resilie: companies.filter((c) => c.subscriptionStatus === 'resilie').length,
        essai: companies.filter((c) => c.subscriptionStatus === 'trial').length,
      },
      licenses: [...byPlan.entries()].map(([planCode, v]) => ({
        planCode,
        count: v.count,
        monthly: Math.round(v.monthly * 100) / 100,
      })),
      addons: [...byAddon.entries()].map(([addonType, v]) => ({
        addonType,
        count: v.count,
        monthly: Math.round(v.monthly * 100) / 100,
      })),
    };
  }

  private async churnDetails() {
    const companies = await this.companyRepository.find();
    const actifs = companies.filter((c) => c.subscriptionStatus !== 'resilie').length;
    const resilie = companies.filter((c) => c.subscriptionStatus === 'resilie').length;
    const rate = actifs + resilie > 0 ? Math.round((resilie / (actifs + resilie)) * 10000) / 100 : 0;
    return { rate, actifs, resilie };
  }
}
