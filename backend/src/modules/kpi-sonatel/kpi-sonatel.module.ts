import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiSonatelController } from './kpi-sonatel.controller';
import { KpiSonatelService } from './kpi-sonatel.service';
import { KpiSonatelCronService } from './kpi-sonatel-cron.service';
import { SonatelKpiLog } from './entities/sonatel-kpi-log.entity';
import { SonatelKpiAlert } from './entities/sonatel-kpi-alert.entity';
import { KpiTcoInput } from './entities/kpi-tco-input.entity';
import { KpiMasteryPlan } from './entities/kpi-mastery-plan.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { Team } from '../teams/entities/team.entity';
import { ComplianceRecord } from '../compliance/entities/compliance-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Attendance } from '../hr/entities/attendance.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { InvoicePenalty } from '../invoices/entities/invoice-penalty.entity';
import { Company } from '../auth/entities/company.entity';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SonatelKpiLog,
      SonatelKpiAlert,
      KpiTcoInput,
      KpiMasteryPlan,
      Mission,
      MissionFieldReport,
      Team,
      ComplianceRecord,
      Incident,
      Attendance,
      StockMovement,
      Invoice,
      InvoiceLine,
      InvoicePenalty,
      Company,
    ]),
    forwardRef(() => InvoicesModule),
  ],
  controllers: [KpiSonatelController],
  providers: [KpiSonatelService, KpiSonatelCronService],
  exports: [KpiSonatelService, KpiSonatelCronService],
})
export class KpiSonatelModule {}
