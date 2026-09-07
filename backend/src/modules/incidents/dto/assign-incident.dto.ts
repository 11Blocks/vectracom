import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignIncidentDto {
  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  technicianIds?: string[];

  @IsOptional()
  @IsString()
  validationNotes?: string;
}
