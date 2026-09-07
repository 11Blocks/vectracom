import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IncidentsService } from './incidents.service';
import { IncidentExportService } from './incident-export.service';
import { PboImportService } from './pbo-import.service';

/* DTOs replacés plus bas par import du fichier existant — voir ci-dessous. */
export { };

class GenerateSavDto {
  @IsIn(['groupee', 'individuelle'])
  mode!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsString()
  dateMission?: string;
}

class PboConfirmDto {
  @IsArray()
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;
}

@Controller('incidents')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class IncidentsExtraController {
  constructor(
    private readonly incidentExports: IncidentExportService,
    private readonly pboImport: PboImportService,
  ) {}

  // ── Exports 3 rubriques au format SONATEL (période de transition) ──

  @Get('export/pbo')
  async exportPbo(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.incidentExports.exportPbo(companyId!, from, to);
    res?.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res?.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res?.send(buffer);
  }

  @Get('export/poi')
  async exportPoi(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.incidentExports.exportPoi(companyId!, from, to);
    res?.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res?.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res?.send(buffer);
  }

  @Get('export/chambre')
  async exportChambre(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    this.requireTenant(companyId);
    const { buffer, fileName } = await this.incidentExports.exportChambre(companyId!, from, to);
    res?.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res?.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res?.send(buffer);
  }

  // ── Import PBO À CHANGER ──

  @Post('import/pbo-preview')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  pboPreview(
    @CurrentUser('companyId') companyId: string | null,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.requireTenant(companyId);
    if (!file) throw new BadRequestException('Champ « file » manquant');
    return this.pboImport.preview(file, companyId!);
  }

  @Post('import/pbo-confirm')
  pboConfirm(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: PboConfirmDto,
    @Query('fileName') fileName?: string,
  ) {
    this.requireTenant(companyId);
    return this.pboImport.confirm(companyId!, dto.rows as never, fileName ?? 'PBO À CHANGER.xlsx');
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
