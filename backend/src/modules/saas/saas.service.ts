import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaasPlan } from './entities/saas-plan.entity';
import { SaasAddon } from './entities/saas-addon.entity';
import { SaasLimit } from './entities/saas-limit.entity';
import { SaasUsageTracking } from './entities/saas-usage-tracking.entity';
import { SaasOverageBill } from './entities/saas-overage-bill.entity';
import { User } from '../auth/entities/user.entity';
import { CompanySubscription } from './entities/company-subscription.entity';
import {
  ADDON_PRICES,
  BASE_LIMITS,
  OVERAGE_UNIT_PRICES,
  PLAN_PRICES,
  PREMIUM_LIMITS,
  SAAS_ADDON_TYPES,
  SAAS_PLAN_CODES,
  SaasAddonType,
  SaasPlanCode,
} from './saas-pricing';

@Injectable()
export class SaasService {
  constructor(
    @InjectRepository(SaasPlan)
    private readonly planRepository: Repository<SaasPlan>,
    @InjectRepository(SaasAddon)
    private readonly addonRepository: Repository<SaasAddon>,
    @InjectRepository(SaasLimit)
    private readonly limitRepository: Repository<SaasLimit>,
    @InjectRepository(SaasUsageTracking)
    private readonly usageRepository: Repository<SaasUsageTracking>,
    @InjectRepository(SaasOverageBill)
    private readonly overageRepository: Repository<SaasOverageBill>,
  ) {}

  // ------------------- Plans -------------------

  async getPlans(): Promise<SaasPlan[]> {
    const stored = await this.planRepository.find({ where: { isActive: true }, order: { priceMonthly: 'ASC' } });
    if (stored.length > 0) return stored;
    // Catalogue garanti sans seed : création à la volée depuis la grille officielle.
    for (const code of SAAS_PLAN_CODES) {
      const def = PLAN_PRICES[code];
      await this.planRepository.insert({
        companyId: null,
        name: def.name,
        code,
        description: def.description,
        priceMonthly: String(def.monthly),
        priceAnnual: String(def.annual),
        features: {},
        isActive: true,
      } as never);
    }
    return this.planRepository.find({ where: { isActive: true }, order: { priceMonthly: 'ASC' } });
  }

  // ------------------- Options -------------------

  async getAddons(companyId: string) {
    const stored = await this.addonRepository.find({ where: { companyId } });
    const byType = new Map(stored.map((a) => [a.addonType, a]));
    return SAAS_ADDON_TYPES.map((type) => {
      const addon = byType.get(type);
      return {
        addonType: type,
        isActive: addon?.isActive ?? false,
        priceMonthly: addon ? Number(addon.priceMonthly) : ADDON_PRICES[type],
        activatedAt: addon?.activatedAt ?? null,
        trialEndsAt: addon?.trialEndsAt ?? null,
      };
    });
  }

  async activateAddon(companyId: string, addonType: string) {
    this.assertAddonType(addonType);
    let addon = await this.addonRepository.findOne({ where: { companyId, addonType } });
    if (!addon) {
      addon = this.addonRepository.create({ companyId, addonType });
    }
    addon.isActive = true;
    addon.priceMonthly = String(ADDON_PRICES[addonType]);
    addon.activatedAt = new Date();
    addon.trialEndsAt = new Date(Date.now() + 7 * 86400000);
    return this.addonRepository.save(addon);
  }

  async deactivateAddon(companyId: string, addonType: string) {
    this.assertAddonType(addonType);
    const addon = await this.addonRepository.findOne({ where: { companyId, addonType } });
    if (!addon || !addon.isActive) throw new NotFoundException('Option non active');
    addon.isActive = false;
    return this.addonRepository.save(addon);
  }

  activeAddons(companyId: string) {
    return this.addonRepository.find({ where: { companyId, isActive: true } });
  }

  // ------------------- Limites -------------------

  async getLimits(companyId: string) {
    let limits = await this.limitRepository.findOne({ where: { companyId } });
    if (!limits) {
      limits = await this.limitRepository.save(
        this.limitRepository.create({ companyId, planType: 'base', ...BASE_LIMITS }),
      );
    }
    return limits;
  }

