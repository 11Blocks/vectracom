import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_memberships')
@Index(['companyId', 'roomId', 'userId'], { unique: true })
export class ChatMembership extends BaseEntity {
  @Column({ type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ type: 'uuid' })
  userId!: string;
}
