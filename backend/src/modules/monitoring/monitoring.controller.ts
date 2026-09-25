import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsBooleanString, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';
import { MetricDto } from './dto/metric.dto';
import { METRIC_TYPES } from './entities/platform-monitoring-log.entity';

class MetricsQueryDto {
  @IsOptional() @IsString() @IsIn(METRIC_TYPES as unknown as string[]) metricType?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

class AlertsQueryDto {
  @IsOptional() @IsBooleanString() resolved?: string;
}

@Controller('monitoring')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.ADMIN, UserRole.DIRECTION)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  metrics(@Query() query: MetricsQueryDto) {
    return this.monitoringService.getMetrics(query);
  }

  /** Enregistrement interne (agent de collecte / cron). */
  @Post('metrics')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  record(@Body() dto: MetricDto) {
    return this.monitoringService.recordMetric(dto.metricType, dto.value, dto.details);
  }

  @Get('status')
  status() {
    return this.monitoringService.getCurrentStatus();
  }

  @Get('alerts')
  alerts(@Query() query: AlertsQueryDto) {
    return this.monitoringService.listAlerts(
      query.resolved === undefined ? undefined : query.resolved === 'true',
    );
  }

  @Post('alerts/:id/resolve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  resolve(@Param('id') id: string) {
    return this.monitoringService.resolveAlert(id);
  }

  /** Déclenchement manuel de la collecte (même code que le cron 5 min). */
  @Post('collect')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  collect() {
    return this.monitoringService.collectSystemMetrics();
  }
}
