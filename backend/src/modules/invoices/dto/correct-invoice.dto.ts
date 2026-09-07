import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

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
