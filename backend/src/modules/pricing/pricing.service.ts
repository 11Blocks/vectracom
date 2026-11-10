import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { assertTenantIds } from '../../common/tenant-ids';
import { PricingRule } from './entities/pricing-rule.entity';
import { CascadeError, CascadeRule, computeCascade, findRuleProblems } from './cascade';
import { prestationLabel } from './prestations';

export interface RuleInput {
  parentPartnerId: string;
  childPartnerId: string;
  itemId?: string | null;
  prestationKey?: string | null;
  percentage: string | number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface RulePatch {
  percentage?: string | number;
  prestationKey?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  active?: boolean;
}

export interface SimulateInput {
  fromPartnerId: string;
  toPartnerId?: string | null;
  itemId?: string | null;
  prestationKey?: string | null;
  basePrice: number;
  date?: string | null;
}

function toCascadeRule(r: PricingRule): CascadeRule {
  return {
    id: r.id,
    parentPartnerId: r.parentPartnerId,
    childPartnerId: r.childPartnerId,
    itemId: r.itemId ?? null,
    prestationKey: r.prestationKey ?? null,
    percentage: Number(r.percentage),
    effectiveFrom: r.effectiveFrom ? String(r.effectiveFrom).slice(0, 10) : null,
    effectiveTo: r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : null,
    active: r.active,
  };
}

const emptyToNull = (v: string | null | undefined): string | null => (v === undefined || v === null || v === '' ? null : v);

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PricingRule) private readonly repo: Repository<PricingRule>) {}

  list(companyId: string) {
    return this.repo.find({ where: { companyId }, order: { createdAt: 'ASC' } });
  }

  private async tenantRules(companyId: string): Promise<CascadeRule[]> {
    return (await this.repo.find({ where: { companyId } })).map(toCascadeRule);
  }

  /** Lève une 400 listant tous les problèmes de la règle candidate. */
  private async validate(companyId: string, candidate: CascadeRule): Promise<void> {
    const problems = findRuleProblems(await this.tenantRules(companyId), candidate);
    if (problems.length) throw new BadRequestException(problems.join(' ; '));
  }

  private async save(rule: PricingRule): Promise<PricingRule> {
    try {
      return await this.repo.save(rule);
    } catch (e) {
      // Index uq_pricing_rule_v2 (migration 020) : doublon exact.
      if (e instanceof QueryFailedError && (e as any).code === '23505') {
        throw new BadRequestException('Une règle identique (même portée et même date de début) existe déjà');
      }
      throw e;
    }
  }

  async create(companyId: string, dto: RuleInput): Promise<PricingRule> {
    await assertTenantIds(this.repo, companyId, 'partners', [dto.parentPartnerId, dto.childPartnerId]);
    await assertTenantIds(this.repo, companyId, 'items', dto.itemId);
    const candidate: CascadeRule = {
      id: '__nouvelle__',
      parentPartnerId: dto.parentPartnerId,
      childPartnerId: dto.childPartnerId,
      itemId: emptyToNull(dto.itemId),
      prestationKey: emptyToNull(dto.prestationKey),
      percentage: Number(dto.percentage),
      effectiveFrom: emptyToNull(dto.effectiveFrom),
      effectiveTo: emptyToNull(dto.effectiveTo),
      active: true,
    };
    await this.validate(companyId, candidate);
    return this.save(
      this.repo.create({
        companyId,
        parentPartnerId: candidate.parentPartnerId,
        childPartnerId: candidate.childPartnerId,
        itemId: candidate.itemId,
        prestationKey: candidate.prestationKey,
        percentage: candidate.percentage.toFixed(2),
        effectiveFrom: candidate.effectiveFrom,
        effectiveTo: candidate.effectiveTo,
      }),
    );
  }

  async update(companyId: string, id: string, dto: RulePatch): Promise<PricingRule> {
    const rule = await this.repo.findOne({ where: { companyId, id } });
    if (!rule) throw new NotFoundException('Règle introuvable');
    const candidate = toCascadeRule(rule);
    if (dto.percentage !== undefined) candidate.percentage = Number(dto.percentage);
    if (dto.prestationKey !== undefined) candidate.prestationKey = emptyToNull(dto.prestationKey);
    if (dto.effectiveFrom !== undefined) candidate.effectiveFrom = emptyToNull(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) candidate.effectiveTo = emptyToNull(dto.effectiveTo);
    if (dto.active !== undefined) candidate.active = dto.active;
    await this.validate(companyId, candidate);

    rule.percentage = candidate.percentage.toFixed(2);
    rule.prestationKey = candidate.prestationKey;
    rule.effectiveFrom = candidate.effectiveFrom;
    rule.effectiveTo = candidate.effectiveTo;
    rule.active = candidate.active;
    return this.save(rule);
  }

  /** Simulation de la cascade (lecture seule, aucune écriture). */
  async simulate(companyId: string, q: SimulateInput) {
    await assertTenantIds(this.repo, companyId, 'partners', [q.fromPartnerId, q.toPartnerId]);
    await assertTenantIds(this.repo, companyId, 'items', q.itemId);
    const date = q.date ?? new Date().toISOString().slice(0, 10);
    let result;
    try {
      result = computeCascade(await this.tenantRules(companyId), {
        fromPartnerId: q.fromPartnerId,
        toPartnerId: emptyToNull(q.toPartnerId),
        itemId: emptyToNull(q.itemId),
        prestationKey: emptyToNull(q.prestationKey),
        basePrice: q.basePrice,
        date,
      });
    } catch (e) {
      if (e instanceof CascadeError) {
        throw new BadRequestException({ message: e.message, code: e.code, details: e.details });
      }
      throw e;
    }
    const partners: Array<{ id: string; name: string; code: string }> = await this.repo.query(
      'SELECT id, name, code FROM partners WHERE company_id = $1',
      [companyId],
    );
    const name = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
    return {
      date,
      prestationKey: emptyToNull(q.prestationKey),
      prestationLabel: prestationLabel(emptyToNull(q.prestationKey)),
      itemId: emptyToNull(q.itemId),
      basePrice: result.basePrice,
      finalPartnerId: result.finalPartnerId,
      finalPartnerName: name(result.finalPartnerId),
      finalAmount: result.finalAmount,
      steps: result.steps.map((s) => ({
        ...s,
        parentPartnerName: name(s.parentPartnerId),
        childPartnerName: name(s.childPartnerId),
      })),
    };
  }
}
