import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationChannel, NotificationType } from './entities/notification.entity';
import { NotificationSetting } from './entities/notification-settings.entity';
import { PushToken } from './entities/push-token.entity';
import { User } from '../auth/entities/user.entity';
import { ExpoService } from './integrations/expo.service';
import { WhatsAppService } from './integrations/whatsapp.service';
import { EmailService } from './integrations/email.service';
import { TelegramService } from './integrations/telegram.service';

export interface SendNotificationInput {
  companyId: string;
  type: NotificationType | 'test';
  channel: NotificationChannel;
  userId?: string | null;
  /** Destinataire externe (téléphone WhatsApp, email, chatId Telegram). */
  recipient?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Dispatch multi-canal : trace chaque notification (réelle ou simulée). */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationSetting)
    private readonly settingsRepository: Repository<NotificationSetting>,
    @InjectRepository(PushToken)
    private readonly tokenRepository: Repository<PushToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly expo: ExpoService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
  ) {}

  async send(input: SendNotificationInput) {
    const settings = await this.getSettings(input.companyId);
    this.assertChannelEnabled(settings, input.channel);
    this.assertTypeEnabled(settings, input.type);

    let delivery: { status: 'sent' | 'simulated' | 'failed'; detail: string } = { status: 'simulated', detail: 'in-app' };
    if (input.channel === 'push') {
      const tokens = input.userId
        ? (await this.tokenRepository.find({ where: { companyId: input.companyId, userId: input.userId, active: true } }))
            .map((t) => t.token)
        : [];
      delivery = await this.expo.sendPush(tokens, input.title, input.body, input.data);
    } else if (input.channel === 'whatsapp') {
      if (!input.recipient) throw new BadRequestException('Destinataire WhatsApp requis (téléphone)');
      delivery = await this.whatsapp.sendMessage(input.recipient, `${input.title}\n${input.body}`);
    } else if (input.channel === 'email') {
      if (!input.recipient) throw new BadRequestException('Destinataire email requis');
      delivery = await this.email.sendEmail(input.recipient, input.title, input.body);
    } else if (input.channel === 'telegram') {
      if (!input.recipient) throw new BadRequestException('chatId Telegram requis');
      delivery = await this.telegram.sendMessage(input.recipient, `${input.title}\n${input.body}`);
    }

    return this.notificationRepository.save(
      this.notificationRepository.create({
        companyId: input.companyId,
        userId: input.userId ?? null,
        type: input.type,
        channel: input.channel,
        title: input.title,
        body: input.body,
        data: { ...(input.data ?? {}), deliveryDetail: delivery.detail },
        status: delivery.status,
        recipient: input.recipient ?? null,
      }),
    );
  }

  list(companyId: string, userId: string, filters: { unreadOnly?: boolean }) {
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.company_id = :companyId AND n.user_id = :userId', { companyId, userId })
      .orderBy('n.createdAt', 'DESC')
      .take(200);
    if (filters.unreadOnly) qb.andWhere('n.read_at IS NULL');
    return qb.getMany();
  }

  async markAsRead(companyId: string, userId: string, id: string) {
    const notification = await this.notificationRepository.findOne({ where: { companyId, userId, id } });
    if (!notification) throw new NotFoundException('Notification introuvable');
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(companyId: string, userId: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('company_id = :companyId AND user_id = :userId AND read_at IS NULL', { companyId, userId })
      .execute();
    return { ok: true };
  }

  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    return this.notificationRepository.createQueryBuilder('n')
      .where('n.company_id = :companyId AND n.user_id = :userId AND n.read_at IS NULL', { companyId, userId })
      .getCount();
  }

  // ------------------- Paramètres -------------------

  async getSettings(companyId: string) {
    let settings = await this.settingsRepository.findOne({ where: { companyId } });
    if (!settings) {
      // Idempotent : une contrainte unique protège la création concurrente.
      await this.settingsRepository.insert({ companyId }).catch(() => undefined);
      settings = await this.settingsRepository.findOne({ where: { companyId } });
    }
    return settings!;
  }

  async updateSettings(companyId: string, dto: Partial<NotificationSetting>) {
    const settings = await this.getSettings(companyId);
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }

  // ------------------- Push tokens -------------------

  async registerPush(companyId: string, userId: string, dto: { token: string; platform: string; deviceId?: string }) {
    const existing = await this.tokenRepository.findOne({
      where: { companyId, userId, token: dto.token },
    });
    if (existing) {
      existing.active = true;
      existing.platform = dto.platform as never;
      existing.deviceId = dto.deviceId ?? existing.deviceId;
      return this.tokenRepository.save(existing);
    }
    return this.tokenRepository.save(
      this.tokenRepository.create({
        companyId,
        userId,
        token: dto.token,
        platform: dto.platform as never,
        deviceId: dto.deviceId ?? null,
      }),
    );
  }

  async unregisterPush(companyId: string, userId: string, token: string) {
    const existing = await this.tokenRepository.findOne({ where: { companyId, userId, token } });
    if (!existing) throw new NotFoundException('Token introuvable');
    existing.active = false;
    return this.tokenRepository.save(existing);
  }

  userContact(companyId: string, userId: string) {
    return this.userRepository.findOne({ where: { companyId, id: userId }, select: ['id', 'email', 'phone'] });
  }

  /** Utilisateurs à notifier selon le rôle (managers pour les échéances, magasiniers pour le stock). */
  async usersByRoles(companyId: string, roles: string[]) {
    return this.userRepository
      .createQueryBuilder('u')
      .where('u.company_id = :companyId AND u.active = true', { companyId })
      .andWhere('u.role IN (:...roles)', { roles })
      .getMany();
  }

  private assertChannelEnabled(settings: NotificationSetting, channel: NotificationChannel) {
    const enabled =
      (channel === 'push' && settings.pushEnabled) ||
      (channel === 'whatsapp' && settings.whatsappEnabled) ||
      (channel === 'email' && settings.emailEnabled) ||
      (channel === 'telegram' && settings.telegramEnabled) ||
      channel === 'in_app';
    if (!enabled) throw new BadRequestException(`Canal ${channel} désactivé dans les paramètres du tenant`);
  }

  private assertTypeEnabled(settings: NotificationSetting, type: NotificationType | 'test') {
    const map: Record<string, boolean> = {
      mission_urgente: settings.missionUrgentEnabled,
      echeance: settings.echeanceEnabled,
      stock: settings.stockAlertEnabled,
      incident: settings.incidentAlertEnabled,
      paiement: settings.paymentAlertEnabled,
      chat: true,
      test: true,
    };
    if (type in map && !map[type]) throw new BadRequestException(`Type ${type} désactivé dans les paramètres du tenant`);
  }
}
