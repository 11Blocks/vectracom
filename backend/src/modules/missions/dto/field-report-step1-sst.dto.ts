import { IsObject, IsOptional, IsString } from 'class-validator';

/** Étape 1 — Sécurité SST (bloquante) : checklist EPI + photo. */
export class Step1SstDto {
  @IsObject()
  sstChecklist!: Record<string, boolean>;

  @IsOptional()
  @IsString()
  sstPhotoUrl?: string;
}
