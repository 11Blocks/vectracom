import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Règle de cascade tarifaire multi-niveaux.
 * parentPartner (amont) → childPartner (aval) : le child reçoit
 * `percentage` % du tarif du parent, pour un item donné.
 * Ex. SOFATELCOM → ONECOMIT : 65 % · ONECOMIT → ABC SARL : 80 %.
 * item_id NULL = règle par défaut pour tous les items.
 */
@Entity('pricing_rules')
@Unique('uq_pricing_rule', ['companyId', 'parentPartnerId', 'childPartnerId', 'itemId'])
@Index(['companyId', 'active'])
export class PricingRule extends BaseEntity {
  @Column({ type: 'uuid' })
  parentPartnerId!: string;

  @Column({ type: 'uuid' })
  childPartnerId!: string;

  @Column({ type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  percentage!: string;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ default: true })
  active!: boolean;
}
