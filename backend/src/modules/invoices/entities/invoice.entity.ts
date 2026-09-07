import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';

export const INVOICE_STATUSES = ['brouillon', 'en_correction', 'finalisee', 'envoyee'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceCorrectionEntry {
  at: string;
  by: string | null;
  changes: Array<{
    lineId: string;
    itemType: string;
    field: 'quantity' | 'unitPrice';
    from: number;
    to: number;
    reason?: string;
  }>;
}

/** Facture mensuelle ONECOMIT → SONATEL (bordereau 3STB). */
@Entity('invoices')
@Index(['companyId', 'invoiceNumber'], { unique: true })
export class Invoice extends BaseEntity {
  @Column()
  invoiceNumber!: string;

  @Column({ type: 'date' })
  periodStart!: string;

  @Column({ type: 'date' })
  periodEnd!: string;

  @Column({ type: 'text', default: 'brouillon' })
  status!: InvoiceStatus;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalHt!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalTva!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  totalTtc!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  penaltiesTotal!: string;

  /** Historique complet des corrections applicables. */
  @Column({ type: 'jsonb', default: '[]' })
  corrections!: InvoiceCorrectionEntry[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  generatedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'generated_by' })
  generatedByUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'text', nullable: true })
  excelUrl: string | null;

  @OneToMany('InvoiceLine', 'invoice')
  lines?: unknown[];

  @OneToMany('InvoicePenalty', 'invoice')
  penalties?: unknown[];
}
