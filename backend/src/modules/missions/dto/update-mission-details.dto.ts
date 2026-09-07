import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Édition métadonnées mission (hors réaffectation équipe/véhicule). */
export class UpdateMissionDetailsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  clientSite?: string;

  @IsOptional()
  @IsString()
  zone?: string | null;

  @IsOptional()
  @IsISO8601()
  dateMission?: string;

  @IsOptional()
  @IsUUID()
  partnerId?: string | null;

  @IsOptional()
  @IsString()
  sonatelDossierNumber?: string | null;

  @IsOptional()
  @IsString()
  sonatelProduit?: string | null;

  @IsOptional()
  @IsString()
  sonatelOlt?: string | null;

  @IsOptional()
  @IsString()
  srPlaque?: string | null;

  @IsOptional()
  @IsString()
  segment?: string | null;

  @IsOptional()
  @IsString()
  contactClient?: string | null;

  @IsOptional()
  @IsString()
  coper?: string | null;

  @IsOptional()
  @IsString()
  vaCap?: string | null;

  @IsOptional()
  @IsString()
  piloteSonatel?: string | null;

  @IsOptional()
  @IsString()
  codeOperation?: string | null;
}
