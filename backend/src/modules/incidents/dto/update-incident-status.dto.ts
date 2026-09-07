import { IsIn, IsOptional, IsString } from 'class-validator';
import { INCIDENT_STATUSES } from '../entities/incident.entity';

export class UpdateIncidentStatusDto {
  @IsIn(INCIDENT_STATUSES as unknown as string[])
  status!: string;

  @IsOptional()
  @IsString()
  validationNotes?: string;
}
