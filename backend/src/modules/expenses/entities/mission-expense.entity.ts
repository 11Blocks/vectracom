import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const EXPENSE_TYPES = ['carburant', 'repas', 'logement', 'perdiem', 'autre'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

/** Frais de mission : carburant, repas, logement, perdiem… rattachés à une équipe/mission. */
@Entity('mission_expenses')
@Index(['companyId', 'expenseDate'])
export class MissionExpense extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @Column({ type: 'text' })
  expenseType!: ExpenseType;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  expenseDate!: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;
}
