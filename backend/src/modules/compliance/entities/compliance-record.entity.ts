import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Les 9 domaines d'habilitation du fichier « VALIDATION EQUIPES 3STB » (15 sept 2025). */
export const HABILITATION_DOMAINS = [
  'deploiement_plaque',
  'densif_ftth',
  'extension_ftth',
  'osm',
  'fttm',
  'devoiement',
  'rehabilitation',
  'backbone',
  'basculement_upgrade',
] as const;
export type HabilitationDomain = (typeof HABILITATION_DOMAINS)[number];

export const HABILITATION_DOMAIN_LABELS: Record<HabilitationDomain, string> = {
  deploiement_plaque: 'Déploiement Plaque',
  densif_ftth: 'Densif FTTH',
  extension_ftth: 'Extension FTTH',
  osm: 'OSM',
  fttm: 'FTTM',
  devoiement: 'Dévoiement',
  rehabilitation: 'Réhabilitation',
  backbone: 'Backbone',
  basculement_upgrade: 'Basculement Upgrade',
};
import { BaseEntity as _Base } from '../../../common/entities/base.entity';
import { Team } from '../../teams/entities/team.entity';
void _Base;

export const COMPLIANCE_STATUSES = [
  'incomplet',
  'en_attente',
  'valide',
  'rejete',
  'a_corriger',
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

/** État de conformité d'une équipe (vis-à-vis SONATEL) — un par équipe. */
@Entity('compliance_records')
@Index(['companyId', 'teamId'], { unique: true })
export class ComplianceRecord extends BaseEntity {
  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'text', default: 'incomplet' })
  status!: ComplianceStatus;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  /** Domaines d'habilitation cochés (format VALIDATION EQUIPES 3STB). */
  @Column({ type: 'text', array: true, default: [] })
  habilitationDomains!: string[];

  /** Étape de validation SONATEL atteinte : documentaire / physique / compétences. */
  @Column({ type: 'text', default: 'documentaire' })
  validationStep!: 'documentaire' | 'physique' | 'competences';
}
