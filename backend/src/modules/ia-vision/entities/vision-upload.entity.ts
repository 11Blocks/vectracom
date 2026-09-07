import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const VISION_VERDICTS = ['accepte', 'a_reprendre'] as const;

/**
 * Pré-audit IA d'une photo uploadée depuis le web (le mobile envoie ses
 * propres captures) : netteté/pertinence évaluées AVANT validation terrain.
 * « L'IA propose, elle ne décide jamais seule » → verdict + validation humaine.
 */
@Entity('vision_uploads')
@Index(['companyId', 'createdAt'])
export class VisionUpload extends BaseEntity {
  @Column({ type: 'text' })
  originalName!: string;

  /** Chemin servi statiquement (ex. /uploads/ia-vision/xxx.jpg). */
  @Column({ type: 'text' })
  imageUrl!: string;

  @Column({ type: 'text' })
  mimeType!: string;

  @Column({ type: 'integer' })
  sizeBytes!: number;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'text' })
  verdict!: (typeof VISION_VERDICTS)[number];

  /** Score de qualité déterministe 0-100. */
  @Column({ type: 'integer' })
  score!: number;

  /** Anomalies détectées (resolution_insuffisante, luminosite_faible…). */
  @Column({ type: 'jsonb', default: '[]' })
  flags!: string[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string | null;
}
