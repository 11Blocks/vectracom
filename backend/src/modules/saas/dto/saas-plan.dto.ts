import { IsIn, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SAAS_PLAN_CODES } from '../saas-pricing';

export class SaasPlanDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(SAAS_PLAN_CODES as unknown as string[]) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) priceMonthly!: number;
  @IsNumber() @Min(0) priceAnnual!: number;
  @IsOptional() @IsObject() features?: Record<string, unknown>;
}
