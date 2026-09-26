import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';

export const INVOICE_STATUSES = [
  'brouillon',
  'en_correction',
  'finalisee',
  'envoyee',
  'partiellement_payee',
  'payee',
  'annulee',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statuts où lignes, entête et remise restent modifiables. */
export const EDITABLE_INVOICE_STATUSES: InvoiceStatus[] = ['brouillon', 'en_correction'];

/** periodique : générée depuis les missions ; manuelle : lignes libres ; avoir : annulation d'une facture émise. */
export const INVOICE_KINDS = ['periodique', 'manuelle', 'avoir'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export interface InvoiceClientSnapshot {
  name: string;
  ninea?: string | null;
  rccm?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface InvoiceCorrectionEntry {
  at: string;
  by: string | null;
  changes: Array<{
    lineId: string;
    itemType: string;
    field: 'quantity' | 'unitPrice' | 'header' | 'status' | 'payment';
    from: number | string | null;
    to: number | string | null;
    reason?: string;
  }>;
}

/** Facture client du tenant : périodique (missions), manuelle ou avoir. */
@Entity('invoices')
@Index(['companyId', 'invoiceNumber'], { unique: true })
export class Invoice extends BaseEntity {
  /** Numéro provisoire BROUILLON-… jusqu'à la finalisation (numérotation continue). */
  @Column()
  invoiceNumber!: string;

  @Column({ type: 'text', default: 'periodique' })
  kind!: InvoiceKind;

  @Column({ type: 'uuid', nullable: true })
  clientId: string | null;

  /** Coordonnées client figées à la finalisation. */
  @Column({ type: 'jsonb', nullable: true })
  clientSnapshot: InvoiceClientSnapshot | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  /** Taux figé sur la facture (null : taux des Paramètres). */
  @Column({ type: 'numeric', precision: 6, scale: 4, nullable: true })
  tvaRate: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  discountAmount!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  amountPaid!: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  /** Avoir : facture annulée qu'il compense. */
  @Column({ type: 'uuid', nullable: true })
  creditedInvoiceId: string | null;

  @Column({ type: 'integer', default: 0 })
  missionCount!: number;

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
