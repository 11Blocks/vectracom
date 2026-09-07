import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const MASTERY_PLAN_STATUSES = ['ouvert', 'en_cours', 'solde'] as const;
export type MasteryPlanStatus = (typeof MASTERY_PLAN_STATUSES)[number];

/**
 * Plan de maîtrise exigé par le contrat : pour chaque ICP non atteint,
 * le prestataire doit produire une analyse et un plan de maîtrise approprié.
 */
@Entity('kpi_mastery_plans')
@Unique('uq_mastery_kpi_period', ['companyId', 'kpiName', 'period'])
@Index(['companyId', 'period'])
export class KpiMasteryPlan extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  kpiName!: string;

  /** Mois évalué, format YYYY-MM. */
  @Column({ type: 'text' })
  period!: string;

  /** Analyse de la non-atteinte (causes racines). */
  @Column({ type: 'text', default: '' })
  analysis!: string;

  /** Actions correctives engagées. */
  @Column({ type: 'text', default: '' })
  actions!: string;

  @Column({ type: 'text', nullable: true })
  responsible: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', default: 'ouvert' })
  status!: MasteryPlanStatus;
}
