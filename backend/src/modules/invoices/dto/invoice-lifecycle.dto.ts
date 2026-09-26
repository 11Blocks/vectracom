import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { INVOICE_CATEGORIES } from '../entities/invoice-line.entity';
import { PAYMENT_METHODS } from '../entities/invoice-payment.entity';

export class InvoiceLineInputDto {
  @IsString() @MinLength(2) @MaxLength(300) itemType!: string;

  @IsOptional() @IsIn(INVOICE_CATEGORIES as unknown as string[]) category?: string;

  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice!: number;

  @IsOptional() @IsString() @MaxLength(20) unit?: string;
}

export class CreateManualInvoiceDto {
  @IsOptional() @IsUUID() clientId?: string;

  @IsOptional() @IsString() @MaxLength(200) title?: string;

  @IsOptional() @IsDateString() issueDate?: string;

  @IsOptional() @IsDateString() dueDate?: string;

  @IsOptional() @IsDateString() periodStart?: string;

  @IsOptional() @IsDateString() periodEnd?: string;

  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;

  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines!: InvoiceLineInputDto[];
}

export class UpdateInvoiceHeaderDto {
  @IsOptional() @IsUUID() clientId?: string | null;

  @IsOptional() @IsString() @MaxLength(200) title?: string | null;

  @IsOptional() @IsDateString() issueDate?: string | null;

  @IsOptional() @IsDateString() dueDate?: string | null;

  @IsOptional() @IsDateString() periodStart?: string;

  @IsOptional() @IsDateString() periodEnd?: string;

  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;

  /** Taux décimal (0.18) ; null pour reprendre le taux des Paramètres. */
  @IsOptional() @IsNumber() @Min(0) @Max(1) tvaRate?: number | null;

  @IsOptional() @IsString() notes?: string | null;
}

export class AddPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;

  @IsDateString() paidAt!: string;

  @IsOptional() @IsIn(PAYMENT_METHODS as unknown as string[]) method?: string;

  @IsOptional() @IsString() @MaxLength(120) reference?: string;

  @IsOptional() @IsString() note?: string;
}

export class CancelInvoiceDto {
  @IsString() @MinLength(3) reason!: string;
}

export class ClientDto {
  @IsString() @MinLength(2) @MaxLength(200) name!: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() ninea?: string;
  @IsOptional() @IsString() rccm?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsString() code?: string | null;
  @IsOptional() @IsString() ninea?: string | null;
  @IsOptional() @IsString() rccm?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
