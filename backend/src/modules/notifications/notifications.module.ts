import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsCronService } from './notifications-cron.service';
import { Notification } from './entities/notification.entity';
import { NotificationSetting } from './entities/notification-settings.entity';
import { PushToken } from './entities/push-token.entity';
import { User } from '../auth/entities/user.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { InvoiceSaas } from '../saas/invoices-saas/entities/invoice-saas.entity';
import { Company } from '../auth/entities/company.entity';
import { ExpoService } from './integrations/expo.service';
import { WhatsAppService } from './integrations/whatsapp.service';
import { EmailService } from './integrations/email.service';
import { TelegramService } from './integrations/telegram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationSetting,
      PushToken,
      User,
      Vehicle,
      Technician,
      StockItem,
      StockLevel,
      InvoiceSaas,
      Company,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsCronService, ExpoService, WhatsAppService, EmailService, TelegramService],
  exports: [NotificationsService, NotificationsCronService],
})
export class NotificationsModule {}
