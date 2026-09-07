import { IsIn, IsOptional, IsString } from 'class-validator';
import { FIELD_STATUSES } from '../entities/field-report.entity';

/** Étape 6 — Clôture : statut terrain, signatures ; déclenche le score qualité. */
export class Step6ClotureDto {
  @IsIn(FIELD_STATUSES as unknown as string[])
  fieldStatus!: string;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  signatureTechnicianUrl?: string;

  @IsOptional()
  @IsString()
  signatureClientUrl?: string;

  /** Action SAV normalisée (catalogue — reprise_soudure_pto, pigtail_change…). */
  @IsOptional()
  @IsString()
  savAction?: string | null;

  /** Issue SAV : RELEVE / REOR / DEPLACEMENT. */
  @IsOptional()
  @IsIn(['RELEVE', 'REOR', 'DEPLACEMENT'])
  savOutcome?: string | null;
}
