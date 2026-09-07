import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { PriceItemsController } from './price-items.controller';
import { StockService } from './stock.service';
import { StockMovementService } from './stock-movement.service';
import { SerialLifecycleController } from './serial-lifecycle.controller';
import { SerialLifecycleService } from './serial-lifecycle.service';
import { StockViewsService } from './stock-views.service';
import { FocusImportService } from './focus-import.service';
import { Team } from '../teams/entities/team.entity';
import { PriceItemsService } from './price-items.service';
import { Warehouse } from './entities/warehouse.entity';
import { StockItem } from './entities/stock-item.entity';
import { ItemSerial } from './entities/item-serial.entity';
import { ItemBatch } from './entities/item-batch.entity';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { PriceItem } from './entities/price-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, 
      Warehouse,
      StockItem,
      ItemSerial,
      ItemBatch,
      StockLevel,
      StockMovement,
      PriceItem,
    ]),
  ],
  controllers: [StockController, PriceItemsController, SerialLifecycleController],
  providers: [
    StockService,
    StockMovementService,
    PriceItemsService,
    SerialLifecycleService,
    StockViewsService,
    FocusImportService,
  ],
  exports: [StockService, StockMovementService, PriceItemsService],
})
export class StockModule {}
