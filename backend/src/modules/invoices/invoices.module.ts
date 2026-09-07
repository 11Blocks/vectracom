import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoiceExtrasController } from './invoice-extras.controller';
import { InvoiceExtrasService } from './invoice-extras.service';
import { InvoicesService } from './invoices.service';
import { InvoicesCronService } from './invoices-cron.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { InvoicePenalty } from './entities/invoice-penalty.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { Company } from '../auth/entities/company.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';
import { KpiSonatelModule } from '../kpi-sonatel/kpi-sonatel.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceLine, InvoicePenalty, Mission, MissionFieldReport, PriceItem, Company]),
    forwardRef(() => KpiSonatelModule),
    NotificationsModule,
    SettingsModule,
  ],
  controllers: [InvoicesController, InvoiceExtrasController],
  providers: [InvoicesService, InvoiceExtrasService, InvoicesCronService, PdfGeneratorService],
  exports: [InvoicesService, InvoicesCronService],
})
export class InvoicesModule {}
