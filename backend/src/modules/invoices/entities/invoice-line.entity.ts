import { Column, Entity, Index, JoinColumn, ManyToOne, ValueTransformer } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

export const INVOICE_CATEGORIES = ['PRODUCTION', 'SAV', 'TS', 'POI', 'INFRA', 'GC', 'AUTRE'] as const;
export type InvoiceCategory = (typeof INVOICE_CATEGORIES)[number];

/** numeric PostgreSQL (renvoyé en texte par pg) exposé en number. */
const decimalNumber: ValueTransformer = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v === null || v === undefined ? null : Number(v)),
};

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

  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0, transformer: decimalNumber })
  quantity!: number;

  @Column({ type: 'text', nullable: true })
  unit: string | null;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  total!: string;

  @Column({ default: false })
  isCorrected!: boolean;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true, transformer: decimalNumber })
  originalQuantity: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  originalUnitPrice: string | null;

  @Column({ type: 'text', nullable: true })
  correctionReason: string | null;
}
