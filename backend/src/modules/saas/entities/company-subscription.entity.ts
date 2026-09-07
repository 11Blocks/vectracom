import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';
import { SAAS_PLAN_CODES } from '../saas-pricing';

/** Licence attribuée à un utilisateur (une active par utilisateur). */
@Entity('company_subscriptions')
@Index(['companyId', 'userId', 'status'])
export class CompanySubscription extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  planCode!: (typeof SAAS_PLAN_CODES)[number];

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'suspended' | 'cancelled' | 'expired';

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', default: 'monthly' })
  billingCycle!: 'monthly' | 'annual';

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;
}
