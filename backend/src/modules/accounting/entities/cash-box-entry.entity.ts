import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const CASH_BOX_TYPES = ['appro', 'depense', 'remboursement_pret'] as const;
export type CashBoxType = (typeof CASH_BOX_TYPES)[number];

/**
 * Lot P8 — Ligne d'appro caisse par rubrique (document ERP fondateur) :
 * « Appro caisse par rubrique / le carburant / les outils de rechange /
 * les coûts de dépannage par véhicules / coût de prestation des équipes /
 * salaire des journaliers / prêt des équipes ».
 */
@Entity('cash_box_entries')
@Index(['companyId', 'period'])
export class CashBoxEntry extends BaseEntity {
  /** Mois concerné (YYYY-MM). */
  @Column({ type: 'text' })
  period!: string;

  @Column({ type: 'date' })
  entryDate!: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  /** Ligne annulée : conservée pour la traçabilité, exclue des totaux. */
  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  /** Remboursement : prêt d'équipe remboursé. */
  @Column({ type: 'uuid', nullable: true })
  loanEntryId: string | null;

  @Column({ type: 'text' })
  type!: CashBoxType;

  /** Rubrique = catégorie de dépense étendue. */
  @Column({ type: 'text' })
  rubrique!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  /** Bénéficiaire : équipe, journalier, fournisseur… */
  @Column({ type: 'text', nullable: true })
  beneficiary: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  /** Justificatif (reçu photo → dépense liée possible). */
  @Column({ type: 'uuid', nullable: true })
  expenseId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Pour les prêts : retenue progressive sur les prestations. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  repaidAmount!: string;
}
