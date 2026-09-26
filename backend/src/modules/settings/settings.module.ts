import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanySetting } from './entities/company-setting.entity';
import { SettingsChangeLog } from './entities/settings-change-log.entity';
import { Company } from '../auth/entities/company.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { CompanyProfileController } from './company-profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanySetting, SettingsChangeLog, Company])],
  controllers: [SettingsController, CompanyProfileController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
