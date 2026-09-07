import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';

export const INVOICE_SAAS_STATUSES = ['pending', 'paid', 'overdue', 'cancelled'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'mobile_money', 'card'] as const;

/** Facture SaaS Green-T → client (abonnements + options + dépassements). */
@Entity('invoices_saas')
@Unique('uq_invoices_saas_company_number', ['companyId', 'invoiceNumber'])
export class InvoiceSaas extends BaseEntity {
  @Column()
  invoiceNumber!: string;

  @Column({ type: 'date' })
  periodStart!: string;

  @Column({ type: 'date' })
  periodEnd!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalHt!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalTva!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalTtc!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: (typeof INVOICE_SAAS_STATUSES)[number];

  @Column({ type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ type: 'text', nullable: true })
  paymentMethod: (typeof PAYMENT_METHODS)[number] | null;

  @Column({ type: 'text', nullable: true })
  reference: string | null;
}
