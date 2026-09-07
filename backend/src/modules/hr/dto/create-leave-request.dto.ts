import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Demande en 2 clics : employé + période (le motif est optionnel). */
export class CreateLeaveRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
