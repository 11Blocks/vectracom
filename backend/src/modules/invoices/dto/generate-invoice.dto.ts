import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GenerateInvoiceDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
