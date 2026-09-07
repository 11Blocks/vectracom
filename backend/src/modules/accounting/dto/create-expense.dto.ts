import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { EXPENSE_CATEGORIES } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES as unknown as string[])
  category!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  receiptPhotoUrl?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @IsOptional()
  @IsUUID()
  technicianId?: string | null;

  @IsOptional()
  @IsUUID()
  missionId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  /** Positionné à true quand les champs viennent d'une proposition IA validée. */
  @IsOptional()
  @IsBoolean()
  aiExtracted?: boolean;
}
