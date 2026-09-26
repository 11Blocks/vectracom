import { IsArray, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Min, MinLength } from 'class-validator';
import {
  CHAMBRE_ETATS,
  CHAMBRE_TYPES,
  INCIDENT_SEVERITIES,
  PBO_DEFAUTS,
  PIO_ETATS,
  PIO_TYPES,
} from '../entities/incident.entity';

/** Correction des informations d'un incident non clôturé (rubrique et numéro figés). */
export class UpdateIncidentDto {
  @IsOptional() @IsString() @MinLength(2) zone?: string;
  @IsOptional() @IsString() olt?: string;
  @IsOptional() @IsLatitude() gpsLatitude?: number;
  @IsOptional() @IsLongitude() gpsLongitude?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(INCIDENT_SEVERITIES as unknown as string[]) severity?: string;

  @IsOptional() @IsString() pboReference?: string;
  @IsOptional() @IsIn(PBO_DEFAUTS as unknown as string[]) pboDefaut?: string;
  @IsOptional() @IsIn(PIO_TYPES as unknown as string[]) pioType?: string;
  @IsOptional() @IsIn(PIO_ETATS as unknown as string[]) pioEtat?: string;
  @IsOptional() @IsInt() pioNbCables?: number;
  @IsOptional() @IsIn(CHAMBRE_TYPES as unknown as string[]) chambreType?: string;
  @IsOptional() @IsIn(CHAMBRE_ETATS as unknown as string[]) chambreEtat?: string;

  @IsOptional() @IsInt() @Min(0) clientsImpacted?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) ndList?: string[];
}
