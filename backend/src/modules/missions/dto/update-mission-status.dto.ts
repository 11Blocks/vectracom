import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { MISSION_STATUSES } from '../entities/mission.entity';

export class UpdateMissionStatusDto {
  @IsIn(MISSION_STATUSES as unknown as string[])
  status!: string;

  /** Obligatoire quand status = rejetee. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  rejectionReason?: string;
}
