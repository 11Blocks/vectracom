import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Alerte temps réel : KPI sous son seuil (ouverte jusqu'à résolution). */
@Entity('sonatel_kpi_alerts')
@Index(['companyId', 'kpiName', 'isResolved'])
export class SonatelKpiAlert extends BaseEntity {
  @Column({ type: 'text' })
  kpiName!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  currentValue!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  target!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  gap!: string;

  @Column({ type: 'text' })
  severity!: 'warning' | 'critical';

  @Column({ type: 'timestamptz', default: () => 'now()' })
  alertDate!: Date;

  @Column({ default: false })
  isResolved!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
