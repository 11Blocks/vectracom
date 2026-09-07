import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessController } from './business.controller';
import { BusinessMonitoringService } from './business.service';
import { Company } from '../auth/entities/company.entity';
import { User } from '../auth/entities/user.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { SaasAddon } from '../saas/entities/saas-addon.entity';
import { InvoiceSaas } from '../saas/invoices-saas/entities/invoice-saas.entity';
import { SaasTransaction } from '../saas/invoices-saas/entities/saas-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, User, CompanySubscription, SaasAddon, InvoiceSaas, SaasTransaction]),
  ],
  controllers: [BusinessController],
  providers: [BusinessMonitoringService],
  exports: [BusinessMonitoringService],
})
export class BusinessModule {}
