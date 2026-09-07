import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../auth/entities/company.entity';
import { InvoicesService } from './invoices.service';
import { KpiSonatelService } from '../kpi-sonatel/kpi-sonatel.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Génération automatique du 1er du mois pour chaque tenant actif.
 * L'orchestrateur de crons (Phase 13) appellera run() ; sans dépendance
 * @nestjs/schedule pour l'instant, la méthode est prête et testable.
 */
@Injectable()
export class InvoicesCronService {
  private readonly logger = new Logger(InvoicesCronService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => KpiSonatelService))
    private readonly kpiService: KpiSonatelService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Mois précédent en période de facturation. */
  static previousMonth(now = new Date()): { periodStart: string; periodEnd: string } {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
  }

  async run(): Promise<{ company: string; invoice?: string; penalties?: number; skipped?: string }[]> {
    const { periodStart, periodEnd } = InvoicesCronService.previousMonth();
    const period = periodStart.slice(0, 7);
    const companies = await this.companyRepository.find({ where: { active: true }, select: ['id', 'name'] });
    const results: Array<{ company: string; invoice?: string; penalties?: number; skipped?: string }> = [];

    for (const company of companies) {
      try {
        const invoice = await this.invoicesService.generate(company.id, { periodStart, periodEnd }, null);
        results.push({ company: company.name, invoice: invoice.invoiceNumber });
        this.logger.log(`Facture auto ${invoice.invoiceNumber} générée pour ${company.name}`);

        // Pénalités KPI du mois facturé : recalcul puis application à la facture.
        try {
          await this.kpiService.calculateAll(company.id, period);
          const applied = await this.kpiService.calculatePenalties(company.id, period, invoice.id);
          results[results.length - 1].penalties = applied.total;
        } catch (err) {
          this.logger.warn(`Pénalités KPI non appliquées pour ${company.name}: ${err instanceof Error ? err.message : err}`);
        }

        // Notification silencieuse (in-app) — jamais bloquante.
        try {
          await this.notificationsService.send({
            companyId: company.id,
            type: 'paiement',
            channel: 'in_app',
            title: `Facture ${invoice.invoiceNumber} générée`,
            body: `Brouillon automatique pour ${period} (période ${periodStart} → ${periodEnd}). Pénalités KPI appliquées le cas échéant.`,
            data: { invoiceId: invoice.id, period, source: 'cron' },
          });
        } catch {
          // Canal désactivé ou type d'alerte masqué : silencieux.
        }
      } catch (err) {
        // Facture existante ou période vide : silencieux, tracé.
        const reason = err instanceof Error ? err.message : String(err);
        results.push({ company: company.name, skipped: reason });
      }
    }
    return results;
  }
}
