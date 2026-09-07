import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { MISSION_TYPES } from '../entities/mission-type-template.entity';

export class CreateMissionDto {
  @IsString()
  @MinLength(2)
  clientSite!: string;

  @IsIn(MISSION_TYPES as unknown as string[])
  typeTache!: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  technicianIds?: string[];

  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @IsISO8601()
  dateMission!: string;

  @IsOptional()
  @IsString()
  sonatelDossierNumber?: string | null;

  @IsOptional()
  @IsUUID()
  partnerId?: string | null;

  @IsOptional()
  @IsString()
  srPlaque?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsString()
  contactClient?: string;

  @IsOptional()
  @IsString()
  sonatelProduit?: string | null;

  @IsOptional()
  @IsString()
  sonatelOlt?: string | null;

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
