import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

/** Checklist 15 secondes : 6 points de contrôle + observations/photo. */
export class CreateVehicleCheckDto {
  @IsOptional()
  @IsUUID()
  missionId?: string | null;

  @IsBoolean() huile!: boolean;
  @IsBoolean() eau!: boolean;
  @IsBoolean() freins!: boolean;
  @IsBoolean() pneus!: boolean;
  @IsBoolean() batterie!: boolean;
  @IsBoolean() eclairage!: boolean;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
