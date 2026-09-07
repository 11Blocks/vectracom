import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../auth/entities/user.entity';

/** Token Expo d'un appareil mobile (utilisateur peut en avoir plusieurs). */
@Entity('push_tokens')
@Unique('uq_push_tokens_user_token', ['companyId', 'userId', 'token'])
export class PushToken extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  token!: string;

  @Column({ type: 'text' })
  platform!: 'ios' | 'android' | 'web';

  @Column({ type: 'text', nullable: true })
  deviceId: string | null;

  @Column({ default: true })
  active!: boolean;
}