  async updateLimits(companyId: string, dto: { planType?: string; maxPhotosPerMonth?: number; maxIaRequestsPerMonth?: number; maxStorageGb?: number; maxApiRequestsPerDay?: number }) {
    const limits = await this.getLimits(companyId);
    if (dto.planType === 'premium') {
      Object.assign(limits, { planType: 'premium', ...PREMIUM_LIMITS });
    } else if (dto.planType === 'base') {
      Object.assign(limits, { planType: 'base', ...BASE_LIMITS });
    }
    Object.assign(limits, {
      ...(dto.maxPhotosPerMonth !== undefined ? { maxPhotosPerMonth: dto.maxPhotosPerMonth } : {}),
      ...(dto.maxIaRequestsPerMonth !== undefined ? { maxIaRequestsPerMonth: dto.maxIaRequestsPerMonth } : {}),
      ...(dto.maxStorageGb !== undefined ? { maxStorageGb: dto.maxStorageGb } : {}),
      ...(dto.maxApiRequestsPerDay !== undefined ? { maxApiRequestsPerDay: dto.maxApiRequestsPerDay } : {}),
    });
    return this.limitRepository.save(limits);
  }

  // ------------------- Usage -------------------

  async getUsage(companyId: string, month: string): Promise<SaasUsageTracking> {
    const monthKey = `${month.slice(0, 7)}-01`;
    let usage = await this.usageRepository.findOne({ where: { companyId, month: monthKey } });
    if (!usage) {
      usage = await this.usageRepository.save(this.usageRepository.create({ companyId, month: monthKey }));
    }
    return usage;
  }

  /** Incrémente un compteur du mois courant et signale le dépassement éventuel. */
  async trackUsage(companyId: string, type: 'photos' | 'ia' | 'api' | 'storage_mb', amount: number) {
    if (amount < 0) throw new BadRequestException('Montant négatif refusé');
    const month = new Date().toISOString().slice(0, 7);
    const usage = await this.getUsage(companyId, month);
    const limits = await this.getLimits(companyId);
    switch (type) {
      case 'photos':
        usage.photosCount += amount;
        break;
      case 'ia':
        usage.iaRequests += amount;
        break;
      case 'api':
        usage.apiRequests += amount;
        break;
      case 'storage_mb':
        usage.storageUsedMb += amount;
        break;
    }
    await this.usageRepository.save(usage);
    const overLimit =
      (type === 'photos' && usage.photosCount > limits.maxPhotosPerMonth) ||
      (type === 'ia' && usage.iaRequests > limits.maxIaRequestsPerMonth) ||
      (type === 'api' && usage.apiRequests > limits.maxApiRequestsPerDay) ||
      (type === 'storage_mb' && usage.storageUsedMb > limits.maxStorageGb * 1024);
    return { usage, overLimit };
  }

  /**
   * Dépassements du mois : blocs facturables par type
   * (photos 5 000/10 000 · IA 500/requête · stockage 10 000/10 GB · API 1 000/1 000).
   */
  async calculateOverage(companyId: string, month: string): Promise<{ bills: SaasOverageBill[]; total: number }> {
    const monthKey = `${month.slice(0, 7)}-01`;
    const usage = await this.getUsage(companyId, monthKey);
    const limits = await this.getLimits(companyId);

    const rows: Array<{ type: SaasOverageBill['type']; quantity: number; unitPrice: number }> = [];
    const extraPhotos = Math.max(0, usage.photosCount - limits.maxPhotosPerMonth);
    if (extraPhotos > 0) {
      rows.push({ type: 'photos', quantity: Math.ceil(extraPhotos / OVERAGE_UNIT_PRICES.photos.unit), unitPrice: OVERAGE_UNIT_PRICES.photos.price });
    }
    const extraIa = Math.max(0, usage.iaRequests - limits.maxIaRequestsPerMonth);
    if (extraIa > 0) rows.push({ type: 'ia', quantity: extraIa, unitPrice: OVERAGE_UNIT_PRICES.ia.price });
    const extraStorageGb = Math.max(0, usage.storageUsedMb / 1024 - limits.maxStorageGb);
    if (extraStorageGb > 0) {
      rows.push({ type: 'storage', quantity: Math.ceil(extraStorageGb / OVERAGE_UNIT_PRICES.storage.unit), unitPrice: OVERAGE_UNIT_PRICES.storage.price });
    }
    const extraApi = Math.max(0, usage.apiRequests - limits.maxApiRequestsPerDay);
    if (extraApi > 0) {
      rows.push({ type: 'api', quantity: Math.ceil(extraApi / OVERAGE_UNIT_PRICES.api.unit), unitPrice: OVERAGE_UNIT_PRICES.api.price });
    }

    // Recalcul idempotent : remplace les lignes du mois non encore facturées.
    await this.overageRepository.delete({ companyId, month: monthKey });
    const bills: SaasOverageBill[] = [];
    for (const row of rows) {
      bills.push(
        await this.overageRepository.save(
          this.overageRepository.create({
            companyId,
            invoiceId: null,
            type: row.type,
            quantity: row.quantity,
            unitPrice: String(row.unitPrice),
            total: String(row.quantity * row.unitPrice),
            month: monthKey,
          }),
        ),
      );
    }
    const total = bills.reduce((s, b) => s + Number(b.total), 0);
    return { bills, total };
  }

