import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PRICE_GRIDS } from '../entities/price-item.entity';

export class CreatePriceItemDto {
  @IsInt()
  @Min(1)
  itemNumber!: number;

  @IsString()
  @MinLength(3)
  designation!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsIn(PRICE_GRIDS as unknown as string[])
  priceGrid?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DuplicatePriceVersionDto {
  @IsOptional() @IsIn(PRICE_GRIDS as unknown as string[]) priceGrid?: string;
  @IsString() @MinLength(1) fromVersion!: string;
  @IsString() @MinLength(1) @MaxLength(20) toVersion!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(500) percentChange?: number;
}

export class ActivatePriceVersionDto {
  @IsOptional() @IsIn(PRICE_GRIDS as unknown as string[]) priceGrid?: string;
  @IsString() @MinLength(1) version!: string;
}

export class UpdatePriceItemDto {
  @IsOptional() @IsString() @MinLength(3) designation?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() category?: string | null;
  @IsOptional() @IsString() subCategory?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() effectiveFrom?: string | null;
  @IsOptional() @IsString() effectiveTo?: string | null;
  @IsOptional() @IsUUID() companyId?: string;
}
