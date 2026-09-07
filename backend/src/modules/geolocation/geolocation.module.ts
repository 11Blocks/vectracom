import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeolocationController } from './geolocation.controller';
import { GeolocationService } from './geolocation.service';
import { Geoposition } from './entities/geoposition.entity';
import { GeofenceZone } from './entities/geofence-zone.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { Mission } from '../missions/entities/mission.entity';
import { MissionFieldReport } from '../missions/entities/field-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Geoposition, GeofenceZone, CompanySubscription, Technician, Mission, MissionFieldReport]),
  ],
  controllers: [GeolocationController],
  providers: [GeolocationService],
  exports: [GeolocationService],
})
export class GeolocationModule {}
