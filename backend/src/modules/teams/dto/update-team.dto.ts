import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
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
  @IsBoolean()
  active?: boolean;
}
