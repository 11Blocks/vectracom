import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Activation des canaux et des 5 types — un jeu par tenant. */
@Entity('notification_settings')
@Unique('uq_notification_settings_company', ['companyId'])
export class NotificationSetting extends BaseEntity {
  @Column({ default: true })
  pushEnabled!: boolean;

  @Column({ default: true })
  whatsappEnabled!: boolean;

  @Column({ default: true })
  emailEnabled!: boolean;

  @Column({ default: true })
  inAppEnabled!: boolean;

  /** Ajout à la demande de Green-T : canal Telegram. */
  @Column({ default: false })
  telegramEnabled!: boolean;

  @Column({ default: true })
  missionUrgentEnabled!: boolean;

  @Column({ default: true })
  echeanceEnabled!: boolean;

  @Column({ default: true })
  stockAlertEnabled!: boolean;

  @Column({ default: true })
  incidentAlertEnabled!: boolean;

  @Column({ default: true })
  paymentAlertEnabled!: boolean;
}
