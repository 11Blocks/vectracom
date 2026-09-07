import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentExportService } from './incident-export.service';
import { PboImportService } from './pbo-import.service';
import { IncidentsExtraController } from './incidents-extra.controller';
import { Incident } from './entities/incident.entity';
import { Mission } from '../missions/entities/mission.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Mission])],
  controllers: [IncidentsController, IncidentsExtraController],
  providers: [IncidentsService, IncidentExportService, PboImportService, PdfGeneratorService],
  exports: [IncidentsService, TypeOrmModule],
})
export class IncidentsModule {}
