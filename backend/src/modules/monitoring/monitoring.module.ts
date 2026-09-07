import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringCronService } from './monitoring-cron.service';
import { PlatformMonitoringLog } from './entities/platform-monitoring-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformMonitoringLog])],
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringCronService],
  exports: [MonitoringService, MonitoringCronService],
})
export class MonitoringModule {}
