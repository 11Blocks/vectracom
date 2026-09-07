import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialConsumedLine {
  @IsOptional()
  @IsInt()
  itemNumber?: number;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Étape 5 — Matériel consommé (items du bordereau 3STB). */
export class Step5MaterielDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialConsumedLine)
  materialsConsumed?: MaterialConsumedLine[];
}
