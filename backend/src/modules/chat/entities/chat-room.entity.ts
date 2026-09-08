import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const CHAT_ROOM_KINDS = ['remontee', 'team', 'mission'] as const;
export type ChatRoomKind = (typeof CHAT_ROOM_KINDS)[number];

/**
 * Salon VECTRACOM (transport Nest ; matrixRoomId prêt pour Dendrite).
 * remontee = 1 / tenant · team = 1 / équipe · mission = opt-in (pas auto).
 */
@Entity('chat_rooms')
@Index(['companyId', 'kind', 'teamId'], { unique: false })
@Index(['companyId', 'alias'], { unique: true })
export class ChatRoom extends BaseEntity {
  @Column({ type: 'text' })
  kind!: ChatRoomKind;

  @Column()
  title!: string;

  /** Alias stable ex. remontee-{companyShort} / team-{teamId} */
  @Column({ type: 'text' })
  alias!: string;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  /** ID Matrix quand MATRIX_HOMESERVER est branché. */
  @Column({ type: 'text', nullable: true })
  matrixRoomId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastMessagePreview: string | null;
}
