import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { SAAS_PLAN_CODES } from '../saas-pricing';

export class AssignLicenseDto {
  @IsUUID()
  userId!: string;

  @IsIn(SAAS_PLAN_CODES as unknown as string[])
  planCode!: string;

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingCycle?: string;
}

export class RevokeLicenseDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
