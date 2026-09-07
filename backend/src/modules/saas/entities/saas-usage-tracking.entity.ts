import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Compteurs d'usage mensuels d'un tenant (photos, IA, stockage, API). */
@Entity('saas_usage_tracking')
@Unique('uq_saas_usage_company_month', ['companyId', 'month'])
export class SaasUsageTracking extends BaseEntity {
  /** Premier jour du mois suivi. */
  @Column({ type: 'date' })
  month!: string;

  @Column({ type: 'integer', default: 0 })
  photosCount!: number;

  @Column({ type: 'integer', default: 0 })
  iaRequests!: number;

  @Column({ type: 'integer', default: 0 })
  storageUsedMb!: number;

  @Column({ type: 'integer', default: 0 })
  apiRequests!: number;
}
