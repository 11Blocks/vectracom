import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PlanningModule } from './modules/planning/planning.module';
import { MissionsModule } from './modules/missions/missions.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { StockModule } from './modules/stock/stock.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { SiteChecklistModule } from './modules/site-checklist/site-checklist.module';
import { HrModule } from './modules/hr/hr.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { KpiSonatelModule } from './modules/kpi-sonatel/kpi-sonatel.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { IaVisionModule } from './modules/ia-vision/ia-vision.module';
import { SaasModule } from './modules/saas/saas.module';
import { GeolocationModule } from './modules/geolocation/geolocation.module';
import { PartnersModule } from './modules/partners/partners.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { BusinessModule } from './modules/business/business.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FilesModule } from './modules/files/files.module';
import { ChatModule } from './modules/chat/chat.module';
import { HealthController } from './modules/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        // Colonnes snake_case pour correspondre aux migrations SQL (infra/postgres/migrations)
        namingStrategy: new SnakeNamingStrategy(),
        // En dev : synchro des entités ; en prod : migrations SQL
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('DB_LOGGING') === 'true',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),
    AuthModule,
    TenantsModule,
    PlanningModule,
    MissionsModule,
    TeamsModule,
    TechniciansModule,
    StockModule,
    VehiclesModule,
    ComplianceModule,
    SiteChecklistModule,
    HrModule,
    AccountingModule,
    InvoicesModule,
    KpiSonatelModule,
    ReportsModule,
    IncidentsModule,
    GeolocationModule,
    PartnersModule,
    IaVisionModule,
    SaasModule,
    MonitoringModule,
    BusinessModule,
    NotificationsModule,
    AiModule,
    SettingsModule,
    FilesModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
