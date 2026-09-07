import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const RAG_DOC_CATEGORIES = ['contrat', 'procedure', 'bordereau', 'sonatel', 'rh', 'autre'] as const;
export const RAG_DOC_STATUSES = ['ready', 'error'] as const;

/**
 * Document de la base de connaissances du RAG (contrats, procédures,
 * bordereaux, exigences SONATEL…). Découpé en morceaux pour le retrieval.
 */
@Entity('rag_documents')
@Index(['companyId', 'category'])
export class RagDocument extends BaseEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  category!: (typeof RAG_DOC_CATEGORIES)[number];

  @Column({ type: 'text', nullable: true })
  fileName: string | null;

  @Column({ type: 'integer', default: 0 })
  chunkCount!: number;

  @Column({ type: 'integer', default: 0 })
  sizeChars!: number;

  @Column({ type: 'text', default: 'ready' })
  status!: (typeof RAG_DOC_STATUSES)[number];

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string | null;
}
