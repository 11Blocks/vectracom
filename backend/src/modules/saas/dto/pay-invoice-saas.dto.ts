import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PAYMENT_METHODS } from '../invoices-saas/entities/invoice-saas.entity';

export class PayInvoiceSaasDto {
  @IsIn(PAYMENT_METHODS as unknown as string[])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  reference?: string;
}
