import { IsIn, IsString, MinLength } from 'class-validator';
import { SHEET_TYPES } from '../column-mapping.entity';

export class ColumnMappingDto {
  @IsIn(SHEET_TYPES as unknown as string[])
  sheetType!: 'planning' | 'affect';

  @IsString()
  @MinLength(1)
  sourceColumnName!: string;

  @IsString()
  @MinLength(2)
  targetField!: string;
}

export class ReplaceColumnMappingsDto {
  @IsIn(SHEET_TYPES as unknown as string[])
  sheetType!: 'planning' | 'affect';

  mappings!: ColumnMappingDto[];
}
