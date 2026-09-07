import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ComplianceChecklistTemplate } from './entities/checklist-template.entity';
import { ComplianceRecord } from './entities/compliance-record.entity';
import { CompanyComplianceDocument } from './entities/company-compliance-document.entity';
import { Team } from '../teams/entities/team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceChecklistTemplate, ComplianceRecord, CompanyComplianceDocument, Team])],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
