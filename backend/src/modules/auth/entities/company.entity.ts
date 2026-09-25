import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

export const COMPANY_SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'retard_j1',
  'retard_j15',
  'retard_j20',
  'suspendu',
  'resilie',
] as const;

export type CompanySubscriptionStatus = (typeof COMPANY_SUBSCRIPTION_STATUSES)[number];

/**
 * Un tenant = une entreprise sous-traitante (ex : ONECOMIT/3STB).
 * Green-T n'est PAS un tenant : les comptes console ont company_id null.
 */
@Entity('companies')
@Index(['name'], { unique: true })
export class Company extends BaseEntity {
  @Column()
  name!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'text', nullable: true })
  sonatelSubcontractorName: string | null;

  @Column({ type: 'text', default: 'trial' })
  subscriptionStatus!: CompanySubscriptionStatus;

  @Column({ type: 'date', nullable: true })
  subscriptionStartDate: string | null;

  @Column({ type: 'date', nullable: true })
  subscriptionEndDate: string | null;

  @Column({ type: 'date', nullable: true })
  trialEndDate: string | null;

  @Column({ default: false })
  onboardingPaid!: boolean;

  @Column({ default: false })
  platformFeePaid!: boolean;

  @Column({ type: 'text', nullable: true })
  contactName: string | null;

  @Column({ type: 'text', nullable: true })
  contactEmail: string | null;

  @Column({ type: 'text', nullable: true })
  contactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  ninea: string | null;

  @Column({ type: 'text', nullable: true })
  rccm: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Plafond de comptes utilisateurs actifs (null = illimité). */
  @Column({ type: 'integer', nullable: true })
  maxUsers: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @OneToMany(() => User, (user) => user.company)
  users!: User[];
}
