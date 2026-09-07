import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  CHAMBRE_ETATS,
  CHAMBRE_TYPES,
  INCIDENT_RUBRIQUES,
  INCIDENT_SOURCES,
  PBO_DEFAUTS,
  PIO_ETATS,
  PIO_TYPES,
} from '../entities/incident.entity';

export class CreateIncidentDto {
  @IsIn(INCIDENT_RUBRIQUES as unknown as string[])
  rubrique!: string;

  @IsString()
  @MinLength(2)
  zone!: string;

  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() olt?: string;
  @IsOptional() @IsLatitude() gpsLatitude?: number;
  @IsOptional() @IsLongitude() gpsLongitude?: number;
  @IsOptional() @IsString() address?: string;

  @IsOptional() @IsString() pboReference?: string;
  @IsOptional() @IsIn(PBO_DEFAUTS as unknown as string[]) pboDefaut?: string;
  @IsOptional() @IsInt() pboAnnee?: number;
  @IsOptional() @IsString() pboSemaine?: string;
  @IsOptional() @IsString() pboPlaque?: string;
  @IsOptional() @IsString() pboConstitutions?: string;
  @IsOptional() @IsString() pboEquipeAssignee?: string;

  @IsOptional() @IsIn(PIO_TYPES as unknown as string[]) pioType?: string;
  @IsOptional() @IsIn(PIO_ETATS as unknown as string[]) pioEtat?: string;
  @IsOptional() @IsInt() pioNbCables?: number;
  @IsOptional() @IsString() pioCableType?: string;
  @IsOptional() @IsArray() pioAccessoires?: string[];

  @IsOptional() @IsIn(CHAMBRE_TYPES as unknown as string[]) chambreType?: string;
  @IsOptional() @IsIn(CHAMBRE_ETATS as unknown as string[]) chambreEtat?: string;

  @IsOptional() @IsInt() @Min(0) clientsImpacted?: number;
  @IsOptional() @IsArray() ndList?: string[];

  /** Texte brut du message WhatsApp (pour l'analyse IA). */
  @IsOptional() @IsString() annotationOriginale?: string;
  @IsOptional() @IsArray() photos?: Array<{ type: string; url: string }>;
}
