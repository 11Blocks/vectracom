import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;
const PURGE_EVERY_N_RUNS = 288; // ~1 fois par jour à 5 min

/**
 * Tâches de monitoring plateforme :
 * - toutes les 5 min (MONITORING_INTERVAL_MS) : collecte système + vérification des seuils
 * - ~quotidien : purge des mesures « ok » de plus de 30 jours
 * Désactivable avec MONITORING_COLLECT=false.
 */
@Injectable()
export class MonitoringCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private firstRun: NodeJS.Timeout | null = null;
  private runs = 0;
  private running = false;

  constructor(
    private readonly monitoring: MonitoringService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('MONITORING_COLLECT') === 'false') {
      this.logger.log('Collecte monitoring désactivée (MONITORING_COLLECT=false)');
      return;
    }
    const interval = Number(this.config.get<string>('MONITORING_INTERVAL_MS')) || DEFAULT_INTERVAL_MS;
    this.firstRun = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), interval);
    this.firstRun.unref();
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runMetricsCollection();
      if (++this.runs % PURGE_EVERY_N_RUNS === 0) {
        const purged = await this.monitoring.purgeOldMetrics();
        if (purged) this.logger.log(`Purge monitoring : ${purged} mesure(s) supprimée(s)`);
      }
    } catch (err) {
      this.logger.warn(`Collecte monitoring échouée : ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runMetricsCollection() {
    const recorded = await this.monitoring.collectSystemMetrics();
    this.logger.debug(`Collecte : ${recorded.map((r) => `${r.metricType}=${Number(r.value)}`).join(', ')}`);
    return recorded.map((r) => ({ metricType: r.metricType, value: Number(r.value), status: r.status }));
  }

  async runAlertCheck() {
    return this.monitoring.checkThresholds();
  }
}
