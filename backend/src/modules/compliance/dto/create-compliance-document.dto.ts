import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { COMPLIANCE_DOC_TYPES } from '../entities/company-compliance-document.entity';

export class CreateComplianceDocumentDto {
  @IsIn(COMPLIANCE_DOC_TYPES as unknown as string[])
  docType!: string;

  @IsString()
  @MinLength(4)
  fileUrl!: string;

  @IsOptional()
  @IsBoolean()
  signed?: boolean;

  @IsOptional()
  @IsDateString()
  signedAt?: string;
}

export class UpdateComplianceDocumentDto {
  @IsOptional() @IsBoolean() signed?: boolean;
  @IsOptional() @IsDateString() signedAt?: string | null;
  @IsOptional() @IsString() @MinLength(4) fileUrl?: string;
}
