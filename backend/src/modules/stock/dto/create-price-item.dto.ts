import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

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
  @IsBoolean()
  isActive?: boolean;
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
