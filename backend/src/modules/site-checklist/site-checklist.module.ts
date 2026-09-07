import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteChecklistController } from './site-checklist.controller';
import { SiteChecklistService } from './site-checklist.service';
import { SiteChecklistTemplate } from './entities/site-checklist-template.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';
import { PriceItem } from '../stock/entities/price-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteChecklistTemplate, Mission, MissionFieldReport, PriceItem])],
  controllers: [SiteChecklistController],
  providers: [SiteChecklistService],
  exports: [SiteChecklistService],
})
export class SiteChecklistModule {}
