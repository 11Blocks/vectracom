import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Conversation du Dashboard RAG (option payante). */
@Entity('rag_conversations')
@Index(['companyId', 'userId'])
export class RagConversation extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column()
  title!: string;

  @OneToMany('RagMessage', 'conversation')
  messages?: unknown[];
}
