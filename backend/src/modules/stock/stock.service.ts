import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse, WarehouseType } from './entities/warehouse.entity';
import { StockItem, StockCategory, StockFamily } from './entities/stock-item.entity';
import { ItemSerial, SerialStatus } from './entities/item-serial.entity';
import { StockLevel } from './entities/stock-level.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { CreateItemSerialDto } from './dto/create-item-serial.dto';

export interface LowStockAlert {
  stockItemId: string;
  reference: string;
  designation: string;
  thresholdAlert: number;
  totalQuantity: number;
}

/** Dépôts, articles, séries et niveaux — les mouvements vivent dans StockMovementService. */
@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(StockItem)
    private readonly stockItemRepository: Repository<StockItem>,
    @InjectRepository(ItemSerial)
    private readonly serialRepository: Repository<ItemSerial>,
    @InjectRepository(StockLevel)
    private readonly levelRepository: Repository<StockLevel>,
  ) {}

  // ------------------- Entrepôts -------------------

  async createWarehouse(companyId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    const name = dto.name.trim();
    const existing = await this.warehouseRepository.findOne({ where: { companyId, name } });
    if (existing) throw new ConflictException(`L'emplacement « ${name} » existe déjà`);
    return this.warehouseRepository.save(
      this.warehouseRepository.create({
        companyId,
        name,
        type: dto.type as WarehouseType,
        zone: dto.zone?.trim() ?? null,
      }),
    );
  }

  async listWarehouses(companyId: string, filters: { type?: string; zone?: string }) {
    const qb = this.warehouseRepository
      .createQueryBuilder('w')
      .where('w.company_id = :companyId', { companyId })
      .orderBy('w.name', 'ASC');
    if (filters.type) qb.andWhere('w.type = :type', { type: filters.type });
    if (filters.zone) qb.andWhere('w.zone ILIKE :zone', { zone: `%${filters.zone}%` });
    return qb.getMany();
  }

  async findWarehouse(companyId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({ where: { companyId, id } });
    if (!warehouse) throw new NotFoundException('Emplacement introuvable');
    return warehouse;
  }

  async updateWarehouse(companyId: string, id: string, dto: Partial<CreateWarehouseDto> & { name?: string; zone?: string | null }) {
    const warehouse = await this.findWarehouse(companyId, id);
    if (dto.name && dto.name !== warehouse.name) {
      const existing = await this.warehouseRepository.findOne({ where: { companyId, name: dto.name.trim() } });
      if (existing && existing.id !== id) throw new ConflictException('Nom déjà utilisé');
    }
    Object.assign(warehouse, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type as WarehouseType } : {}),
      ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
    });
    return this.warehouseRepository.save(warehouse);
  }

  async removeWarehouse(companyId: string, id: string) {
    const warehouse = await this.findWarehouse(companyId, id);
    const levels = await this.levelRepository.count({ where: { companyId, warehouseId: id } });
    if (levels > 0) {
      throw new ConflictException('Emplacement encore approvisionné — videz-le avant suppression');
    }
    await this.warehouseRepository.remove(warehouse);
    return { deleted: true };
  }

  // ------------------- Articles -------------------

  async createStockItem(companyId: string, dto: CreateStockItemDto): Promise<StockItem> {
    const reference = dto.reference.trim().toUpperCase();
    const existing = await this.stockItemRepository.findOne({ where: { companyId, reference } });
    if (existing) throw new ConflictException(`La référence « ${reference} » existe déjà`);
    return this.stockItemRepository.save(
      this.stockItemRepository.create({
        companyId,
        reference,
        designation: dto.designation.trim(),
        category: dto.category as StockCategory,
        family: dto.family as StockFamily,
        unit: dto.unit?.trim() ?? null,
        thresholdAlert: dto.thresholdAlert ?? 10,
      }),
    );
  }

  async listStockItems(
    companyId: string,
    filters: { category?: string; family?: string; lowStock?: boolean },
  ) {
    const qb = this.stockItemRepository
      .createQueryBuilder('item')
      .where('item.company_id = :companyId', { companyId })
      .orderBy('item.reference', 'ASC');
    if (filters.category) qb.andWhere('item.category = :category', { category: filters.category });
    if (filters.family) qb.andWhere('item.family = :family', { family: filters.family });

    let items = await qb.getMany();

    if (filters.lowStock) {
      const alerts = await this.checkLowStock(companyId);
      const alertIds = new Set(alerts.map((a) => a.stockItemId));
      items = items.filter((i) => alertIds.has(i.id));
    }
    return items;
  }

  async findStockItem(companyId: string, id: string): Promise<StockItem> {
    const item = await this.stockItemRepository.findOne({ where: { companyId, id } });
    if (!item) throw new NotFoundException('Article introuvable');
    return item;
  }

  async updateStockItem(companyId: string, id: string, dto: Partial<CreateStockItemDto>) {
    const item = await this.findStockItem(companyId, id);
    Object.assign(item, {
      ...(dto.reference !== undefined ? { reference: dto.reference.trim().toUpperCase() } : {}),
      ...(dto.designation !== undefined ? { designation: dto.designation.trim() } : {}),
      ...(dto.category !== undefined ? { category: dto.category as StockCategory } : {}),
      ...(dto.family !== undefined ? { family: dto.family as StockFamily } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.thresholdAlert !== undefined ? { thresholdAlert: dto.thresholdAlert } : {}),
    });
    return this.stockItemRepository.save(item);
  }

  async removeStockItem(companyId: string, id: string) {
    const item = await this.findStockItem(companyId, id);
    await this.stockItemRepository.remove(item);
    return { deleted: true };
  }

  // ------------------- Séries (ASSET) -------------------

  async createSerial(companyId: string, stockItemId: string, dto: CreateItemSerialDto): Promise<ItemSerial> {
    const item = await this.findStockItem(companyId, stockItemId);
    if (item.category !== 'ASSET') {
      throw new BadRequestException('Les numéros de série concernent uniquement les ASSET');
    }
    const serialNumber = dto.serialNumber.trim();
    const existing = await this.serialRepository.findOne({ where: { companyId, serialNumber } });
    if (existing) throw new ConflictException(`Le numéro de série « ${serialNumber} » existe déjà`);
    return this.serialRepository.save(
      this.serialRepository.create({
        companyId,
        stockItemId,
        serialNumber,
        status: (dto.status as SerialStatus) ?? 'disponible',
        currentWarehouseId: null,
      }),
    );
  }

  async listSerials(companyId: string, stockItemId: string): Promise<ItemSerial[]> {
    await this.findStockItem(companyId, stockItemId);
    return this.serialRepository.find({
      where: { companyId, stockItemId },
      order: { serialNumber: 'ASC' },
    });
  }

  async findSerial(companyId: string, id: string): Promise<ItemSerial> {
    const serial = await this.serialRepository.findOne({ where: { companyId, id } });
    if (!serial) throw new NotFoundException('Numéro de série introuvable');
    return serial;
  }

  // ------------------- Niveaux & seuils -------------------

  async levelsForItem(companyId: string, stockItemId: string) {
    await this.findStockItem(companyId, stockItemId);
    return this.levelRepository
      .createQueryBuilder('level')
      .leftJoinAndMapOne(
        'level.warehouse',
        Warehouse,
        'w',
        'w.id = level.warehouse_id',
      )
      .where('level.company_id = :companyId AND level.stock_item_id = :stockItemId', {
        companyId,
        stockItemId,
      })
      .getMany();
  }

  /** Alerte stock faible : total tous emplacements < seuil de l'article. */
  async checkLowStock(companyId: string): Promise<LowStockAlert[]> {
    const rows = await this.levelRepository.query(
      `SELECT i.id, i.reference, i.designation, i.threshold_alert, COALESCE(SUM(l.quantity), 0) AS total
       FROM stock_items i
       LEFT JOIN stock_levels l ON l.stock_item_id = i.id
       WHERE i.company_id = $1
       GROUP BY i.id, i.reference, i.designation, i.threshold_alert
       HAVING COALESCE(SUM(l.quantity), 0) < i.threshold_alert
       ORDER BY i.reference`,
      [companyId],
    );
    return rows.map((r: Record<string, string>) => ({
      stockItemId: r.id,
      reference: r.reference,
      designation: r.designation,
      thresholdAlert: Number(r.threshold_alert),
      totalQuantity: Number(r.total),
    }));
  }
}
