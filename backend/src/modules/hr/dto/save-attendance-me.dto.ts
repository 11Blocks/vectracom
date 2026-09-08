import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

/** Feuille de présence hebdo pour le technicien du JWT (sans technicianId client). */
export class SaveAttendanceMeDto {
  /** Lundi de la semaine (normalisé si un autre jour est fourni). */
  @IsDateString()
  weekStart!: string;

  @IsOptional() @IsBoolean() monday?: boolean;
  @IsOptional() @IsBoolean() tuesday?: boolean;
  @IsOptional() @IsBoolean() wednesday?: boolean;
  @IsOptional() @IsBoolean() thursday?: boolean;
  @IsOptional() @IsBoolean() friday?: boolean;
  @IsOptional() @IsBoolean() saturday?: boolean;
  @IsOptional() @IsBoolean() sunday?: boolean;

  @IsOptional()
  @IsString()
  comments?: string;
}
