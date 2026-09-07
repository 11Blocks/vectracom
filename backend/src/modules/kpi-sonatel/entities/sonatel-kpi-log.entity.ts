import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const KPI_STATUSES = ['atteint', 'non_atteint'] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

/** Un point d'évaluation d'un KPI (une ligne par KPI et par date d'évaluation). */
@Entity('sonatel_kpi_logs')
@Index(['companyId', 'kpiName', 'evaluationDate'], { unique: true })
export class SonatelKpiLog extends BaseEntity {
  @Column({ type: 'text' })
  kpiName!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  target!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  actual!: string;

  @Column({ type: 'text' })
  status!: KpiStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  penaltyAmount!: string;

  /** Date d'évaluation = premier jour du mois évalué. */
  @Column({ type: 'date' })
  evaluationDate!: string;

  /** Famille Optimax (production, curative, preventif, …) pour le regroupement. */
  @Column({ type: 'text', default: 'production' })
  family!: string;

  /** Mode de pénalité : TCO, FORFAIT ou NONE (suivi). */
  @Column({ type: 'text', default: 'TCO' })
  penaltyMode!: string;

  /** Volume d'unités sanctionnées (jours, PBO, équipes, points…). */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitCount!: string;

  @Column({ type: 'jsonb', default: '{}' })
  details!: Record<string, unknown>;
}
