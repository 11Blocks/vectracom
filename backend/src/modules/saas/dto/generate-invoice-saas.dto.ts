import { IsDateString } from 'class-validator';

export class GenerateInvoiceSaasDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
