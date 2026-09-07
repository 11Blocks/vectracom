import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

/**
 * Pénalité appliquée à la facture, issue des KPI SONATEL non atteints.
 * Branchement réel en Phase 10 (KPI) — la structure est déjà en place.
 */
@Entity('invoice_penalties')
@Index(['companyId', 'invoiceId'])
export class InvoicePenalty extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.penalties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'text' })
  kpiName!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  target!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  actual!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  penaltyAmount!: string;
}
