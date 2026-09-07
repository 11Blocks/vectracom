import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as XLSX from 'xlsx';
import { Response } from 'express';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PerformanceDashboardService } from './performance-dashboard.service';

@Controller('performance')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class PerformanceDashboardController {
  constructor(private readonly perf: PerformanceDashboardService) {}

  /** Dashboard par équipe + OLT + motifs NOK (format fichiers S27→S30). */
  @Get('dashboard')
  dashboard(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('week') week?: string,
    @Query('year') year?: string,
  ) {
    this.requireTenant(companyId);
    return this.perf.dashboard(
      companyId!,
      from,
      to,
      week ? Number(week) : undefined,
      year ? Number(year) : undefined,
    );
  }

  /** Tendance hebdomadaire (S-4 → S). */
  @Get('trend')
  trend(@CurrentUser('companyId') companyId: string | null, @Query('weeks') weeks?: string) {
    this.requireTenant(companyId);
    return this.perf.trend(companyId!, weeks ? Math.min(26, Math.max(2, Number(weeks) || 5)) : 5);
  }

  /** Interprétation IA (ambre) — propose, ne décide jamais. */
  @Get('interpret')
  interpret(
    @CurrentUser('companyId') companyId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('week') week?: string,
    @Query('year') year?: string,
  ) {
    this.requireTenant(companyId);
    return this.perf.interpret(
      companyId!,
      from,
      to,
      week ? Number(week) : undefined,
      year ? Number(year) : undefined,
    );
  }

  /** Export Excel format ONECOMIT (Dashboard + Dashboard_OLT + Synthèse). */
  @Get('export')
  async export(
    @CurrentUser('companyId') companyId: string | null,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('week') week?: string,
    @Query('year') year?: string,
  ) {
    this.requireTenant(companyId);
    const buffer = await this.perf.exportExcel(
      companyId!,
      from,
      to,
      week ? Number(week) : undefined,
      year ? Number(year) : undefined,
    );
    const w = week ? `S${week}` : 'periode';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Dashboard_Performance_${w}.xlsx"`);
    res.send(buffer);
  }

  /** Import de la feuille DAILY d'un Dashboard_Performance (historique). */
  @Post('import-daily')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  importDaily(
    @CurrentUser('companyId') companyId: string | null,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.requireTenant(companyId);
    if (!file) throw new BadRequestException('Champ « file » manquant');
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('Fichier illisible : format Excel attendu');
    }
    const name =
      workbook.SheetNames.find((n) => n.toUpperCase() === 'DAILY') ??
      workbook.SheetNames.find((n) => n.toUpperCase().includes('DAILY'));
    if (!name) throw new BadRequestException('Onglet « DAILY » introuvable');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: null });
    return this.perf.importDaily(companyId!, rows);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
