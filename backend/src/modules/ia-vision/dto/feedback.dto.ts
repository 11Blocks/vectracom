import { IsBooleanString, IsOptional } from 'class-validator';

export class FeedbackQueryDto {
  @IsOptional()
  @IsBooleanString()
  processed?: string;
}
