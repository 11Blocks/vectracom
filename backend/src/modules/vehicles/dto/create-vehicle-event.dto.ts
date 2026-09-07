import {
  IsArray, IsIn, IsInt, IsISO8601, IsNumber, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { REPARATION_STATUSES, VEHICLE_EVENT_TYPES } from '../entities/vehicle-event.entity';

export class VehiclePartDto {
  @IsString()
  @MinLength(1)
  designation!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

/** Création d'un événement véhicule (panne / réparation / pièce / carburant). */
export class CreateVehicleEventDto {
  @IsIn(VEHICLE_EVENT_TYPES as unknown as string[])
  type!: string;

  @IsISO8601()
  eventDate!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  liters?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiclePartDto)
  parts?: VehiclePartDto[];

  @IsOptional()
  @IsIn(REPARATION_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  missionId?: string;
}

export class UpdateVehicleEventDto {
  @IsOptional()
  @IsIn(REPARATION_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsObject()
  patch?: Record<string, unknown>;
}
