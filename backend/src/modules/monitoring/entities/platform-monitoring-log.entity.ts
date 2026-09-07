import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const METRIC_TYPES = [
  'cpu',
  'ram',
  'storage',
  'ia_latency',
  'api_latency',
  'api_500_errors',
] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const METRIC_STATUSES = ['ok', 'warning', 'critical'] as const;
export type MetricStatus = (typeof METRIC_STATUSES)[number];

/** Unités : cpu/ram/storage en %, latences en ms, api_500_errors en erreurs/min. */
export const METRIC_THRESHOLDS: Record<MetricType, { warning: number; critical: number; unit: string; label: string }> = {
  cpu: { warning: 70, critical: 85, unit: '%', label: 'CPU' },
  ram: { warning: 80, critical: 90, unit: '%', label: 'RAM' },
  storage: { warning: 75, critical: 85, unit: '%', label: 'Stockage' },
  ia_latency: { warning: 2000, critical: 5000, unit: 'ms', label: 'Latence IA (Gemini)' },
  api_latency: { warning: 500, critical: 1000, unit: 'ms', label: 'Latence API' },
  api_500_errors: { warning: 5, critical: 10, unit: 'err/min', label: 'Erreurs API 500' },
};

/** Point de mesure plateforme (niveau Green-T, hors tenant) + alerte si dépassement. */
@Entity('platform_monitoring_logs')
@Index(['metricType', 'createdAt'])
export class PlatformMonitoringLog extends BaseEntity {
  @Column({ type: 'text' })
  metricType!: MetricType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  value!: string;

  /** Seuil critique de la métrique au moment de la mesure. */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  threshold: string | null;

  @Column({ type: 'text' })
  status!: MetricStatus;

  @Column({ type: 'jsonb', default: '{}' })
  details!: Record<string, unknown>;

  /** Alertes résolues manuellement par Green-T. */
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
