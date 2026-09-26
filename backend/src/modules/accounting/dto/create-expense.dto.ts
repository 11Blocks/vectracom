import {
  IsBoolean,
  IsDateString,
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

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  /** Date du reçu (défaut : aujourd'hui). */
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

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

export class UpdateExpenseDto {
  @IsOptional() @IsIn(EXPENSE_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount?: number;
  @IsOptional() @IsDateString() expenseDate?: string;
  @IsOptional() @IsString() receiptPhotoUrl?: string | null;
  @IsOptional() @IsUUID() vehicleId?: string | null;
  @IsOptional() @IsUUID() technicianId?: string | null;
  @IsOptional() @IsUUID() missionId?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() aiExtracted?: boolean;
}