  async openOverageBills(companyId: string, month: string) {
    const bills = await this.overageRepository.find({
      where: { companyId, month: `${month.slice(0, 7)}-01` },
    });
    return bills.filter((b) => b.invoiceId === null);
  }

  private assertAddonType(addonType: string): asserts addonType is SaasAddonType {
    if (!(SAAS_ADDON_TYPES as readonly string[]).includes(addonType)) {
      throw new BadRequestException(`Option inconnue : ${addonType}`);
    }
  }
}

/** Service des licences (subscriptions) — séparé pour la clarté. */
@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(CompanySubscription)
    private readonly subscriptionRepository: Repository<CompanySubscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly saasService: SaasService,
  ) {}

  async assignLicense(companyId: string, dto: { userId: string; planCode: string; billingCycle?: string }) {
    const user = await this.userRepository.findOne({ where: { companyId, id: dto.userId } });
    if (!user) throw new BadRequestException('Utilisateur inconnu pour ce tenant');
    const planCode = dto.planCode as SaasPlanCode;
    const plan = PLAN_PRICES[planCode];
    if (!plan) throw new BadRequestException(`Plan inconnu : ${dto.planCode}`);

    // Une licence active par utilisateur : l'ancienne est annulée.
    const current = await this.subscriptionRepository.findOne({
      where: { companyId, userId: dto.userId, status: 'active' },
    });
    if (current) {
      current.status = 'cancelled';
      current.endDate = new Date().toISOString().slice(0, 10);
      await this.subscriptionRepository.save(current);
    }

    const annual = dto.billingCycle === 'annual';
    const subscription = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        companyId,
        userId: dto.userId,
        planCode,
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
        billingCycle: annual ? 'annual' : 'monthly',
        amount: String(annual ? plan.annual : plan.monthly),
      }),
    );
    user.licenseType = planCode.toLowerCase() as User['licenseType'];
    user.licenseActive = true;
    await this.userRepository.save(user);
    return this.subscriptionRepository.findOne({ where: { id: subscription.id }, relations: ['user'] });
  }

  async revokeLicense(companyId: string, userId: string) {
    const current = await this.subscriptionRepository.findOne({
      where: { companyId, userId, status: 'active' },
    });
    if (!current) throw new NotFoundException('Aucune licence active pour cet utilisateur');
    current.status = 'cancelled';
    current.endDate = new Date().toISOString().slice(0, 10);
    await this.subscriptionRepository.save(current);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.licenseType = null;
      user.licenseActive = false;
      await this.userRepository.save(user);
    }
    return { revoked: true, userId };
  }

  getUserLicense(companyId: string, userId: string) {
    return this.subscriptionRepository.findOne({
      where: { companyId, userId, status: 'active' },
      relations: ['user'],
    });
  }

  getCompanyLicenses(companyId: string) {
    return this.subscriptionRepository.find({
      where: { companyId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  activeLicenses(companyId: string) {
    return this.subscriptionRepository.find({ where: { companyId, status: 'active' } });
  }
}
