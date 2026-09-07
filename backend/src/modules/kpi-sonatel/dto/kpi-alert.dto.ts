/** Alerte KPI temps réel. */
export class KpiAlertDto {
  kpiName!: string;
  currentValue!: number;
  target!: number;
  gap!: number;
  severity!: 'warning' | 'critical';
}
