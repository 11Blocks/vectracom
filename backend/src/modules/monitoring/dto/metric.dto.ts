import { IsIn, IsNumber, IsObject, IsOptional, Min } from 'class-validator';
import { METRIC_TYPES } from '../entities/platform-monitoring-log.entity';

export class MetricDto {
  @IsIn(METRIC_TYPES as unknown as string[])
  metricType!: string;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
