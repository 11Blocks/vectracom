import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { MailService } from '../mail/mail.service';
import { AuditController } from './audit.controller';

/** Services transverses globaux : journal d'audit métier et envoi d'emails. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, MailService],
  exports: [AuditService, MailService],
})
export class AuditModule {}
