import { IsOptional, IsString } from 'class-validator';

/** Étape 4 — Preuves visuelles : les 4 photos classiques (+ pré-audit IA ultérieur). */
export class Step4PhotosDto {
  @IsOptional()
  @IsString()
  photoSiteUrl?: string;

  @IsOptional()
  @IsString()
  photoPboInteriorUrl?: string;

  @IsOptional()
  @IsString()
  photoPboClosedUrl?: string;

  @IsOptional()
  @IsString()
  photoPtoModemUrl?: string;
}
