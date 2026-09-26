import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsBooleanString, IsIn, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StockService } from './stock.service';
import { StockMovementService } from './stock-movement.service';
import { FocusImportService } from './focus-import.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { CreateItemSerialDto } from './dto/create-item-serial.dto';
import { CancelStockMovementDto, CreateStockMovementDto, InventoryDto } from './dto/create-stock-movement.dto';
import { WAREHOUSE_TYPES } from './entities/warehouse.entity';
import { STOCK_CATEGORIES, STOCK_FAMILIES } from './entities/stock-item.entity';
import { MOVEMENT_TYPES } from './entities/stock-movement.entity';

class ListWarehousesQueryDto {
  @IsOptional() @IsString() @IsIn(WAREHOUSE_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() zone?: string;
}

class ListStockItemsQueryDto {
  @IsOptional() @IsString() @IsIn(STOCK_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsString() @IsIn(STOCK_FAMILIES as unknown as string[]) family?: string;
  @IsOptional() @IsBooleanString() lowStock?: string;
}

class ListMovementsQueryDto {
  @IsOptional() @IsString() @IsIn(MOVEMENT_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsUUID() stockItemId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() missionId?: string;
  @IsOptional() @IsBooleanString() includeCancelled?: string;
  @IsOptional() @IsNumberString() limit?: string;
}

@Controller()
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly movementService: StockMovementService,
    private readonly focusImport: FocusImportService,
  ) {}

  /** Import FOCUS multi-dépôts (Excel). */
  @Post('stock/focus-import')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  importFocus(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.requireTenant(companyId);
    if (!file?.buffer?.length) throw new BadRequestException('Fichier Excel requis (champ file)');
    return this.focusImport.import(companyId!, file.buffer, userId);
  }

  // ------------------- Entrepôts -------------------

  @Get('warehouses')
  warehouses(@CurrentUser('companyId') companyId: string | null, @Query() query: ListWarehousesQueryDto) {
    this.requireTenant(companyId);
    return this.stockService.listWarehouses(companyId!, { type: query.type, zone: query.zone });
  }

  @Post('warehouses')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  createWarehouse(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateWarehouseDto) {
    this.requireTenant(companyId);
    return this.stockService.createWarehouse(companyId!, dto);
  }

  @Get('warehouses/:id')
  warehouse(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.findWarehouse(companyId!, id);
  }

  @Put('warehouses/:id')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  updateWarehouse(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    this.requireTenant(companyId);
    return this.stockService.updateWarehouse(companyId!, id, dto);
  }

  @Delete('warehouses/:id')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  removeWarehouse(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.removeWarehouse(companyId!, id);
  }

  // ------------------- Articles -------------------

  @Get('stock-items')
  stockItems(@CurrentUser('companyId') companyId: string | null, @Query() query: ListStockItemsQueryDto) {
    this.requireTenant(companyId);
    return this.stockService.listStockItems(companyId!, {
      category: query.category,
      family: query.family,
      lowStock: query.lowStock === 'true',
    });
  }

  @Post('stock-items')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  createStockItem(@CurrentUser('companyId') companyId: string | null, @Body() dto: CreateStockItemDto) {
    this.requireTenant(companyId);
    return this.stockService.createStockItem(companyId!, dto);
  }

  @Get('stock-items/low-stock')
  lowStock(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.stockService.checkLowStock(companyId!);
  }

  @Get('stock-items/:id')
  stockItem(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.findStockItem(companyId!, id);
  }

  @Put('stock-items/:id')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  updateStockItem(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateStockItemDto,
  ) {
    this.requireTenant(companyId);
    return this.stockService.updateStockItem(companyId!, id, dto);
  }

  @Delete('stock-items/:id')
  @Roles(UserRole.ADMIN)
  removeStockItem(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.removeStockItem(companyId!, id);
  }

  @Get('stock-items/:id/serials')
  serials(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.listSerials(companyId!, id);
  }

  @Post('stock-items/:id/serials')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  createSerial(
    @CurrentUser('companyId') companyId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateItemSerialDto,
  ) {
    this.requireTenant(companyId);
    return this.stockService.createSerial(companyId!, id, dto);
  }

  @Get('stock-items/:id/levels')
  levels(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.stockService.levelsForItem(companyId!, id);
  }

  // ------------------- Mouvements -------------------

  @Get('stock-movements')
  movements(@CurrentUser('companyId') companyId: string | null, @Query() query: ListMovementsQueryDto) {
    this.requireTenant(companyId);
    return this.movementService.list(companyId!, {
      type: query.type,
      stockItemId: query.stockItemId,
      warehouseId: query.warehouseId,
      missionId: query.missionId,
      includeCancelled: query.includeCancelled !== 'false',
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post('stock-movements')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER, UserRole.CHEF_EQUIPE)
  createMovement(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    this.requireTenant(companyId);
    return this.movementService.create(companyId!, dto, { id: userId, role });
  }

  @Post('stock-movements/inventory')
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  inventory(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: InventoryDto,
  ) {
    this.requireTenant(companyId);
    return this.movementService.inventory(companyId!, dto, { id: userId, role });
  }

  @Post('stock-movements/:id/cancel')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MAGASINIER)
  cancelMovement(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelStockMovementDto,
  ) {
    this.requireTenant(companyId);
    return this.movementService.cancel(companyId!, id, dto.reason, { id: userId, role });
  }

  @Get('stock-serials/:id/traceability')
  traceability(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    this.requireTenant(companyId);
    return this.movementService.traceability(companyId!, id);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
