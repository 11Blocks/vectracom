import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChecklistItem } from '../entities/checklist-template.entity';
import { COMPLIANCE_STATUSES } from '../entities/compliance-record.entity';

class ChecklistItemDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsBoolean()
  required!: boolean;
}

export class CreateChecklistTemplateDto {
  @IsString()
  @MinLength(2)
  missionType!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItem[];
}

export class UpdateChecklistTemplateDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items?: ChecklistItem[];
}

export class CreateComplianceRecordDto {
  @IsUUID()
  teamId!: string;
}

export class UpdateComplianceRecordDto {
  @IsOptional()
  @IsIn(COMPLIANCE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsString()
  observations?: string | null;
}
