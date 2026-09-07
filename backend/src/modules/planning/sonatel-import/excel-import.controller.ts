import { BadRequestException, Body, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles, UserRole } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ExcelImportService } from './excel-import.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';

const xlsxFilter = (req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  const ok = /\.(xlsx|xlsm|xls)$/i.test(file.originalname);
  cb(ok ? null : new Error('Seuls les fichiers Excel (.xlsx/.xls) sont acceptés'), ok);
};

@Controller('planning/import')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ExcelImportController {
  constructor(private readonly excelImportService: ExcelImportService) {}

  /** Upload du fichier SONATEL → aperçu avant validation. */
  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: xlsxFilter,
    }),
  )
  preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('companyId') companyId: string | null,
    @Query('includeTraitees') includeTraitees?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Champ « file » manquant (multipart/form-data)');
    }
    if (!companyId) {
      throw new BadRequestException('Import réservé aux comptes rattachés à un tenant');
    }
    return this.excelImportService.preview(file, companyId, { includeTraitees: includeTraitees === 'true' });
  }

  /** Confirme l'aperçu → écriture idempotente des missions. */
  @Post('confirm')
  confirm(
    @Body() dto: ConfirmImportDto,
    @CurrentUser('companyId') companyId: string | null,
  ) {
    if (!companyId) {
      throw new BadRequestException('Import réservé aux comptes rattachés à un tenant');
    }
    return this.excelImportService.confirm(dto.fileId, companyId, dto.selectedRows);
  }
}
