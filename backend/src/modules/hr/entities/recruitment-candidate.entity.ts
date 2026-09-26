import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const CANDIDATE_STATUSES = ['nouveau', 'entretien', 'test_technique', 'retenu', 'rejete', 'embauche'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_POSITIONS = ['technicien', 'chauffeur', 'magasinier', 'administratif', 'chef_equipe'] as const;
export type CandidatePosition = (typeof CANDIDATE_POSITIONS)[number];

export const CANDIDATE_SOURCES = ['candidature_spontanee', 'recommandation', 'annonce', 'pole_emploi', 'autre'] as const;

export interface CandidateDocument {
  type: string;
  name: string;
  fileUrl: string;
  addedAt?: string;
}

/**
 * Candidature — sous-module RH Recrutement (maquette : candidats, pièces,
 * statut). Le pipeline : nouveau → entretien → test technique → retenu/rejeté.
 */
@Entity('recruitment_candidates')
@Index(['companyId', 'status'])
export class RecruitmentCandidate extends BaseEntity {
  @Column({ type: 'text' })
  fullName!: string;

  @Column({ type: 'text' })
  position!: CandidatePosition;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', default: 'candidature_spontanee' })
  source!: (typeof CANDIDATE_SOURCES)[number];

  @Column({ type: 'text', default: 'nouveau' })
  status!: CandidateStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** CV, CNI, diplôme, attestation… */
  @Column({ type: 'jsonb', default: '[]' })
  documents!: CandidateDocument[];

  @Column({ type: 'date', nullable: true })
  interviewDate: string | null;

  @Column({ type: 'integer', nullable: true })
  testScore: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  hiredAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  hiredEmployeeId: string | null;

  @Column({ type: 'uuid', nullable: true })
  hiredTechnicianId: string | null;
}
