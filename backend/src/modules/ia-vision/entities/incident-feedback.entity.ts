import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Feedback de validation humaine — carburant de l'Active Learning. */
@Entity('incident_feedback')
@Index(['companyId', 'isProcessedForTraining'])
export class IncidentFeedback extends BaseEntity {
  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'uuid' })
  analysisId!: string;

  @Column({ type: 'text', nullable: true })
  aiDetectedRubrique: string | null;

  @Column({ type: 'text', nullable: true })
  aiDetectedDefaut: string | null;

  @Column({ type: 'text', nullable: true })
  aiDetectedReference: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  aiConfidence: string | null;

  @Column({ type: 'text', nullable: true })
  humanCorrectionRubrique: string | null;

  @Column({ type: 'text', nullable: true })
  humanCorrectionDefaut: string | null;

  @Column({ type: 'text', nullable: true })
  humanCorrectionReference: string | null;

  @Column({ default: true })
  humanValidation!: boolean;

  @Column({ type: 'text', nullable: true })
  correctionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  correctedBy: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  correctedAt!: Date;

  @Column({ default: false })
  isProcessedForTraining!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
