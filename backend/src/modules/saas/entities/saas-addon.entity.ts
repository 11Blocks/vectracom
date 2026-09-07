import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SAAS_ADDON_TYPES } from '../saas-pricing';

/** Option payante activée par un tenant (ia_vision, pre_audit, agent_planning, voice). */
@Entity('saas_addons')
@Unique('uq_saas_addons_company_type', ['companyId', 'addonType'])
export class SaasAddon extends BaseEntity {
  @Column({ type: 'text' })
  addonType!: (typeof SAAS_ADDON_TYPES)[number];

  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  priceMonthly!: string;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Essai gratuit de 7 jours à l'activation. */
  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;
}
