import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

export const INVOICE_CATEGORIES = ['PRODUCTION', 'SAV', 'TS', 'POI', 'INFRA', 'GC'] as const;
export type InvoiceCategory = (typeof INVOICE_CATEGORIES)[number];

/** Ligne de facture : un type d'item regroupé (ex. « Survey », 266 u à 3 250 FCFA). */
@Entity('invoice_lines')
@Index(['companyId', 'invoiceId'])
export class InvoiceLine extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'text' })
  category!: InvoiceCategory;

  @Column({ type: 'text' })
  itemType!: string;

  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total!: string;

  @Column({ default: false })
  isCorrected!: boolean;

  @Column({ type: 'integer', nullable: true })
  originalQuantity: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  originalUnitPrice: string | null;

  @Column({ type: 'text', nullable: true })
  correctionReason: string | null;
}
