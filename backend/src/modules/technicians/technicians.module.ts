import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';
import { TechnicianResolverService } from './technician-resolver.service';
import { Technician } from './entities/technician.entity';
import { Team } from '../teams/entities/team.entity';
import { Mission } from '../missions/entities/mission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Technician, Team, Mission])],
  controllers: [TechniciansController],
  providers: [TechniciansService, TechnicianResolverService],
  exports: [TechniciansService, TechnicianResolverService],
})
export class TechniciansModule {}
