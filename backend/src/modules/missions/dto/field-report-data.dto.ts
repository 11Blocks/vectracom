import { IsArray, IsInt, IsObject, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PriceItemUsedLine {
  @IsInt()
  itemNumber!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  itemUnitPrice?: number;
}

/**
 * Données dynamiques du template (champs spécifiques au type de mission)
 * + items du bordereau de prix utilisés.
 */
export class FieldReportDataDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceItemUsedLine)
  priceItemsUsed?: PriceItemUsedLine[];
}
