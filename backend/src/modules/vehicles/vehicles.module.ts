import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleEvent } from './entities/vehicle-event.entity';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleCheck } from './entities/vehicle-check.entity';
import { VehicleDocument } from './entities/vehicle-document.entity';
import { Warehouse } from '../stock/entities/warehouse.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, VehicleCheck, VehicleDocument, VehicleEvent, Warehouse])],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
