import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StockMovement, MovementType } from './entities/stock-movement.entity';
import { StockItem } from './entities/stock-item.entity';
import { ItemSerial } from './entities/item-serial.entity';
import { Warehouse } from './entities/warehouse.entity';
import { StockLevel } from './entities/stock-level.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockService, LowStockAlert } from './stock.service';

/** Règles d'emplacements par type de mouvement. */
const REQUIREMENTS: Record<MovementType, { from: boolean; to: boolean }> = {
  entree: { from: false, to: true },
  transfert: { from: true, to: true },
  affectation: { from: true, to: true },
  consommation: { from: true, to: false },
  // Échange SAV : ancien récupéré (marqué defectueux) + nouveau posé.
  // Le nouveau part du stock via sa propre consommation ; l'ancien, déjà
  // sorti, revient au dépôt si une destination est fournie.
  echange_sav: { from: false, to: false },
  ajustement: { from: false, to: true },
  retour: { from: false, to: true },
};

@Injectable()
export class StockMovementService {
  private readonly logger = new Logger(StockMovementService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  async create(companyId: string, dto: CreateStockMovementDto) {
    const item = await this.stockService.findStockItem(companyId, dto.stockItemId);
    const type = dto.type as MovementType;
    const req = REQUIREMENTS[type];

    if (req.from && !dto.fromWarehouseId) {
      throw new BadRequestException(`Mouvement « ${type} » : emplacement source (fromWarehouseId) requis`);
    }
    if (req.to && !dto.toWarehouseId) {
      throw new BadRequestException(`Mouvement « ${type} » : emplacement destination (toWarehouseId) requis`);
    }
    if (dto.fromWarehouseId && dto.toWarehouseId && dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source et destination identiques');
    }

    for (const wid of [dto.fromWarehouseId, dto.toWarehouseId]) {
      if (wid) await this.assertWarehouse(companyId, wid);
    }

    let serial: ItemSerial | null = null;
    if (item.category === 'ASSET') {
      if (!dto.itemSerialId) {
        throw new BadRequestException('ASSET : numéro de série (itemSerialId) obligatoire');
      }
      if (dto.quantity !== 1) {
        throw new BadRequestException('ASSET : la quantité doit être 1');
      }
      serial = await this.stockService.findSerial(companyId, dto.itemSerialId);
      if (serial.stockItemId !== item.id) {
        throw new BadRequestException('Le numéro de série n’appartient pas à cet article');
      }
    }

    const result = await this.dataSource.transaction(async (em) => {
      const deltas = new Map<string, number>();

      switch (type) {
        case 'entree':
        case 'retour':
          deltas.set(dto.toWarehouseId!, dto.quantity);
          break;
        case 'transfert':
          deltas.set(dto.fromWarehouseId!, -dto.quantity);
          deltas.set(dto.toWarehouseId!, dto.quantity);
          break;
        case 'consommation':
          deltas.set(dto.fromWarehouseId!, -dto.quantity);
          break;
        case 'echange_sav':
          // L'ancien unité revient au dépôt (destination facultative).
          if (dto.toWarehouseId) deltas.set(dto.toWarehouseId, dto.quantity);
          break;
        case 'ajustement': {
          const current = await this.readLevel(em, item.id, dto.toWarehouseId!);
          deltas.set(dto.toWarehouseId!, dto.quantity - current);
          break;
        }
      }

      for (const [warehouseId, delta] of deltas) {
        if (delta === 0) continue;
        await this.applyDelta(em, companyId, item.id, warehouseId, delta);
      }

      const movement = await em.save(StockMovement, {
        companyId,
        stockItemId: item.id,
        itemSerialId: serial?.id ?? null,
        type,
        quantity: dto.quantity,
        fromWarehouseId: dto.fromWarehouseId ?? null,
        toWarehouseId: dto.toWarehouseId ?? null,
        missionId: dto.missionId ?? null,
        technicianId: dto.technicianId ?? null,
        note: dto.note ?? null,
      });

      if (serial) {
        await this.applySerialEffect(em, serial, type, dto);
      }

      return movement;
    });

    // Alerte seuil après mouvement (branchée au module Notifications en Phase 6).
    const warnings = await this.lowStockWarnings(companyId, item.id);
    if (warnings.length > 0) {
      this.logger.warn(`Stock faible : ${warnings.map((w) => w.reference).join(', ')}`);
    }

    return { movement: result, lowStockWarnings: warnings };
  }

  async list(
    companyId: string,
    filters: { type?: string; stockItemId?: string; warehouseId?: string; missionId?: string },
  ) {
    const qb = this.movementRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId })
      .orderBy('m.created_at', 'DESC')
      .take(500);
    if (filters.type) qb.andWhere('m.type = :type', { type: filters.type });
    if (filters.stockItemId) qb.andWhere('m.stock_item_id = :stockItemId', { stockItemId: filters.stockItemId });
    if (filters.missionId) qb.andWhere('m.mission_id = :missionId', { missionId: filters.missionId });
    if (filters.warehouseId) {
      qb.andWhere('(m.from_warehouse_id = :wid OR m.to_warehouse_id = :wid)', { wid: filters.warehouseId });
    }
    return qb.getMany();
  }

  /** Chaîne de traçabilité d'un ASSET : tous ses mouvements dans l'ordre. */
  async traceability(companyId: string, serialId: string) {
    const serial = await this.stockService.findSerial(companyId, serialId);
    const movements = await this.movementRepository.find({
      where: { companyId, itemSerialId: serialId },
      order: { createdAt: 'ASC' },
    });
    return { serial, movements };
  }

  // ------------------- internes -------------------

  private async assertWarehouse(companyId: string, warehouseId: string) {
    const warehouse = await this.warehouseRepository.findOne({ where: { companyId, id: warehouseId } });
    if (!warehouse) throw new NotFoundException(`Emplacement ${warehouseId} introuvable pour ce tenant`);
  }

  private async readLevel(em: EntityManager, stockItemId: string, warehouseId: string): Promise<number> {
    const level = await em.findOne(StockLevel, { where: { stockItemId, warehouseId } });
    return level?.quantity ?? 0;
  }

  private async applyDelta(
    em: EntityManager,
    companyId: string,
    stockItemId: string,
    warehouseId: string,
    delta: number,
  ) {
    let level = await em.findOne(StockLevel, { where: { stockItemId, warehouseId } });
    if (!level) {
      level = await em.save(StockLevel, { companyId, stockItemId, warehouseId, quantity: 0 });
    }
    const next = level.quantity + delta;
    if (next < 0) {
      throw new BadRequestException(
        `Stock insuffisant : ${level.quantity} disponible(s) à l'emplacement, ${-delta} demandé(s)`,
      );
    }
    level.quantity = next;
    await em.save(StockLevel, level);
  }

  /**
   * Effets du mouvement sur le numéro de série (chaîne SONATEL → dépôt → équipe) :
   * entree → disponible dans le dépôt ; transfert → déplacé ;
   * consommation → en_cours (posé) ; echange_sav → defectueux (récupéré) ;
   * retour → disponible ; ajustement → inchangé.
   */
  private async applySerialEffect(
    em: EntityManager,
    serial: ItemSerial,
    type: MovementType,
    dto: CreateStockMovementDto,
  ) {
    switch (type) {
      case 'entree':
      case 'retour':
        serial.status = 'disponible';
        serial.currentWarehouseId = dto.toWarehouseId ?? null;
        break;
      case 'transfert':
        serial.currentWarehouseId = dto.toWarehouseId ?? serial.currentWarehouseId;
        break;
      case 'consommation':
        serial.status = 'en_cours';
        serial.currentWarehouseId = null;
        break;
      case 'echange_sav':
        serial.status = 'defectueux';
        serial.currentWarehouseId = dto.toWarehouseId ?? dto.fromWarehouseId ?? null;
        break;
      case 'ajustement':
        break;
    }
    await em.save(ItemSerial, serial);
  }

  private async lowStockWarnings(companyId: string, stockItemId: string): Promise<LowStockAlert[]> {
    const alerts = await this.stockService.checkLowStock(companyId);
    return alerts.filter((a) => a.stockItemId === stockItemId);
  }
}
