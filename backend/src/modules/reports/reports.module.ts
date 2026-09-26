import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceDashboardController } from './performance-dashboard.controller';
import { PerformanceDashboardService } from './performance-dashboard.service';
import { ReportsController } from './reports.controller';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';
import { PdfExporterService } from './exporters/pdf-exporter.service';
import { ExcelExporterService } from './exporters/excel-exporter.service';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Expense } from '../accounting/entities/expense.entity';
import { KpiSonatelModule } from '../kpi-sonatel/kpi-sonatel.module';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, MissionFieldReport, Technician, StockMovement, StockItem, Vehicle, Expense]),
    KpiSonatelModule,
  ],
  controllers: [ReportsController, PerformanceDashboardController, DashboardController],
  providers: [ReportsService, PdfExporterService, ExcelExporterService, PdfGeneratorService, PerformanceDashboardService, DashboardService],
  exports: [ReportsService],
})
export class ReportsModule {}
