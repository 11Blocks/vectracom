import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { SAAS_ADDON_TYPES } from '../saas-pricing';

export class SaasAddonDto {
  @IsIn(SAAS_ADDON_TYPES as unknown as string[])
  addonType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;
}
