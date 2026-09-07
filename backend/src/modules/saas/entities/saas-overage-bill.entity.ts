import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Ligne de dépassement facturable (photos, ia, storage, api) pour un mois. */
@Entity('saas_overage_bills')
@Index(['companyId', 'month', 'type'])
export class SaasOverageBill extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'text' })
  type!: 'photos' | 'ia' | 'storage' | 'api';

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  total!: string;

  @Column({ type: 'date' })
  month!: string;
}
