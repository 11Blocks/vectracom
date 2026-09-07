import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MOVEMENT_TYPES } from '../entities/stock-movement.entity';

export class CreateStockMovementDto {
  @IsUUID()
  stockItemId!: string;

  @IsIn(MOVEMENT_TYPES as unknown as string[])
  type!: string;

  @IsInt()
  @Min(1)
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
