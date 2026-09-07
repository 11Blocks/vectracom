import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class SaasLimitDto {
  @IsOptional()
  @IsIn(['base', 'premium'])
  planType?: string;

  @IsOptional() @IsInt() @Min(0) maxPhotosPerMonth?: number;
  @IsOptional() @IsInt() @Min(0) maxIaRequestsPerMonth?: number;
  @IsOptional() @IsInt() @Min(0) maxStorageGb?: number;
  @IsOptional() @IsInt() @Min(0) maxApiRequestsPerDay?: number;
}
