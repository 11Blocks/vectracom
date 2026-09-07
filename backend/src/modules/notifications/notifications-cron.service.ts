import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { InvoiceSaas } from '../saas/invoices-saas/entities/invoice-saas.entity';
import { Company } from '../auth/entities/company.entity';
import { NotificationsService } from './notifications.service';

/** Fenêtre d'alerte des échéances : J-7 puis relance J-1. */
const EXPIRY_WINDOW_DAYS = 7;

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(InvoiceSaas)
    private readonly invoiceSaasRepository: Repository<InvoiceSaas>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly notifications: NotificationsService,
  ) {}

  /** Quotidien 07h00 : toutes les vérifications. */
  /** Canal préféré pour un type : WhatsApp si activé, sinon email, sinon in_app. */
  private channelCache = new Map<string, any>();
  private async pickChannel(companyId: string, type: string): Promise<'whatsapp' | 'email' | 'in_app'> {
    const key = companyId + ':' + type;
    if (this.channelCache.has(key)) return this.channelCache.get(key);
    let channel: 'whatsapp' | 'email' | 'in_app' = 'in_app';
    try {
      const settings = await this.notifications.getSettings(companyId);
      if (settings?.whatsappEnabled && settings?.echeanceEnabled) channel = 'whatsapp';
      else if (settings?.emailEnabled && settings?.echeanceEnabled) channel = 'email';
    } catch {
      // settings absents : in_app silencieux
    }
    this.channelCache.set(key, channel);
    return channel;
  }

  async runDaily() {
    const [vehicles, habilitations, stock, payments] = await Promise.all([
      this.checkVehicleExpirations(),
      this.checkHabilitationExpirations(),
      this.checkStockThresholds(),
      this.checkPaymentOverdue(),
    ]);
    return { vehicles, habilitations, stock, payments };
  }

  private async activeCompanies() {
    return this.companyRepository.find({ where: { active: true }, select: ['id', 'name'] });
  }

  private daysUntil(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const target = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getTime();
    const today = new Date();
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return Math.round((target - start) / 86400000);
  }

  /** Échéances véhicules (assurance, visite technique) à J-7..J+0 → managers. */
  async checkVehicleExpirations() {
    let sent = 0;
    for (const company of await this.activeCompanies()) {
      const vehicles = await this.vehicleRepository.find({ where: { companyId: company.id } });
      const managers = await this.notifications.usersByRoles(company.id, ['admin', 'direction']);
      for (const vehicle of vehicles) {
        for (const [field, label] of [
          ['insuranceExpiration', 'assurance'],
          ['technicalInspectionExpiration', 'visite technique'],
        ] as const) {
          const days = this.daysUntil(vehicle[field]);
          if (days !== null && days >= 0 && days <= EXPIRY_WINDOW_DAYS) {
            for (const manager of managers) {
              await this.notifications.send({
                companyId: company.id,
                type: 'echeance',
                channel: await this.pickChannel(company.id, 'echeance'),
                userId: manager.id,
                title: `Échéance ${label} — ${vehicle.immatriculation}`,
                body: days === 0 ? "Échéance AUJOURD'HUI" : days === 1 ? 'Échéance demain (J-1)' : `Échéance dans ${days} jours (J-${days})`,
                data: { vehicleId: vehicle.id, kind: label, daysLeft: days },
              });
            }
            sent++;
          }
        }
      }
    }
    if (sent > 0) this.logger.warn(`Échéances véhicules : ${sent} alerte(s)`);
    return sent;
  }

  /** Habilitations SST/conduite des techniciens à J-7..J+0. */
  async checkHabilitationExpirations() {
    let sent = 0;
    for (const company of await this.activeCompanies()) {
      const technicians = await this.technicianRepository.find({ where: { companyId: company.id } });
      const managers = await this.notifications.usersByRoles(company.id, ['admin', 'direction']);
      for (const technician of technicians) {
        for (const [field, label] of [
          ['habilitationSstExpiration', 'habilitation SST'],
          ['habilitationConduiteExpiration', 'habilitation conduite'],
        ] as const) {
          const days = this.daysUntil(technician[field]);
          if (days !== null && days >= 0 && days <= EXPIRY_WINDOW_DAYS) {
            for (const manager of managers) {
              await this.notifications.send({
                companyId: company.id,
                type: 'echeance',
                channel: await this.pickChannel(company.id, 'echeance'),
                userId: manager.id,
                title: `${technician.fullName} — ${label}`,
                body: days === 0 ? "Expire AUJOURD'HUI" : days === 1 ? 'Expire demain (J-1)' : `Expire dans ${days} jours (J-${days})`,
                data: { technicianId: technician.id, kind: label, daysLeft: days },
              });
            }
            sent++;
          }
        }
      }
    }
    if (sent > 0) this.logger.warn(`Habilitations : ${sent} alerte(s)`);
    return sent;
  }

  /** Ruptures de stock (total sous le seuil) → magasiniers. */
  async checkStockThresholds() {
    let sent = 0;
    for (const company of await this.activeCompanies()) {
      const rows = await this.stockLevelRepository.query(
        `SELECT i.id, i.reference, i.designation, i.threshold_alert, COALESCE(SUM(l.quantity), 0) AS total
         FROM stock_items i LEFT JOIN stock_levels l ON l.stock_item_id = i.id
         WHERE i.company_id = $1
         GROUP BY i.id, i.reference, i.designation, i.threshold_alert
         HAVING COALESCE(SUM(l.quantity), 0) < i.threshold_alert`,
        [company.id],
      );
      if (rows.length === 0) continue;
      const magasiniers = await this.notifications.usersByRoles(company.id, ['magasinier', 'admin']);
      const targets = magasiniers.length > 0 ? magasiniers : await this.notifications.usersByRoles(company.id, ['admin']);
      for (const row of rows) {
        for (const target of targets) {
          await this.notifications.send({
            companyId: company.id,
            type: 'stock',
            channel: 'in_app',
            userId: target.id,
            title: `Rupture de stock — ${row.reference}`,
            body: `${row.designation} : ${row.total} restant (seuil ${row.threshold_alert})`,
            data: { stockItemId: row.id, total: Number(row.total), threshold: Number(row.threshold_alert) },
          });
        }
        sent++;
      }
    }
    if (sent > 0) this.logger.warn(`Ruptures de stock : ${sent} référence(s)`);
    return sent;
  }

  /** Relances paiement SaaS : J+15, J+20, J+30 → email + WhatsApp au client. */
  async checkPaymentOverdue() {
    let sent = 0;
    const invoices = await this.invoiceSaasRepository
      .createQueryBuilder('i')
      .where("i.status IN ('pending', 'overdue')")
      .getMany();
    for (const invoice of invoices) {
      const late = -(this.daysUntil(invoice.periodEnd) ?? 0);
      if (![15, 20, 30].includes(late)) continue;
      const company = await this.companyRepository.findOne({ where: { id: invoice.companyId! } });
      if (!company) continue;
      await this.notifications.send({
        companyId: company.id,
        type: 'paiement',
        channel: 'email',
        recipient: `facturation@${company.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.sn`,
        title: `Relance paiement J+${late} — facture ${invoice.invoiceNumber}`,
        body: `La facture ${invoice.invoiceNumber} (${Number(invoice.totalTtc).toLocaleString('fr-FR')} FCFA TTC) est impayée depuis ${late} jours.${
          late >= 20 ? late >= 30 ? ' ACCÈS SUSPENDU.' : ' ACCÈS EN LECTURE SEULE.' : ''
        }`,
        data: { invoiceId: invoice.id, daysLate: late },
      });
      sent++;
    }
    if (sent > 0) this.logger.warn(`Relances paiement : ${sent} facture(s)`);
    return sent;
  }
}
