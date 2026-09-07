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

export class UpdateTechnicianDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string;

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
  habilitationSstExpiration?: string | null;

  @IsOptional()
  @IsISO8601()
  habilitationConduiteExpiration?: string | null;

  @IsOptional()
  @IsInt()
  experienceYears?: number | null;

  @IsOptional()
  @IsIn(CONTRACT_TYPES as unknown as string[])
  contractType?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competences?: string[];

  @IsOptional()
  @IsArray()
  documents?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
