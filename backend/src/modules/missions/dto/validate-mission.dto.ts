import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/** Double validation — volet interne (admin/direction). */
export class ValidateMissionDto {
  @IsIn(['validee', 'rejetee'])
  internalValidationStatus!: 'validee' | 'rejetee';

  @IsOptional()
  @IsString()
  @MinLength(5)
  rejectionReason?: string;
}
