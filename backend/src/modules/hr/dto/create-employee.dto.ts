import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EMPLOYEE_STATUSES } from '../entities/employee.entity';

class EmployeeDocumentDto {
  @IsIn(['CNI', 'CONTRAT', 'CV', 'DIPLOME', 'CERTIFICAT', 'ATTESTATION', 'PERMIS'])
  type!: string;

  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @IsOptional()
  @IsString()
  matricule?: string;

  @IsOptional()
  @IsIn(EMPLOYEE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsDateString()
  habilitationExpiration?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeDocumentDto)
  documents?: EmployeeDocumentDto[];
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsString() jobTitle?: string | null;
  @IsOptional() @IsUUID() teamId?: string | null;
  @IsOptional() @IsUUID() vehicleId?: string | null;
  @IsOptional() @IsString() matricule?: string | null;
  @IsOptional() @IsIn(EMPLOYEE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsDateString() habilitationExpiration?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EmployeeDocumentDto)
  documents?: EmployeeDocumentDto[];
}
