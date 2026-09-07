import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaasController } from './saas.controller';
import { SaasService, SubscriptionService } from './saas.service';
import { SaasCronService } from './saas-cron.service';
import { InvoicesSaasService } from './invoices-saas/invoices-saas.service';
import { SaasPlan } from './entities/saas-plan.entity';
import { SaasAddon } from './entities/saas-addon.entity';
import { SaasLimit } from './entities/saas-limit.entity';
import { CompanySubscription } from './entities/company-subscription.entity';
import { SaasUsageTracking } from './entities/saas-usage-tracking.entity';
import { SaasOverageBill } from './entities/saas-overage-bill.entity';
import { InvoiceSaas } from './invoices-saas/entities/invoice-saas.entity';
import { SaasTransaction } from './invoices-saas/entities/saas-transaction.entity';
import { User } from '../auth/entities/user.entity';
import { Company } from '../auth/entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasPlan,
      SaasAddon,
      SaasLimit,
      CompanySubscription,
      SaasUsageTracking,
      SaasOverageBill,
      InvoiceSaas,
      SaasTransaction,
      User,
      Company,
    ]),
  ],
  controllers: [SaasController],
  providers: [SaasService, SubscriptionService, InvoicesSaasService, SaasCronService],
  exports: [SaasService, SubscriptionService, InvoicesSaasService, SaasCronService],
})
export class SaasModule {}
