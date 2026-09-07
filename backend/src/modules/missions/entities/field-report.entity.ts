import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Mission } from './mission.entity';

export const INTERNAL_VALIDATION_STATUSES = ['en_attente', 'validee', 'rejetee'] as const;
export const SONATEL_APPROVAL_STATUSES = ['en_attente', 'approuve', 'rejete'] as const;
export const RECETTE_STATUSES = ['en_attente', 'en_cours', 'acceptee', 'reserves', 'rejetee'] as const;
export const FIELD_STATUSES = ['succes', 'echec'] as const;

/** Rapport terrain d'une mission : les 6 étapes + données dynamiques. */
@Entity('mission_field_reports')
@Index(['missionId'], { unique: true })
export class MissionFieldReport extends BaseEntity {
  @Column({ type: 'uuid' })
  missionId!: string;

  @OneToOne(() => Mission, (mission) => mission.fieldReport, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mission_id' })
  mission!: Mission;

  @Column({ type: 'text', nullable: true })
  missionType: string | null;

  // ----- Étape 1 — Sécurité SST (bloquante) -----
  @Column({ type: 'jsonb', nullable: true })
  sstChecklist: Record<string, boolean> | null;

  @Column({ type: 'text', nullable: true })
  sstPhotoUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sstValidatedAt: Date | null;

  // ----- Étape 2 — Identification & géolocalisation -----
  @Column({ type: 'text', nullable: true })
  interventionType: string | null;

  @Column({ type: 'text', nullable: true })
  equipmentCode: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLatitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLongitude: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  identificationAt: Date | null;

  // ----- Étape 3 — Exécution technique -----
  @Column({ type: 'text', nullable: true })
  initialEquipmentState: string | null;

  @Column({ type: 'text', nullable: true })
  actionRealized: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  dbmMeasurement: string | null;

  @Column({ default: false })
  dbmOutOfNorm!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  techniqueAt: Date | null;

  // ----- Étape 4 — Preuves visuelles -----
  @Column({ type: 'text', nullable: true })
  photoSiteUrl: string | null;

  @Column({ type: 'text', nullable: true })
  photoPboInteriorUrl: string | null;

  @Column({ type: 'text', nullable: true })
  photoPboClosedUrl: string | null;

  @Column({ type: 'text', nullable: true })
  photoPtoModemUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  photoAuditResults: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  photosAt: Date | null;

  // ----- Étape 5 — Matériel consommé + échange SAV -----
  @Column({ type: 'jsonb', nullable: true })
  materialsConsumed: Array<{ itemNumber?: number; designation?: string; quantity: number }> | null;

  @Column({ type: 'uuid', nullable: true })
  exchangeOldSerialId: string | null;

  @Column({ type: 'uuid', nullable: true })
  exchangeNewSerialId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  materielAt: Date | null;

  // ----- Étape 6 — Clôture -----
  @Column({ type: 'text', nullable: true })
  fieldStatus: (typeof FIELD_STATUSES)[number] | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'text', nullable: true })
  signatureTechnicianUrl: string | null;

  @Column({ type: 'text', nullable: true })
  signatureClientUrl: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  qualityScore: string | null;

  /** Action SAV normalisée (reprise_soudure_pto, pigtail_change…). */
  @Column({ type: 'text', nullable: true })
  savAction: string | null;

  /** Issue SAV : RELEVE / REOR / DEPLACEMENT. */
  @Column({ type: 'text', nullable: true })
  savOutcome: string | null;

  @Column({ type: 'text', default: 'en_attente' })
  internalValidationStatus!: (typeof INTERNAL_VALIDATION_STATUSES)[number];

  @Column({ type: 'text', default: 'en_attente' })
  sonatelApprovalStatus!: (typeof SONATEL_APPROVAL_STATUSES)[number];

  @Column({ type: 'text', nullable: true })
  pvRecettePdfUrl: string | null;

  // ----- Données dynamiques du template + valorisation -----
  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '[]' })
  priceItemsUsed!: Array<{ itemNumber: number; quantity: number; unitPrice?: number }>;

  @Column({ type: 'text', default: 'en_attente' })
  recetteStatus!: (typeof RECETTE_STATUSES)[number];

  @Column({ type: 'jsonb', default: '[]' })
  recetteDocuments!: Array<{ type: string; url: string; uploadedAt?: string }>;

  @Column({ type: 'integer', nullable: true })
  dureeMinutes: number | null;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  montantTotal!: string;
}
