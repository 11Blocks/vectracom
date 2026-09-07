import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SAAS_PLAN_CODES } from '../saas-pricing';

/** Plan de licence SaaS (catalogue Green-T, partagé entre tenants). */
@Entity('saas_plans')
@Unique('uq_saas_plans_code', ['code'])
export class SaasPlan extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  code!: (typeof SAAS_PLAN_CODES)[number];

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  priceMonthly!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  priceAnnual!: string;

  @Column({ type: 'jsonb', default: '{}' })
  features!: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;
}
