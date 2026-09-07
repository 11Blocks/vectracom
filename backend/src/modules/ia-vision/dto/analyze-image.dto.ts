import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class AnalyzeImageDto {
  @IsString()
  @MinLength(4)
  imageUrl!: string;

  /** Texte du message WhatsApp accompagnant la photo. */
  @IsOptional()
  @IsString()
  annotation?: string;

  @IsOptional() @IsLatitude() gpsLatitude?: number;
  @IsOptional() @IsLongitude() gpsLongitude?: number;

  @IsOptional()
  @IsUUID()
  incidentId?: string;
}
