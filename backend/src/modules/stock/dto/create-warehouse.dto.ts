import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { WAREHOUSE_TYPES } from '../entities/warehouse.entity';

export class CreateWarehouseDto {
  @IsIn(WAREHOUSE_TYPES as unknown as string[])
  type!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  zone?: string;
}
