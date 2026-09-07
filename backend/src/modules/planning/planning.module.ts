import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningController } from './planning.controller';
import { DispositifController } from './dispositif.controller';
import { DispositifService } from './dispositif.service';
import { DispositifEntry } from './entities/dispositif-entry.entity';
import { PlanningService } from './planning.service';
import { ExcelImportController } from './sonatel-import/excel-import.controller';
import { ExcelImportService } from './sonatel-import/excel-import.service';
import { ColumnMappingController } from './sonatel-import/column-mapping.controller';
import { ColumnMappingService } from './sonatel-import/column-mapping.service';
import { PreviewStoreService } from './sonatel-import/preview-store.service';
import { SonatelColumnMapping } from './sonatel-import/column-mapping.entity';
import { Mission } from '../missions/entities/mission.entity';
import { Team } from '../teams/entities/team.entity';
import { Partner } from '../partners/entities/partner.entity';
import { Company } from '../auth/entities/company.entity';
import { TechniciansModule } from '../technicians/technicians.module';

@Module({
  imports: [TypeOrmModule.forFeature([SonatelColumnMapping, Mission, Partner, DispositifEntry, Team, Company]), TechniciansModule],
  controllers: [PlanningController, DispositifController, ExcelImportController, ColumnMappingController],
  providers: [PlanningService, DispositifService, ExcelImportService, ColumnMappingService, PreviewStoreService],
  exports: [PlanningService],
})
export class PlanningModule {}
