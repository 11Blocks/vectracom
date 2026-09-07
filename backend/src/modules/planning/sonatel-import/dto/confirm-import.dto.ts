import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Confirmation d'un import après aperçu.
 * selectedRows : liste des n° de dossier à importer ; omis/vide = tout
 * ce qui est importable (nouvelle + mise_a_jour).
 */
export class ConfirmImportDto {
  @IsUUID()
  fileId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedRows?: string[];

  /** Écrasé par le TenantGuard — jamais lu depuis le client. */
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
