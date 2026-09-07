import { IsDateString } from 'class-validator';

export class GenerateInvoiceDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
