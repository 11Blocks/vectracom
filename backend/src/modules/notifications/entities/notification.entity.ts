import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Les 5 seules notifications actives du cahier des charges. */
export const NOTIFICATION_TYPES = [
  'mission_urgente',
  'echeance',
  'stock',
  'incident',
  'paiement',
  'chat',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['push', 'whatsapp', 'email', 'in_app', 'telegram'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['sent', 'simulated', 'failed'] as const;

/**
 * Principe directeur : une notification ne part que si elle exige une action
 * immédiate (perte d'argent, amende, blocage).
 */
@Entity('notifications')
@Index('idx_notifications_user_read', ['companyId', 'userId', 'readAt'])
export class Notification extends BaseEntity {
  /** null pour les notifications externes (relance paiement au client). */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'text' })
  type!: NotificationType | 'test';

  @Column({ type: 'text' })
  channel!: NotificationChannel;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', default: '{}' })
  data!: Record<string, unknown>;

  /** sent : réel, simulated : identifiants absents (dev), failed : erreur. */
  @Column({ type: 'text', default: 'simulated' })
  status!: (typeof NOTIFICATION_STATUSES)[number];

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /** Destinataires externes (téléphone, email, chat Telegram). */
  @Column({ type: 'text', nullable: true })
  recipient: string | null;
}
