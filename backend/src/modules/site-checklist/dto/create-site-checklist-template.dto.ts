import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SITE_SHEET_TYPES,
  SiteChecklistSection,
} from '../entities/site-checklist-template.entity';

class ItemDto {
  @IsString() id!: string;
  @IsString() @MinLength(2) label!: string;
  @IsIn(['text', 'number', 'boolean', 'date', 'select', 'photos'])
  type!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsInt() priceItem?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

class SectionDto {
  @IsString() section!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemDto)
  items!: ItemDto[];
}

export class CreateSiteChecklistTemplateDto {
  @IsIn(SITE_SHEET_TYPES as unknown as string[])
  templateType!: string;

  @IsString()
  @MinLength(3)
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections!: SiteChecklistSection[];

  @IsOptional()
  @IsArray()
  requiredPhotos?: Array<{ type: string; label: string; count: number }>;

  @IsOptional()
  extraFields?: Record<string, unknown>;
}

export class UpdateSiteChecklistTemplateDto {
  @IsOptional() @IsString() @MinLength(3) label?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SectionDto)
  sections?: SiteChecklistSection[];
  @IsOptional() @IsArray() requiredPhotos?: Array<{ type: string; label: string; count: number }>;
  @IsOptional() extraFields?: Record<string, unknown>;
}
