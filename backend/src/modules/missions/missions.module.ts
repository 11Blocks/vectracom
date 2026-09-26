import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionsController } from './missions.controller';
import { MissionTemplatesController } from './mission-templates.controller';
import { MissionsService } from './missions.service';
import { MissionTemplatesService } from './mission-templates.service';
import { FieldReportService } from './field-report.service';
import { QualityScoreService } from './quality-score.service';
import { PvRecetteService } from './pv-recette.service';
import { Mission } from './entities/mission.entity';
import { MissionFieldReport } from './entities/field-report.entity';
import { MissionTypeTemplate } from './entities/mission-type-template.entity';
import { Team } from '../teams/entities/team.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Company } from '../auth/entities/company.entity';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, MissionFieldReport, MissionTypeTemplate, Company, Team, Vehicle]),
    GeolocationModule,
    SettingsModule,
  ],
  controllers: [MissionsController, MissionTemplatesController],
  providers: [
    MissionsService,
    MissionTemplatesService,
    FieldReportService,
    QualityScoreService,
    PvRecetteService,
    PdfGeneratorService,
  ],
  exports: [MissionsService, MissionTemplatesService, FieldReportService, QualityScoreService],
})
export class MissionsModule {}
