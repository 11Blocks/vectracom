import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/** Double validation — volet SONATEL (distinct de la validation interne). */
export class SonatelApproveDto {
  @IsIn(['approuve', 'rejete'])
  sonatelApprovalStatus!: 'approuve' | 'rejete';

  @IsOptional()
  @IsString()
  @MinLength(5)
  rejectionReason?: string;
}
