import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { MISSION_STATUSES } from '../entities/mission.entity';

export class UpdateMissionStatusDto {
  @IsIn(MISSION_STATUSES as unknown as string[])
  status!: string;

  /** Obligatoire quand status = rejetee ou annulee (motif), et pour dé-valider. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  rejectionReason?: string;
}

export class BulkMissionStatusDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsUUID('all', { each: true })
  ids!: string[];

  @IsIn(['validee', 'rejetee', 'annulee'])
  status!: 'validee' | 'rejetee' | 'annulee';

  @IsOptional() @IsString() @MinLength(5)
  reason?: string;
}
