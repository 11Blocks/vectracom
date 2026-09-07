import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SERIAL_STATUSES } from '../entities/item-serial.entity';

export class CreateItemSerialDto {
  @IsString()
  @MinLength(3)
  serialNumber!: string;

  @IsOptional()
  @IsIn(SERIAL_STATUSES as unknown as string[])
  status?: string;
}
