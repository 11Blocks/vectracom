import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
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
}
