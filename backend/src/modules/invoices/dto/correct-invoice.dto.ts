import { ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { INVOICE_CATEGORIES } from '../entities/invoice-line.entity';

export class CorrectLineDto {
  /** Ciblage par ligne (préféré) ou par type d'item. */
  @IsOptional()
  @IsUUID()
  lineId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  itemType?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /** Renommage du libellé de la ligne. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  label?: string;

  @IsOptional()
  @IsIn(INVOICE_CATEGORIES as unknown as string[])
  category?: string;

  @IsString()
  @MinLength(3)
  correctionReason!: string;
}

export class CorrectInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CorrectLineDto)
  lines!: CorrectLineDto[];
}
