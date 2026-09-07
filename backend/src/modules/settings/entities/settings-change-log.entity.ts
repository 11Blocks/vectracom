import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Journal des modifications du module Paramètres (doc Green-T §6). */
@Entity('settings_change_logs')
@Index(['companyId', 'createdAt'])
export class SettingsChangeLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'text', nullable: true })
  userEmail: string | null;

  @Column({ type: 'text' })
  section!: string;

  @Column({ type: 'text', nullable: true })
  parameter: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: unknown;

  @Column({ type: 'jsonb', nullable: true })
  newValue: unknown;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
