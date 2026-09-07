import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { Expense } from './entities/expense.entity';
import { CashBoxEntry } from './entities/cash-box-entry.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { PriceItem } from '../stock/entities/price-item.entity';
import { VehicleEvent } from '../vehicles/entities/vehicle-event.entity';
import { DailyAttendance } from '../hr/entities/daily-attendance.entity';
import { DailyWorker } from '../hr/entities/daily-worker.entity';
import { CashBoxController } from './cash-box.controller';
import { CashBoxService } from './cash-box.service';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, CashBoxEntry, StockMovement, PriceItem, VehicleEvent, DailyAttendance, DailyWorker])],
  controllers: [AccountingController, CashBoxController],
  providers: [AccountingService, CashBoxService],
  exports: [AccountingService],
})
export class AccountingModule {}
