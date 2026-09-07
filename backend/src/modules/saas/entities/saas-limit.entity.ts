import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Seuils d'usage d'un tenant (base ou premium) — un seul jeu par tenant. */
@Entity('saas_limits')
@Unique('uq_saas_limits_company', ['companyId'])
export class SaasLimit extends BaseEntity {
  @Column({ type: 'text', default: 'base' })
  planType!: 'base' | 'premium';

  @Column({ type: 'integer', default: 10000 })
  maxPhotosPerMonth!: number;

  @Column({ type: 'integer', default: 100 })
  maxIaRequestsPerMonth!: number;

  @Column({ type: 'integer', default: 10 })
  maxStorageGb!: number;

  @Column({ type: 'integer', default: 500 })
  maxApiRequestsPerDay!: number;
}
