import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MissionFieldReport } from './field-report.entity';
import { Team } from '../../teams/entities/team.entity';

export const MISSION_STATUSES = [
  'planifiee',
  'en_cours',
  'terminee',
  'validee',
  'rejetee',
  'a_completer',
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/** Statuts terminaux : une mission importée dans ces états n'est jamais écrasée. */
export const TERMINAL_MISSION_STATUSES: MissionStatus[] = ['terminee', 'validee', 'rejetee'];

/**
 * Mission terrain. Créée par l'import SONATEL (Phase 2) ou manuellement.
 * teamId/technicianIds : les FK équipes seront posées en Phase 4 ; à l'import,
 * les libellés bruts SONATEL sont conservés dans importMeta en attendant la
 * résolution en identifiants.
 */
@Entity('missions')
@Index(['companyId', 'sonatelDossierNumber'], { unique: true })
export class Mission extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid', array: true, default: [] })
  technicianIds: string[];

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column()
  clientSite!: string;

  @Column()
  typeTache!: string;

  @Column({ type: 'text', nullable: true })
  zone: string | null;

  @Column({ type: 'timestamptz' })
  dateMission!: Date;

  @Column({ type: 'text', default: 'planifiee' })
  status!: MissionStatus;

  @Column({ type: 'text', nullable: true })
  sonatelDossierNumber: string | null;

  @Column({ type: 'text', nullable: true })
  sonatelProduit: string | null;

  @Column({ type: 'text', nullable: true })
  sonatelOlt: string | null;

  /** Id généré côté mobile (sync offline) — pas utilisé à l'import. */
  @Column({ type: 'text', nullable: true })
  clientGeneratedId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  importMeta: {
    teamLabel?: string | null;
    technicians?: string[];
    sourceFile?: string;
    nd?: string | null;
    st?: string | null;
    adresse?: string | null;
    dateValidation?: string | null;
    observations?: string | null;
  } | null;

  // ----- Données SONATEL réelles (Planning global FTTH, lot P1) -----

  /** Partenaire donneur d'ordre (SOFATELCOM zone Mbour / 3STB national). */
  @Column({ type: 'uuid', nullable: true })
  partnerId: string | null;

  /** Segment marché : B2C / B2B. */
  @Column({ type: 'text', nullable: true })
  segment: string | null;

  /** Référence Sous-Répartition / Plaque SONATEL (ex. A07/PBO-82, C12/MEB5/A1). */
  @Column({ type: 'text', nullable: true })
  srPlaque: string | null;

  /** COPER du dossier (NA, MC, TL, TR…). */
  @Column({ type: 'text', nullable: true })
  coper: string | null;

  /** Code commande client (ex. FIB_KHE, FIB_PRO_M_B). */
  @Column({ type: 'text', nullable: true })
  commandeClient: string | null;

  @Column({ type: 'text', nullable: true })
  typeLogement: string | null;

  /** Avis client / remarque CRM (ex. « Client injoignable 3 fois… »). */
  @Column({ type: 'text', nullable: true })
  clientAvise: string | null;

  @Column({ type: 'text', nullable: true })
  contactClient: string | null;

  /** Créneau indiqué par SONATEL (ex. « Dans la journée »). */
  @Column({ type: 'text', nullable: true })
  heure: string | null;

  /** Ancienneté de la demande en jours (colonne AGE du planning). */
  @Column({ type: 'integer', nullable: true })
  ageDays: number | null;

  /** GPS remonté par EasyWork ou extrait du motif de blocage. */
  @Column({ type: 'text', nullable: true })
  gpsEasyWork: string | null;

  /** Motif de blocage SONATEL (texte brut remonté). */
  @Column({ type: 'text', nullable: true })
  blocageMotif: string | null;

  /** Motif de blocage normalisé (zone_ineligible, saturation…). */
  @Column({ type: 'text', nullable: true })
  blocageCode: string | null;

  /** Code opération SONATEL (RIT, SAV, Déplacement prise, Finalisation…). */
  @Column({ type: 'text', nullable: true })
  codeOperation: string | null;

  /** Validation d'attachement SONATEL (colonne VA CAP). */
  @Column({ type: 'text', nullable: true })
  vaCap: string | null;

  /** Pilote SONATEL en charge du dossier (ex. DAOUDA DIAO). */
  @Column({ type: 'text', nullable: true })
  piloteSonatel: string | null;

  /** Nombre d'interventions déjà réalisées sur ce ND (NBSI). */
  @Column({ type: 'integer', default: 0 })
  nbsi!: number;

  /** Ligne en surcharge (feuille SURCH : zone sans capacité, non affectée). */
  @Column({ default: false })
  surcharge!: boolean;

  /** Onglet source de l'import : PLANNING | SURCH | TRAITEES. */
  @Column({ type: 'text', nullable: true })
  importSource: string | null;

  // ----- Exécution terrain (Phase 3) -----
  @Column({ type: 'timestamptz', nullable: true })
  heureDepartReelle: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  heureArrivee: Date | null;

  @Column({ type: 'text', nullable: true })
  tachesEffectuees: string | null;

  @Column({ type: 'jsonb', nullable: true })
  materielUtilise: Array<Record<string, unknown>> | null;

  @Column({ type: 'text', array: true, default: [] })
  photoUrls: string[];

  @Column({ type: 'text', nullable: true })
  commentaireVocalUrl: string | null;

  @Column({ type: 'text', nullable: true })
  rapportGenereParIA: string | null;

  @OneToOne(() => MissionFieldReport, (report) => report.mission, { cascade: false })
  fieldReport?: MissionFieldReport;
}
