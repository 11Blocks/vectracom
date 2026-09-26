import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MOVEMENT_TYPES } from '../entities/stock-movement.entity';

export class CreateStockMovementDto {
  @IsUUID()
  stockItemId!: string;

  @IsIn(MOVEMENT_TYPES as unknown as string[])
  type!: string;

  /** ≥ 1, sauf « ajustement » où c'est la quantité comptée (0 autorisé). */
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  fromWarehouseId?: string | null;

  @IsOptional()
  @IsUUID()
  toWarehouseId?: string | null;

  /** Obligatoire pour un ASSET (traçabilité par série). */
  @IsOptional()
  @IsUUID()
  itemSerialId?: string | null;

  @IsOptional()
  @IsUUID()
  missionId?: string | null;

  @IsOptional()
  @IsUUID()
  technicianId?: string | null;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelStockMovementDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class InventoryLineDto {
  @IsUUID()
  stockItemId!: string;

  @IsInt()
  @Min(0)
  countedQuantity!: number;
}

/** Inventaire d'un emplacement : chaque écart devient un ajustement tracé. */
export class InventoryDto {
  @IsUUID()
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines!: InventoryLineDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
