import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../teams/entities/team.entity';
import { User } from '../../auth/entities/user.entity';

export const CONTRACT_TYPES = ['CDD', 'CDI', 'PRESTATAIRE'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Domaines de compétence (fichier VALIDATION EQUIPES ONECOMIT). */
export const COMPETENCE_DOMAINS = [
  'DEPLOIEMENT',
  'DENSIF',
  'EXTENSION',
  'OSM',
  'SAV',
  'GC',
  'DEVOIEMENT',
] as const;

export interface TechnicianDocument {
  type: 'CNI' | 'CONTRAT' | 'CV' | 'DIPLOME' | 'ATTESTATION' | 'AUTRE';
  fileUrl: string;
  expirationDate?: string;
}

/**
 * Technicien rattaché à une équipe.
 * Binôme SONATEL : le chef (isTeamLeader, responsable saisie/rapport) et son
 * second (teamLeaderId pointe vers le chef). userId optionnel : le binôme peut
 * partager le compte mobile du chef.
 */
@Entity('technicians')
export class Technician extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId!: string;

  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => Team, (team) => team.technicians, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column()
  fullName!: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  // ----- Habilitations (alertes J-15 gérées par le cron notifications) -----
  @Column({ type: 'date', nullable: true })
  habilitationSstExpiration: string | null;

  @Column({ type: 'date', nullable: true })
  habilitationConduiteExpiration: string | null;

  // ----- Binôme -----
  @Column({ default: false })
  isTeamLeader!: boolean;

  @Column({ type: 'uuid', nullable: true })
  teamLeaderId: string | null;

  @ManyToOne(() => Technician, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_leader_id' })
  teamLeader: Technician | null;

  @OneToMany('Technician', 'teamLeader')
  binomes?: unknown[];

  // ----- Compétences & expérience -----
  @Column({ type: 'integer', nullable: true })
  experienceYears: number | null;

  @Column({ type: 'text', nullable: true })
  contractType: ContractType | null;

  @Column({ type: 'jsonb', default: '[]' })
  competences!: string[];

  @Column({ type: 'jsonb', default: '[]' })
  documents!: TechnicianDocument[];

  @Column({ default: true })
  active!: boolean;
}
