import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const INCIDENT_SOURCES = ['WHATSAPP', 'MOBILE', 'EMAIL'] as const;
export const INCIDENT_RUBRIQUES = ['PBO', 'PIO', 'CHAMBRE'] as const;
export type IncidentRubrique = (typeof INCIDENT_RUBRIQUES)[number];

export const PBO_DEFAUTS = ['DESORGANISE', 'SANS_COUVERCLE', 'ENDOMAGE', 'CABLE_DESORDRE'] as const;
export const PIO_TYPES = ['POTEAU_SIMPLE', 'POTEAU_MOISE', 'CABLE', 'ACCESSOIRE'] as const;
export const PIO_ETATS = ['DEBOUT', 'INCLINE', 'A_TERRE', 'CASSE'] as const;
export const CHAMBRE_TYPES = ['L2T', 'L3T', 'L5T', 'L6T'] as const;
export const CHAMBRE_ETATS = ['ACCESSIBLE', 'BOUCHEE', 'ENDOMAGEE', 'INONDEE'] as const;

export const INCIDENT_STATUSES = ['signalement', 'en_cours', 'en_attente', 'corrige', 'cloture'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_SEVERITIES = ['CRITICAL', 'MAJEUR', 'MINEUR', 'INFORMATION'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** Incident réseau signalé (PBO / PIO / Chambre) — suivi jusqu'à clôture. */
@Entity('incidents')
@Index(['companyId', 'incidentNumber'], { unique: true })
export class Incident extends BaseEntity {
  @Column()
  incidentNumber!: string;

  @Column({ type: 'text', default: 'WHATSAPP' })
  source!: (typeof INCIDENT_SOURCES)[number];

  @Column({ type: 'text', default: 'REMONTEE' })
  whatsappGroup!: string;

  @Column({ type: 'uuid', nullable: true })
  reportedBy: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  reportedAt!: Date;

  // ----- Rubrique -----
  @Column({ type: 'text' })
  rubrique!: IncidentRubrique;

  // ----- Localisation -----
  @Column({ type: 'text' })
  zone!: string;

  @Column({ type: 'text', nullable: true })
  olt: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLatitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLongitude: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ----- Spécifique PBO -----
  @Column({ type: 'text', nullable: true })
  pboReference: string | null;

  @Column({ type: 'text', nullable: true })
  pboDefaut: (typeof PBO_DEFAUTS)[number] | null;

  @Column({ type: 'integer', nullable: true })
  pboAnnee: number | null;

  @Column({ type: 'text', nullable: true })
  pboSemaine: string | null;

  @Column({ type: 'text', nullable: true })
  pboPlaque: string | null;

  @Column({ type: 'text', nullable: true })
  pboConstitutions: string | null;

  @Column({ type: 'text', nullable: true })
  pboEquipeAssignee: string | null;

  // ----- Spécifique PIO -----
  @Column({ type: 'text', nullable: true })
  pioType: (typeof PIO_TYPES)[number] | null;

  @Column({ type: 'text', nullable: true })
  pioEtat: (typeof PIO_ETATS)[number] | null;

  @Column({ type: 'integer', nullable: true })
  pioNbCables: number | null;

  @Column({ type: 'text', nullable: true })
  pioCableType: string | null;

  @Column({ type: 'jsonb', nullable: true })
  pioAccessoires: string[] | null;

  // ----- Spécifique Chambre -----
  @Column({ type: 'text', nullable: true })
  chambreType: (typeof CHAMBRE_TYPES)[number] | null;

  @Column({ type: 'text', nullable: true })
  chambreEtat: (typeof CHAMBRE_ETATS)[number] | null;

  // ----- Impact & annotation -----
  @Column({ type: 'integer', default: 0 })
  clientsImpacted!: number;

  @Column({ type: 'text', array: true, default: [] })
  ndList!: string[];

  @Column({ type: 'text', nullable: true })
  annotationOriginale: string | null;

  @Column({ type: 'jsonb', nullable: true })
  annotationParse: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: '[]' })
  photos!: Array<{ type: string; url: string }>;

  // ----- Statut & traitement -----
  @Column({ type: 'text', default: 'signalement' })
  status!: IncidentStatus;

  @Column({ type: 'text', default: 'MINEUR' })
  severity!: IncidentSeverity;

  @Column({ type: 'uuid', nullable: true })
  assignedTeamId: string | null;

  @Column({ type: 'uuid', array: true, default: [] })
  assignedTechnicianIds!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  validationNotes: string | null;

  // ----- Résolution & rapport -----
  @Column({ type: 'text', nullable: true })
  actionTaken: string | null;

  @Column({ type: 'jsonb', nullable: true })
  resolutionDetails: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reportPdfUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reportGeneratedAt: Date | null;

  @Column({ type: 'uuid', array: true, default: [] })
  relatedMissionIds!: string[];
}
