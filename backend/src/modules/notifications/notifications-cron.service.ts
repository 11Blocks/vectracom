import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { InvoiceSaas } from '../saas/invoices-saas/entities/invoice-saas.entity';
import { Company } from '../auth/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

/** Échéances : alerte à J-7, relance J-1 et le jour J. */
const EXPIRY_ALERT_DAYS = [7, 1, 0];
/** Heure d'exécution quotidienne (UTC = heure de Dakar). */
const DAILY_RUN_HOUR_UTC = 7;

type Channel = 'whatsapp' | 'email' | 'in_app';

/**
 * Alertes quotidiennes (échéances véhicules/habilitations, ruptures de stock, relances SaaS).
 * Planifiée chaque jour à 07h00 ; désactivable avec NOTIFICATIONS_CRON=false.
 */
@Injectable()
export class NotificationsCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsCronService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunDay: string | null = null;
  private channelCache = new Map<string, Channel | null>();

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

  onModuleInit() {
    if (process.env.NOTIFICATIONS_CRON === 'false') {
      this.logger.log('Alertes quotidiennes désactivées (NOTIFICATIONS_CRON=false)');
      return;
    }
    this.scheduleNext();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleNext() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_RUN_HOUR_UTC));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    this.timer = setTimeout(() => void this.scheduledRun(), next.getTime() - now.getTime());
    this.timer.unref();
  }

  private async scheduledRun() {
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (this.lastRunDay !== day) {
        this.lastRunDay = day;
        const res = await this.runDaily();
        this.logger.log(`Alertes quotidiennes : ${JSON.stringify(res)}`);
      }
    } catch (err) {
      this.logger.warn(`Alertes quotidiennes échouées : ${(err as Error).message}`);
    } finally {
      this.scheduleNext();
    }
  }

  /** Sans companyId : tous les tenants actifs (planificateur). Avec : ce tenant uniquement (déclenchement manuel). */
  async runDaily(companyId?: string) {
    if (this.running) return { skipped: 'Exécution déjà en cours' };
    this.running = true;
    this.channelCache.clear();
    try {
      const companies = await this.companies(companyId);
      const vehicles = await this.checkVehicleExpirations(companies);
      const habilitations = await this.checkHabilitationExpirations(companies);
      const stock = await this.checkStockThresholds(companies);
      const payments = await this.checkPaymentOverdue(companyId);
      return { vehicles, habilitations, stock, payments };
    } finally {
      this.running = false;
    }
  }

  private async companies(companyId?: string) {
    return this.companyRepository.find({
      where: companyId ? { id: companyId } : { active: true },
      select: ['id', 'name', 'contactEmail'],
    });
  }

  /** Canal externe préféré pour un type : WhatsApp, sinon email, sinon in_app ; null si le type est désactivé. */
  private async pickChannel(companyId: string, type: NotificationType): Promise<Channel | null> {
    const key = companyId + ':' + type;
    if (this.channelCache.has(key)) return this.channelCache.get(key)!;
    let channel: Channel | null = 'in_app';
    try {
      const s = await this.notifications.getSettings(companyId);
      const typeOn: Record<string, boolean> = {
        echeance: s.echeanceEnabled, stock: s.stockAlertEnabled, paiement: s.paymentAlertEnabled,
        incident: s.incidentAlertEnabled, mission_urgente: s.missionUrgentEnabled,
      };
      if (type in typeOn && !typeOn[type]) channel = null;
      else if (s.whatsappEnabled) channel = 'whatsapp';
      else if (s.emailEnabled) channel = 'email';
    } catch {
      // paramètres absents : in_app
    }
    this.channelCache.set(key, channel);
    return channel;
  }

  /** Envoie à un utilisateur ; repli in_app si le canal externe n'a pas de coordonnée. Jamais bloquant. */
  private async notifyUser(
    companyId: string,
    user: Pick<User, 'id' | 'email' | 'phone'>,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
    externalAllowed = true,
  ): Promise<boolean> {
    const preferred = await this.pickChannel(companyId, type);
    if (!preferred) return false;
    let channel: Channel = externalAllowed ? preferred : 'in_app';
    let recipient: string | null = null;
    if (channel === 'email') recipient = user.email || null;
    if (channel === 'whatsapp') recipient = user.phone || null;
    if (channel !== 'in_app' && !recipient) channel = 'in_app';
    try {
      await this.notifications.send({ companyId, type, channel, userId: user.id, recipient, title, body, data });
      return true;
    } catch (err) {
      this.logger.warn(`Notification ${type} non envoyée (${companyId}) : ${(err as Error).message}`);
      return false;
    }
  }

  private daysUntil(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const target = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getTime();
    const today = new Date();
    const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return Math.round((target - start) / 86400000);
  }

  private dueLabel(days: number, verb: string) {
    return days === 0 ? `${verb} AUJOURD'HUI` : days === 1 ? `${verb} demain (J-1)` : `${verb} dans ${days} jours (J-${days})`;
  }

  /** Échéances véhicules (assurance, visite technique) → admin + direction. */
  async checkVehicleExpirations(companies: Pick<Company, 'id'>[]) {
    let sent = 0;
    for (const company of companies) {
      const vehicles = await this.vehicleRepository.find({ where: { companyId: company.id } });
      const managers = await this.notifications.usersByRoles(company.id, ['admin', 'direction']);
      for (const vehicle of vehicles) {
        for (const [field, label] of [
          ['insuranceExpiration', 'assurance'],
          ['technicalInspectionExpiration', 'visite technique'],
        ] as const) {
          const days = this.daysUntil(vehicle[field]);
          if (days === null || !EXPIRY_ALERT_DAYS.includes(days)) continue;
          for (const manager of managers) {
            await this.notifyUser(company.id, manager, 'echeance',
              `Échéance ${label} — ${vehicle.immatriculation}`, this.dueLabel(days, 'Échéance'),
              { vehicleId: vehicle.id, kind: label, daysLeft: days });
          }
          sent++;
        }
      }
    }
    return sent;
  }

  /** Habilitations SST / conduite des techniciens → admin + direction. */
  async checkHabilitationExpirations(companies: Pick<Company, 'id'>[]) {
    let sent = 0;
    for (const company of companies) {
      const technicians = await this.technicianRepository.find({ where: { companyId: company.id } });
      const managers = await this.notifications.usersByRoles(company.id, ['admin', 'direction']);
      for (const technician of technicians) {
        for (const [field, label] of [
          ['habilitationSstExpiration', 'habilitation SST'],
          ['habilitationConduiteExpiration', 'habilitation conduite'],
        ] as const) {
          const days = this.daysUntil(technician[field]);
          if (days === null || !EXPIRY_ALERT_DAYS.includes(days)) continue;
          for (const manager of managers) {
            await this.notifyUser(company.id, manager, 'echeance',
              `${technician.fullName} — ${label}`, this.dueLabel(days, 'Expire'),
              { technicianId: technician.id, kind: label, daysLeft: days });
          }
          sent++;
        }
      }
    }
    return sent;
  }

  /** Ruptures de stock (total sous le seuil) → magasiniers + admin, in_app uniquement. */
  async checkStockThresholds(companies: Pick<Company, 'id'>[]) {
    let sent = 0;
    for (const company of companies) {
      const rows = await this.stockLevelRepository.query(
        `SELECT i.id, i.reference, i.designation, i.threshold_alert, COALESCE(SUM(l.quantity), 0) AS total
         FROM stock_items i LEFT JOIN stock_levels l ON l.stock_item_id = i.id
         WHERE i.company_id = $1
         GROUP BY i.id, i.reference, i.designation, i.threshold_alert
         HAVING COALESCE(SUM(l.quantity), 0) < i.threshold_alert`,
        [company.id],
      );
      if (rows.length === 0) continue;
      const targets = await this.notifications.usersByRoles(company.id, ['magasinier', 'admin']);
      for (const row of rows) {
        for (const target of targets) {
          await this.notifyUser(company.id, target, 'stock',
            `Rupture de stock — ${row.reference}`,
            `${row.designation} : ${row.total} restant (seuil ${row.threshold_alert})`,
            { stockItemId: row.id, total: Number(row.total), threshold: Number(row.threshold_alert) }, false);
        }
        sent++;
      }
    }
    return sent;
  }

  /** Relances abonnement SaaS à J+15 / J+20 / J+30 → admins du tenant (email du profil entreprise si renseigné). */
  async checkPaymentOverdue(companyId?: string) {
    let sent = 0;
    const qb = this.invoiceSaasRepository.createQueryBuilder('i').where("i.status IN ('pending', 'overdue')");
    if (companyId) qb.andWhere('i.company_id = :companyId', { companyId });
    for (const invoice of await qb.getMany()) {
      const late = -(this.daysUntil(invoice.periodEnd) ?? 0);
      if (![15, 20, 30].includes(late)) continue;
      const company = await this.companyRepository.findOne({ where: { id: invoice.companyId! } });
      if (!company) continue;
      const title = `Relance paiement J+${late} — facture ${invoice.invoiceNumber}`;
      const body = `La facture ${invoice.invoiceNumber} (${Number(invoice.totalTtc).toLocaleString('fr-FR')} FCFA TTC) est impayée depuis ${late} jours.${
        late >= 20 ? (late >= 30 ? ' ACCÈS SUSPENDU.' : ' ACCÈS EN LECTURE SEULE.') : ''
      }`;
      const data = { invoiceId: invoice.id, daysLate: late };
      for (const admin of await this.notifications.usersByRoles(company.id, ['admin'])) {
        await this.notifyUser(company.id, admin, 'paiement', title, body, data);
      }
      if (company.contactEmail && (await this.pickChannel(company.id, 'paiement'))) {
        await this.notifications
          .send({ companyId: company.id, type: 'paiement', channel: 'email', recipient: company.contactEmail, title, body, data })
          .catch((err) => this.logger.warn(`Relance email non envoyée : ${(err as Error).message}`));
      }
      sent++;
    }
    return sent;
  }
}
