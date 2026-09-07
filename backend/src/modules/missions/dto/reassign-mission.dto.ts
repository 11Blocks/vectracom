import { IsArray, IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** Réaffectation d'une mission : équipe, binôme, véhicule, créneau. */
export class ReassignMissionDto {
  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  technicianIds?: string[];

  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @IsOptional()
  @IsISO8601()
  dateMission?: string;
}
