import { IsArray, IsInt, IsObject, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PriceLineDto {
  @IsInt()
  itemNumber!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Sauvegarde d'une fiche de chantier pour une mission. */
export class SaveSiteChecklistDto {
  /** Valeurs des champs du template (clé = item.id). */
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  photos?: Array<{ type: string; url: string }>;

  /** Items du bordereau réalisés — valorisés automatiquement (montant total). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceLineDto)
  priceItems?: PriceLineDto[];
}
