import { IsOptional, IsString } from 'class-validator';

/** Le validateur vient du JWT (validatedBy) — jamais du client. */
export class FinalizeInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
