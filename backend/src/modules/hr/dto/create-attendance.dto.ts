import { IsDateString, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

/** Feuille de présence hebdo (upsert par technicien × semaine). */
export class CreateAttendanceDto {
  @IsUUID()
  technicianId!: string;

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
