import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { InvoiceSaas } from './invoice-saas.entity';

/** Mouvement financier SaaS (abonnement, onboarding, redevance annuelle, dépassement). */
@Entity('saas_transactions')
@Index(['companyId', 'invoiceId'])
export class SaasTransaction extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => InvoiceSaas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: InvoiceSaas;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: string;

  @Column({ type: 'text' })
  type!: 'subscription' | 'onboarding' | 'annual_fee' | 'overage';

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  transactionDate!: Date;
}
