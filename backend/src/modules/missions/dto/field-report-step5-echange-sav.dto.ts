import { IsOptional, IsUUID } from 'class-validator';

/** Étape 5 bis — Mode échange SAV : ancien et nouveau numéro de série. */
export class Step5EchangeSavDto {
  @IsOptional()
  @IsUUID()
  exchangeOldSerialId?: string;

  @IsOptional()
  @IsUUID()
  exchangeNewSerialId?: string;
}
