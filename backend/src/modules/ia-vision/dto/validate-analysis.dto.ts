import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ValidateAnalysisDto {
  @IsIn(['valide', 'corrige', 'rejete'])
  validationStatus!: string;

  /** Corrections humaines : { rubrique?, pboDefaut?, pboReference?, pioType?, pioEtat?, chambreType?, chambreEtat?, severity? }. */
  @IsOptional()
  @IsObject()
  corrections?: Record<string, string>;

  @IsOptional()
  @IsString()
  correctionNotes?: string;
}
