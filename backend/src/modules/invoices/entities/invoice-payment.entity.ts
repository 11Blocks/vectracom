import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PAYMENT_METHODS = ['virement', 'cheque', 'especes', 'mobile_money', 'compensation', 'autre'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Encaissement (total ou partiel) d'une facture client. */
@Entity('invoice_payments')
@Index(['companyId', 'invoiceId'])
export class InvoicePayment extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: string;

  @Column({ type: 'date' })
  paidAt!: string;

  @Column({ type: 'text', default: 'virement' })
  method!: PaymentMethod;

  @Column({ type: 'text', nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  recordedBy: string | null;
}
