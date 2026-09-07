import { IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class ResolveIncidentDto {
  @IsString()
  @MinLength(5)
  actionTaken!: string;

  @IsOptional()
  @IsObject()
  resolutionDetails?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  resolvedBy?: string;
}
