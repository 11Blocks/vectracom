import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { VEHICLE_DOC_TYPES } from '../entities/vehicle-document.entity';

export class CreateVehicleDocumentDto {
  @IsIn(VEHICLE_DOC_TYPES as unknown as string[])
  docType!: string;

  @IsString()
  @MinLength(4)
  fileUrl!: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}
