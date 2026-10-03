import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PAYROLL_STATUSES = ['brouillon', 'validee'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/**
 * Feuille de paie d'équipe : répartition du chiffre entre chef et binôme
 * (65/35 par défaut, configurable via team.repartitionChefPct).
 */
@Entity('team_payrolls')
@Unique('uq_team_payroll', ['companyId', 'teamId', 'period'])
@Index(['companyId', 'period'])
export class TeamPayroll extends BaseEntity {
  @Column({ type: 'uuid' })
  teamId!: string;

  @Column({ type: 'text' })
  period!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  revenue!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  chefShare!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  binomeShare!: string;

  @Column({ type: 'uuid', nullable: true })
  chefId: string | null;

  @Column({ type: 'uuid', nullable: true })
  binomeId: string | null;

  @Column({ type: 'text', default: 'brouillon' })
  status!: PayrollStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
