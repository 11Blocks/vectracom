import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_messages')
@Index(['companyId', 'roomId', 'createdAt'])
export class ChatMessage extends BaseEntity {
  @Column({ type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => ChatRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  /** Null pour messages externes (WhatsApp Remontée). */
  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  /** Affichage WhatsApp / bridge (ex. +22177…). */
  @Column({ type: 'text', nullable: true })
  senderDisplayName: string | null;

  /** app | whatsapp | system */
  @Column({ type: 'text', default: 'app' })
  source!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  /** Event id Matrix si miroir activé. */
  @Column({ type: 'text', nullable: true })
  matrixEventId: string | null;
}
