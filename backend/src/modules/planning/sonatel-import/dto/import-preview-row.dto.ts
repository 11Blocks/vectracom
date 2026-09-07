import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export const PREVIEW_ACTIONS = ['nouvelle', 'mise_a_jour', 'ignorée', 'invalide'] as const;
export type PreviewAction = (typeof PREVIEW_ACTIONS)[number];

/** Une ligne du fichier SONATEL après filtrage ST + mapping + jointure AFFECT. */
export class ImportPreviewRowDto {
  /** N° de dossier SONATEL (colonne « Demande ») — clé d'idempotence. */
  @IsString()
  dossierNumber!: string;

  @IsOptional()
  @IsString()
  client?: string | null;

  @IsOptional()
  @IsString()
  task?: string | null;

  @IsOptional()
  @IsString()
  zone?: string | null;

  @IsOptional()
  @IsString()
  dateMission?: string | null;

  @IsOptional()
  @IsString()
  olt?: string | null;

  /** Libellé équipe depuis AFFECT (résolu en teamId en Phase 4). */
  @IsOptional()
  @IsString()
  team?: string | null;

  /** Libellés techniciens depuis AFFECT. */
  @IsOptional()
  @IsArray()
  technicians?: string[];

  /** Créneau AFFECT — heure début / fin (ex. 08:00 / 17:00). */
  @IsOptional()
  @IsString()
  heureDebut?: string | null;

  @IsOptional()
  @IsString()
  heureFin?: string | null;

  /** COPER du dossier (NA, MC, TL, TR…). */
  @IsOptional()
  @IsString()
  coper?: string | null;

  /** Code commande client (FIB_KHE…). */
  @IsOptional()
  @IsString()
  commandeClient?: string | null;

  @IsOptional()
  @IsString()
  typeLogement?: string | null;

  @IsOptional()
  @IsString()
  clientAvise?: string | null;

  @IsOptional()
  @IsString()
  contactClient?: string | null;

  /** Créneau SONATEL (ex. « Dans la journée »). */
  @IsOptional()
  @IsString()
  heure?: string | null;

  /** SR / Plaque SONATEL (ex. A07/PBO-82). */
  @IsOptional()
  @IsString()
  srPlaque?: string | null;

  /** Segment B2C / B2B. */
  @IsOptional()
  @IsString()
  segment?: string | null;

  /** Ancienneté de la demande (jours). */
  @IsOptional()
  ageDays?: number | null;

  /** GPS extrait (EasyWork ou motif de blocage). */
  @IsOptional()
  @IsString()
  gps?: string | null;

  /** Motif de blocage SONATEL (TRAITEES / champ Client avisé). */
  @IsOptional()
  @IsString()
  blocageMotif?: string | null;

  /** Partenaire donneur d'ordre (colonne ST). */
  @IsOptional()
  @IsString()
  partner?: string | null;

  /** Ligne en surcharge (feuille SURCH). */
  @IsOptional()
  surcharge?: boolean;

  /** Onglet source : PLANNING | SURCH | TRAITEES. */
  @IsOptional()
  @IsString()
  importSource?: string | null;

  /** Action proposée pour l'import. */
  @IsIn(PREVIEW_ACTIONS as unknown as string[])
  action!: PreviewAction;

  /** Motif quand action = ignorée ou invalide. */
  @IsOptional()
  @IsString()
  reason?: string;
}
