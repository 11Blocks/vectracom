import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService, ReportId } from './reports.service';
import { PdfExporterService } from './exporters/pdf-exporter.service';
import { ExcelExporterService } from './exporters/excel-exporter.service';

const REPORT_IDS: ReportId[] = ['performance', 'olt', 'stock-vehicles', 'kpi', 'incidents', 'planning'];

const REPORT_TITLES: Record<ReportId, string> = {
  performance: 'Performance missions et techniciens',
  olt: 'Activite par zone OLT',
  'stock-vehicles': 'Usage stock et vehicules',
  kpi: 'KPI SONATEL',
  planning: 'Planning mensuel',
  incidents: 'Incidents reseau',
};

class PeriodQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate attendu : YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate attendu : YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month attendu : YYYY-MM' })
  month?: string;
}

class ExportReportDto {
  @IsIn(REPORT_IDS as unknown as string[])
  report!: ReportId;

  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}$/) month?: string;
}

@Controller('reports')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfExporter: PdfExporterService,
    private readonly excelExporter: ExcelExporterService,
  ) {}

  @Get('performance')
  performance(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: PeriodQueryDto,
  ) {
    this.requireTenant(companyId, query);
    return this.reportsService.getPerformanceReport(companyId!, query.startDate!, query.endDate!);
  }

  @Get('olt')
  olt(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: PeriodQueryDto,
  ) {
    this.requireTenant(companyId, query);
    return this.reportsService.getOltReport(companyId!, query.startDate!, query.endDate!);
  }

  @Get('stock-vehicles')
  stockVehicles(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: PeriodQueryDto,
  ) {
    this.requireTenant(companyId, query);
    return this.reportsService.getStockVehiclesReport(companyId!, query.startDate!, query.endDate!);
  }

  @Get('kpi')
  kpi(
    @CurrentUser('companyId') companyId: string | null,
    @Query('month') month?: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.reportsService.getKpiReport(companyId, month ?? new Date().toISOString().slice(0, 7));
  }

  @Get('incidents')
  incidents(
    @CurrentUser('companyId') companyId: string | null,
    @Query() query: PeriodQueryDto,
  ) {
    this.requireTenant(companyId, query);
    return this.reportsService.getIncidentsReport(companyId!, query.startDate!, query.endDate!);
  }

  @Post('export-pdf')
  @HttpCode(200)
  async exportPdf(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    const sections = await this.reportsService.toSections(companyId, dto.report, dto);
    const period = dto.month ?? `${dto.startDate ?? ''} -> ${dto.endDate ?? ''}`;
    const { buffer, fileName } = this.pdfExporter.export(REPORT_TITLES[dto.report], period, sections);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Post('export-excel')
  @HttpCode(200)
  async exportExcel(
    @CurrentUser('companyId') companyId: string | null,
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    const sections = await this.reportsService.toSections(companyId, dto.report, dto);
    const { buffer, fileName } = this.excelExporter.export(REPORT_TITLES[dto.report], sections);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  private requireTenant(companyId: string | null, query: PeriodQueryDto): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('startDate et endDate requis (YYYY-MM-DD)');
    }
  }
}
