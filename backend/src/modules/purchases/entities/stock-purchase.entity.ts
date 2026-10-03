import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PURCHASE_STATUSES = ['en_attente', 'valide_sonatel', 'refuse', 'facture'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * Achat de matériel manquant par ONECOMIT — exige la validation SONATEL
 * avant facturation au donneur d'ordre (contrat : SONATEL fournit, sinon
 * rembourse un achat validé).
 */
@Entity('stock_purchases')
@Index(['companyId', 'status'])
export class StockPurchase extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  stockItemId: string | null;

  @Column({ type: 'text' })
  designation!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitCost!: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', default: 'en_attente' })
  status!: PurchaseStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sonatelValidatedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;
}
