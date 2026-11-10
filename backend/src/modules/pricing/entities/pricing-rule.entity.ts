import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Règle de cascade tarifaire multi-niveaux.
 * parentPartner (amont) → childPartner (aval) : le child reçoit
 * `percentage` % du montant du parent.
 * Ex. SOFATELCOM → ONECOMIT : 65 % · ONECOMIT → ABC SARL : 80 %.
 *
 * Portée de la règle (la plus précise l'emporte) :
 *   prestation_key renseignée > item_id renseigné > règle par défaut (les deux NULL).
 *
 * Unicité : index `uq_pricing_rule_v2` (migration 020) sur
 * (company, parent, child, item, prestation, effective_from) NULLS NOT DISTINCT.
 * Il n'est pas déclaré ici (TypeORM ne sait pas exprimer NULLS NOT DISTINCT ;
 * le schéma est géré par migrations SQL, synchronize = false).
 */
@Entity('pricing_rules')
@Index(['companyId', 'active'])
export class PricingRule extends BaseEntity {
  @Column({ type: 'uuid' })
  parentPartnerId!: string;

  @Column({ type: 'uuid' })
  childPartnerId!: string;

  @Column({ type: 'uuid', nullable: true })
  itemId: string | null;

  /** Prestation au format des factures, ex. « PRODUCTION:survey + installation » (voir prestations.ts). */
  @Column({ type: 'text', nullable: true })
  prestationKey: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  percentage!: string;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ default: true })
  active!: boolean;
}
