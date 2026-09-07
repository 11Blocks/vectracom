import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RagConversation } from './rag-conversation.entity';

@Entity('rag_messages')
@Index(['conversationId', 'createdAt'])
export class RagMessage extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => RagConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: RagConversation;

  @Column({ type: 'text' })
  role!: 'user' | 'assistant';

  @Column({ type: 'text' })
  content!: string;
}
