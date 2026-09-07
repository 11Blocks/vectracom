import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(4)
  immatriculation!: string;

  @IsOptional()
  @IsString()
  modele?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsUUID()
  technicianId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  kilometrage?: number;

  @IsOptional()
  @IsDateString()
  insuranceExpiration?: string;

  @IsOptional()
  @IsDateString()
  technicalInspectionExpiration?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nextMaintenanceKm?: number;

  @IsOptional()
  @IsNumber()
  monthlyCost?: number;
}
