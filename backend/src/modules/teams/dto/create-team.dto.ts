import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { TEAM_TYPES } from '../entities/team.entity';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(TEAM_TYPES as unknown as string[])
  type!: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsUUID()
  pilotId?: string | null;

  @IsOptional()
  @IsUUID()
  itemId?: string | null;
}
