import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../auth/entities/company.entity';
import { KpiSonatelService } from './kpi-sonatel.service';

/**
 * Tâches KPI :
 * - quotidien 07h00 : recalcul des KPI du mois courant + vérification alertes
 * - 1er du mois : recalcul final du mois écoulé (base du rapport et pénalités)
 * L'ordonnanceur (Phase 13) appellera runDaily()/runMonthly().
 */
@Injectable()
export class KpiSonatelCronService {
  private readonly logger = new Logger(KpiSonatelCronService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly kpiService: KpiSonatelService,
  ) {}

  static currentMonth(now = new Date()): string {
    return now.toISOString().slice(0, 7);
  }

  static previousMonth(now = new Date()): string {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  }

  async runDaily(now = new Date()): Promise<Record<string, unknown>[]> {
    return this.recalculateForCompanies(KpiSonatelCronService.currentMonth(now), now);
  }

  async runMonthly(now = new Date()): Promise<Record<string, unknown>[]> {
    return this.recalculateForCompanies(KpiSonatelCronService.previousMonth(now), now);
  }

  private async recalculateForCompanies(period: string, now: Date): Promise<Record<string, unknown>[]> {
    const companies = await this.companyRepository.find({ where: { active: true }, select: ['id', 'name'] });
    const results: Record<string, unknown>[] = [];
    for (const company of companies) {
      try {
        const logs = await this.kpiService.calculateAll(company.id, period);
        const alerts = await this.kpiService.checkAlerts(company.id, period);
        results.push({
          company: company.name,
          period,
          nonAtteints: logs.filter((l) => l.status === 'non_atteint').length,
          newAlerts: alerts.length,
          at: now.toISOString(),
        });
      } catch (err) {
        this.logger.error(`KPI ${period} échoués pour ${company.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return results;
  }
}
