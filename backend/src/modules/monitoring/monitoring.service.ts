import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import {
  METRIC_THRESHOLDS,
  METRIC_TYPES,
  MetricStatus,
  MetricType,
  PlatformMonitoringLog,
} from './entities/platform-monitoring-log.entity';

const SEVERITY_ORDER: Record<MetricStatus, number> = { ok: 0, warning: 1, critical: 2 };

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(PlatformMonitoringLog)
    private readonly logRepository: Repository<PlatformMonitoringLog>,
    private readonly dataSource: DataSource,
  ) {}

  /** Enregistre une mesure, calcule son statut par seuils, alerte si besoin. */
  async recordMetric(metricType: string, value: number, details?: Record<string, unknown>) {
    this.assertMetricType(metricType);
    const thresholds = METRIC_THRESHOLDS[metricType as MetricType];
    const status: MetricStatus =
      value >= thresholds.critical ? 'critical' : value >= thresholds.warning ? 'warning' : 'ok';

    const log = await this.logRepository.save(
      this.logRepository.create({
        companyId: null,
        metricType: metricType as MetricType,
        value: String(value),
        threshold: String(thresholds.critical),
        status,
        details: {
          ...details,
          warning: thresholds.warning,
          critical: thresholds.critical,
          unit: thresholds.unit,
          label: thresholds.label,
        },
      }),
    );

    if (status !== 'ok') {
      this.logger.warn(
        `Alerte plateforme ${thresholds.label} : ${value}${thresholds.unit} (${status}, seuils ${thresholds.warning}/${thresholds.critical})`,
      );
    }
    return log;
  }

  async getMetrics(filters: { metricType?: string; from?: string; to?: string }) {
    if (filters.metricType) this.assertMetricType(filters.metricType);
    const qb = this.logRepository
      .createQueryBuilder('m')
      .where('1=1')
      .orderBy('m.createdAt', 'DESC')
      .take(500);
    if (filters.metricType) qb.andWhere('m.metric_type = :type', { type: filters.metricType });
    if (filters.from) qb.andWhere('m.created_at >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('m.created_at <= :to', { to: new Date(filters.to) });
    return qb.getMany();
  }

  /** Statut actuel : dernière mesure par métrique + pire statut global. */
  async getCurrentStatus() {
    const latest = new Map<string, PlatformMonitoringLog>();
    for (const type of METRIC_TYPES) {
      const log = await this.logRepository.findOne({
        where: { metricType: type },
        order: { createdAt: 'DESC' },
      });
      if (log) latest.set(type, log);
    }
    const metrics = [...latest.values()].map((log) => ({
      metricType: log.metricType,
      label: (log.details as Record<string, unknown>)?.label ?? log.metricType,
      value: Number(log.value),
      unit: (log.details as Record<string, unknown>)?.unit ?? '',
      status: log.status,
      measuredAt: log.createdAt,
    }));
    const global: MetricStatus | 'unknown' = metrics.length
      ? (metrics.reduce((worst, m) =>
          SEVERITY_ORDER[m.status as MetricStatus] > SEVERITY_ORDER[worst.status as MetricStatus] ? m : worst,
        ).status as MetricStatus)
      : 'unknown';
    const openAlerts = await this.listAlerts(false);
    return { global, metrics, openAlerts: openAlerts.length };
  }

  /** Alertes ouvertes (warning/critical non résolues) ou résolues. */
  async listAlerts(resolved?: boolean) {
    const qb = this.logRepository
      .createQueryBuilder('m')
      .where("m.status <> 'ok'")
      .orderBy('m.createdAt', 'DESC');
    if (resolved === false) qb.andWhere('m.resolved_at IS NULL');
    if (resolved === true) qb.andWhere('m.resolved_at IS NOT NULL');
    const logs = await qb.getMany();
    return logs.map((log) => ({
      id: log.id,
      type: log.metricType,
      label: (log.details as Record<string, unknown>)?.label ?? log.metricType,
      status: log.status,
      value: Number(log.value),
      threshold: log.threshold ? Number(log.threshold) : null,
      unit: (log.details as Record<string, unknown>)?.unit ?? '',
      resolved: Boolean(log.resolvedAt),
      createdAt: log.createdAt,
    }));
  }

  async resolveAlert(id: string) {
    const log = await this.logRepository.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Alerte introuvable');
    if (log.status === 'ok') throw new BadRequestException('Cette mesure n\'est pas une alerte');
    if (log.resolvedAt) throw new BadRequestException('Alerte déjà résolue');
    log.resolvedAt = new Date();
    return this.logRepository.save(log);
  }

  /**
   * Vérification des seuils (cron 5 min) : recale le statut des dernières
   * mesures et retourne les alertes ouvertes. La collecte système réelle est
   * assurée par collectSystemMetrics (os) ou un agent externe via POST.
   */
  async checkThresholds() {
    const alerts = await this.listAlerts(false);
    return { checked: METRIC_TYPES.length, openAlerts: alerts.length, alerts };
  }

  /** Collecte système best-effort (CPU load, RAM, stockage disque, aller-retour base). */
  async collectSystemMetrics() {
    const cpus = os.cpus().length;
    const load = os.loadavg()[0]; // ~1 min ; toujours 0 sous Windows
    const cpuPercent = Math.min(100, Math.round((load / cpus) * 100));
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const recorded: PlatformMonitoringLog[] = [];
    recorded.push(await this.recordMetric('cpu', cpuPercent, { source: 'os.loadavg', cores: cpus }));
    recorded.push(await this.recordMetric('ram', ramPercent, { source: 'os.freemem', totalGb: Math.round(totalMem / 1024 ** 3) }));

    try {
      const fsStat = await statfs(process.cwd());
      const total = fsStat.blocks * fsStat.bsize;
      const free = fsStat.bavail * fsStat.bsize;
      if (total > 0) {
        recorded.push(await this.recordMetric('storage', Math.round(((total - free) / total) * 100), {
          source: 'fs.statfs', totalGb: Math.round(total / 1024 ** 3), freeGb: Math.round(free / 1024 ** 3),
        }));
      }
    } catch (err) {
      this.logger.debug(`Stockage non mesurable : ${(err as Error).message}`);
    }

    const started = Date.now();
    await this.dataSource.query('SELECT 1');
    recorded.push(await this.recordMetric('api_latency', Date.now() - started, { source: 'db_ping' }));
    return recorded;
  }

  /** Purge des mesures « ok » anciennes (les alertes sont conservées). */
  async purgeOldMetrics(retentionDays = 30) {
    const res = await this.logRepository
      .createQueryBuilder()
      .delete()
      .where("status = 'ok'")
      .andWhere('created_at < now() - make_interval(days => :days)', { days: retentionDays })
      .execute();
    return res.affected ?? 0;
  }

  private assertMetricType(metricType: string): asserts metricType is MetricType {
    if (!(METRIC_TYPES as readonly string[]).includes(metricType)) {
      throw new BadRequestException(`Métrique inconnue : ${metricType}`);
    }
  }
}
