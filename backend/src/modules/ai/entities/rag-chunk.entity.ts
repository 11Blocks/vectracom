import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RagDocument } from './rag-document.entity';

/** Morceau indexé d'un document RAG (~600 caractères avec recouvrement). */
@Entity('rag_chunks')
@Index(['companyId', 'documentId'])
export class RagChunk extends BaseEntity {
  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => RagDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: RagDocument | null;

  @Column({ type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;
}
