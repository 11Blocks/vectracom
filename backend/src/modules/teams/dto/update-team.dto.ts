import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { TEAM_TYPES } from '../entities/team.entity';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(TEAM_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsString()
  zone?: string | null;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsUUID()
  pilotId?: string | null;

  @IsOptional()
  @IsUUID()
  itemId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  repartitionChefPct?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
