import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CONTRACT_TYPES } from '../entities/technician.entity';

export class CreateTechnicianDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsUUID()
  teamId!: string;

  /** Compte utilisateur partagé (optionnel : le binôme peut utiliser celui du chef). */
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @IsBoolean()
  isTeamLeader?: boolean;

  @IsOptional()
  @IsUUID()
  teamLeaderId?: string | null;

  @IsOptional()
  @IsISO8601()
  habilitationSstExpiration?: string;

  @IsOptional()
  @IsISO8601()
  habilitationConduiteExpiration?: string;

  @IsOptional()
  @IsInt()
  experienceYears?: number;

  @IsOptional()
  @IsIn(CONTRACT_TYPES as unknown as string[])
  contractType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competences?: string[];

  @IsOptional()
  @IsArray()
  documents?: Array<Record<string, unknown>>;
}
