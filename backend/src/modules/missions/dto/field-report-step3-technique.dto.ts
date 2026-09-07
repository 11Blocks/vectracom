import { IsNumber, IsOptional, IsString } from 'class-validator';

/** Étape 3 — Exécution technique. Le dBm < -25 déclenche dbmOutOfNorm. */
export class Step3TechniqueDto {
  @IsOptional()
  @IsString()
  initialEquipmentState?: string;

  @IsOptional()
  @IsString()
  actionRealized?: string;

  @IsOptional()
  @IsNumber()
  dbmMeasurement?: number;
}
