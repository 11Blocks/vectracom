import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { STOCK_CATEGORIES, STOCK_FAMILIES } from '../entities/stock-item.entity';

export class CreateStockItemDto {
  @IsString()
  @MinLength(2)
  reference!: string;

  @IsString()
  @MinLength(2)
  designation!: string;

  @IsIn(STOCK_CATEGORIES as unknown as string[])
  category!: string;

  @IsIn(STOCK_FAMILIES as unknown as string[])
  family!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  thresholdAlert?: number;
}
