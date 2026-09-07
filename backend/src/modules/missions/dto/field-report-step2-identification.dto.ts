import { IsNumber, IsOptional, IsString } from 'class-validator';

/** Étape 2 — Identification & géolocalisation (GPS capturé auto côté mobile). */
export class Step2IdentificationDto {
  @IsOptional()
  @IsString()
  interventionType?: string;

  @IsOptional()
  @IsString()
  equipmentCode?: string;

  @IsOptional()
  @IsNumber()
  gpsLatitude?: number;

  @IsOptional()
  @IsNumber()
  gpsLongitude?: number;
}
