import { Injectable, Logger } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

/**
 * Tâches de monitoring plateforme :
 * - toutes les 5 min : collecte système + vérification des seuils
 * - quotidien 01h00 : recalcul des KPI business (délégué au module business)
 */
@Injectable()
export class MonitoringCronService {
  private readonly logger = new Logger(MonitoringCronService.name);

  constructor(private readonly monitoring: MonitoringService) {}

  async runMetricsCollection() {
    const recorded = await this.monitoring.collectSystemMetrics();
    this.logger.log(`Collecte : ${recorded.map((r) => `${r.metricType}=${Number(r.value)}`).join(', ')}`);
    return recorded.map((r) => ({ metricType: r.metricType, value: Number(r.value), status: r.status }));
  }

  async runAlertCheck() {
    return this.monitoring.checkThresholds();
  }
}
