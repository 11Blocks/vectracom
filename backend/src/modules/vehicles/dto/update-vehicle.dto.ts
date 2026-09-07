import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { VEHICLE_STATUSES } from '../entities/vehicle.entity';

/** Mise à jour partielle : tous les champs optionnels. */
export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  immatriculation?: string;

  @IsOptional() @IsString() modele?: string;
  @IsOptional() @IsUUID() teamId?: string | null;
  @IsOptional() @IsUUID() technicianId?: string | null;
  @IsOptional() @IsInt() @Min(0) kilometrage?: number;
  @IsOptional() @IsDateString() insuranceExpiration?: string | null;
  @IsOptional() @IsDateString() technicalInspectionExpiration?: string | null;
  @IsOptional() @IsInt() @Min(0) nextMaintenanceKm?: number | null;
  @IsOptional() @IsNumber() monthlyCost?: number | null;

  @IsOptional()
  @IsIn(VEHICLE_STATUSES as unknown as string[])
  status?: string;
}
