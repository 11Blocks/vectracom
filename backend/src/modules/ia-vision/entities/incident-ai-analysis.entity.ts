import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Résultat de l'analyse IA (YOLO + Gemini) d'un signalement — proposition soumise à validation humaine. */
@Entity('incident_ai_analysis')
@Index(['companyId', 'incidentId'])
export class IncidentAiAnalysis extends BaseEntity {
  @Column({ type: 'uuid' })
  incidentId!: string;

  @Column({ type: 'text', nullable: true })
  rubriqueDetected: string | null;

  @Column({ type: 'text', nullable: true })
  pboReferenceDetected: string | null;

  @Column({ type: 'text', nullable: true })
  pboDefautDetected: string | null;

  @Column({ type: 'text', nullable: true })
  pioTypeDetected: string | null;

  @Column({ type: 'text', nullable: true })
  pioEtatDetected: string | null;

  @Column({ type: 'text', nullable: true })
  chambreTypeDetected: string | null;

  @Column({ type: 'text', nullable: true })
  chambreEtatDetected: string | null;

  @Column({ type: 'text', nullable: true })
  annotationExtracted: string | null;

  @Column({ type: 'jsonb', nullable: true })
  annotationParsed: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  gpsExtracted: Record<string, unknown> | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceRubrique: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidencePbo: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidencePio: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceChambre: string | null;

  @Column({ type: 'uuid', nullable: true })
  matchedIncidentId: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  matchingConfidence: string | null;

  @Column({ type: 'text', nullable: true })
  suggestedMissionType: string | null;

  @Column({ type: 'text', nullable: true })
  suggestedSeverity: string | null;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  validationStatus: string | null;

  @Column({ default: false })
  isCorrected!: boolean;

  @Column({ type: 'text', nullable: true })
  correctionNotes: string | null;
}
