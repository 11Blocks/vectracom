import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pageParams } from '../../common/pagination';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { StockMovement, MovementType } from './entities/stock-movement.entity';
import { StockItem } from './entities/stock-item.entity';
import { ItemSerial } from './entities/item-serial.entity';
import { Warehouse } from './entities/warehouse.entity';
import { StockLevel } from './entities/stock-level.entity';
import { CreateStockMovementDto, InventoryDto } from './dto/create-stock-movement.dto';
import { StockService, LowStockAlert } from './stock.service';
import { AuditService } from '../../common/audit/audit.service';

/** Règles d'emplacements par type de mouvement. */
const REQUIREMENTS: Record<MovementType, { from: boolean; to: boolean }> = {
  entree: { from: false, to: true },
  transfert: { from: true, to: true },
  // Affectation : dépôt → emplacement d'une équipe / camionnette.
  affectation: { from: true, to: true },
  consommation: { from: true, to: false },
  // Échange SAV : ancien récupéré (marqué defectueux) + nouveau posé.
  // Le nouveau part du stock via sa propre consommation ; l'ancien, déjà
  // sorti, revient au dépôt si une destination est fournie.
  echange_sav: { from: false, to: false },
  ajustement: { from: false, to: true },
  retour: { from: false, to: true },
  // Sortie ferraillerie : matériel hors d'usage quitte le stock (dépôt → hors).
  sortie_feraillerie: { from: true, to: false },
};

/** Un chef d'équipe déclare ce qui se passe sur le terrain, jamais les entrées ni les corrections. */
const CHEF_EQUIPE_TYPES: MovementType[] = ['consommation', 'retour', 'echange_sav'];

export interface MovementActor {
  id: string | null;
  role: string;
}

@Injectable()
export class StockMovementService {
  private readonly logger = new Logger(StockMovementService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly audit: AuditService,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  async create(companyId: string, dto: CreateStockMovementDto, actor: MovementActor) {
    const item = await this.stockService.findStockItem(companyId, dto.stockItemId);
    const type = dto.type as MovementType;
    const req = REQUIREMENTS[type];

    if (actor.role === 'chef_equipe' && !CHEF_EQUIPE_TYPES.includes(type)) {
      throw new ForbiddenException(`Un chef d'équipe ne peut enregistrer que : ${CHEF_EQUIPE_TYPES.join(', ')}`);
    }
    if (type !== 'ajustement' && dto.quantity < 1) {
      throw new BadRequestException('La quantité doit être au moins 1');
    }
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
    await this.assertLinks(companyId, dto.missionId, dto.technicianId);

    let serial: ItemSerial | null = null;
    if (item.category === 'ASSET') {
      if (!dto.itemSerialId) {
        throw new BadRequestException('ASSET : numéro de série (itemSerialId) obligatoire');
      }
      if (type === 'ajustement') {
        throw new BadRequestException('ASSET : pas d’ajustement global — enregistrez le mouvement du numéro de série concerné');
      }
      if (dto.quantity !== 1) {
        throw new BadRequestException('ASSET : la quantité doit être 1');
      }
      serial = await this.stockService.findSerial(companyId, dto.itemSerialId);
      if (serial.stockItemId !== item.id) {
        throw new BadRequestException('Le numéro de série n’appartient pas à cet article');
      }
      if (dto.fromWarehouseId && serial.currentWarehouseId && serial.currentWarehouseId !== dto.fromWarehouseId) {
        throw new BadRequestException('Ce numéro de série ne se trouve pas dans l’emplacement source indiqué');
      }
    }

    const result = await this.dataSource.transaction((em) =>
      this.applyMovement(em, companyId, item, serial, dto, actor.id),
    );

    await this.audit.log({
      companyId, actorId: actor.id, action: 'stock.movement', entityType: 'stock_movement', entityId: result.id,
      payload: { type, reference: item.reference, quantity: dto.quantity, deltas: result.deltas },
    });

    // Alerte seuil après mouvement (branchée au module Notifications en Phase 6).
    const warnings = await this.lowStockWarnings(companyId, item.id);
    if (warnings.length > 0) {
      this.logger.warn(`Stock faible : ${warnings.map((w) => w.reference).join(', ')}`);
    }

    return { movement: result, lowStockWarnings: warnings };
  }

  /**
   * Annulation d'un mouvement : les variations appliquées sont contre-passées
   * (refus si le stock a déjà été consommé depuis). Le mouvement reste visible, barré.
   */
  async cancel(companyId: string, id: string, reason: string, actor: MovementActor) {
    const movement = await this.dataSource.transaction(async (em) => {
      const mv = await em.findOne(StockMovement, { where: { companyId, id }, lock: { mode: 'pessimistic_write' } });
      if (!mv) throw new NotFoundException('Mouvement introuvable');
      if (mv.cancelledAt) throw new BadRequestException('Mouvement déjà annulé');
      if (mv.itemSerialId) {
        throw new BadRequestException('Mouvement d’un numéro de série : enregistrez le mouvement inverse pour garder la traçabilité');
      }
      const deltas = mv.deltas ?? this.legacyDeltas(mv);
      if (!deltas) {
        throw new BadRequestException('Ancien ajustement sans trace des écarts : corrigez par un nouvel ajustement');
      }
      for (const [warehouseId, delta] of Object.entries(deltas)) {
        if (delta !== 0) await this.applyDelta(em, companyId, mv.stockItemId, warehouseId, -delta);
      }
      mv.cancelledAt = new Date();
      mv.cancelReason = reason.trim();
      mv.cancelledBy = actor.id;
      return em.save(StockMovement, mv);
    });
    await this.audit.log({
      companyId, actorId: actor.id, action: 'stock.movement_cancel', entityType: 'stock_movement', entityId: id,
      payload: { reason, type: movement.type, quantity: movement.quantity },
    });
    return movement;
  }

  /** Inventaire : un ajustement par écart constaté, le tout dans une transaction. */
  async inventory(companyId: string, dto: InventoryDto, actor: MovementActor) {
    await this.assertWarehouse(companyId, dto.warehouseId);
    const ids = [...new Set(dto.lines.map((l) => l.stockItemId))];
    if (ids.length !== dto.lines.length) throw new BadRequestException('Article en double dans l’inventaire');
    const items = await Promise.all(ids.map((id) => this.stockService.findStockItem(companyId, id)));
    const assets = items.filter((i) => i.category === 'ASSET');
    if (assets.length) {
      throw new BadRequestException(`Articles sérialisés exclus de l'inventaire en quantité : ${assets.map((a) => a.reference).join(', ')}`);
    }
    const itemById = new Map(items.map((i) => [i.id, i]));

    const adjustments = await this.dataSource.transaction(async (em) => {
      const out: Array<{ reference: string; before: number; counted: number; delta: number }> = [];
      for (const line of dto.lines) {
        const before = await this.readLevel(em, line.stockItemId, dto.warehouseId);
        if (before === line.countedQuantity) continue;
        const item = itemById.get(line.stockItemId)!;
        await this.applyMovement(em, companyId, item, null, {
          stockItemId: item.id,
          type: 'ajustement',
          quantity: line.countedQuantity,
          toWarehouseId: dto.warehouseId,
          note: `Inventaire${dto.note ? ' — ' + dto.note : ''} (avant : ${before})`,
        }, actor.id);
        out.push({ reference: item.reference, before, counted: line.countedQuantity, delta: line.countedQuantity - before });
      }
      return out;
    });

    await this.audit.log({
      companyId, actorId: actor.id, action: 'stock.inventory', entityType: 'warehouse', entityId: dto.warehouseId,
      payload: { lines: dto.lines.length, adjustments: adjustments.length, note: dto.note ?? null },
    });
    return { counted: dto.lines.length, adjusted: adjustments.length, adjustments };
  }

  async list(
    companyId: string,
    filters: {
      type?: string; stockItemId?: string; warehouseId?: string; missionId?: string;
      includeCancelled?: boolean; limit?: number; offset?: number;
    },
  ) {
    const { take, skip } = pageParams(filters, 500, 2000);
    const qb = this.movementRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId })
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take)
      .skip(skip);
    if (filters.type) qb.andWhere('m.type = :type', { type: filters.type });
    if (filters.stockItemId) qb.andWhere('m.stock_item_id = :stockItemId', { stockItemId: filters.stockItemId });
    if (filters.missionId) qb.andWhere('m.mission_id = :missionId', { missionId: filters.missionId });
    if (filters.warehouseId) {
      qb.andWhere('(m.from_warehouse_id = :wid OR m.to_warehouse_id = :wid)', { wid: filters.warehouseId });
    }
    if (filters.includeCancelled === false) qb.andWhere('m.cancelled_at IS NULL');
    return qb.getManyAndCount();
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

  /**
   * Écrit un mouvement de quantité (sans contrôle de rôle) — utilisé par les
   * imports (FOCUS) pour tracer chaque niveau modifié.
   */
  async recordAdjustment(
    em: EntityManager,
    companyId: string,
    item: StockItem,
    warehouseId: string,
    countedQuantity: number,
    note: string,
    userId: string | null,
  ) {
    return this.applyMovement(em, companyId, item, null, {
      stockItemId: item.id, type: 'ajustement', quantity: countedQuantity, toWarehouseId: warehouseId, note,
    }, userId);
  }

  // ------------------- internes -------------------

  private async applyMovement(
    em: EntityManager,
    companyId: string,
    item: StockItem,
    serial: ItemSerial | null,
    dto: CreateStockMovementDto,
    userId: string | null,
  ): Promise<StockMovement> {
    const type = dto.type as MovementType;
    const deltas: Record<string, number> = {};
    const add = (wid: string, d: number) => { deltas[wid] = (deltas[wid] ?? 0) + d; };

    switch (type) {
      case 'entree':
      case 'retour':
        add(dto.toWarehouseId!, dto.quantity);
        break;
      case 'transfert':
      case 'affectation':
        add(dto.fromWarehouseId!, -dto.quantity);
        add(dto.toWarehouseId!, dto.quantity);
        break;
      case 'consommation':
      case 'sortie_feraillerie':
        add(dto.fromWarehouseId!, -dto.quantity);
        break;
      case 'echange_sav':
        // L'ancienne unité revient au dépôt (destination facultative).
        if (dto.toWarehouseId) add(dto.toWarehouseId, dto.quantity);
        break;
      case 'ajustement': {
        const current = await this.readLevel(em, item.id, dto.toWarehouseId!);
        add(dto.toWarehouseId!, dto.quantity - current);
        break;
      }
    }

    for (const [warehouseId, delta] of Object.entries(deltas)) {
      if (delta !== 0) await this.applyDelta(em, companyId, item.id, warehouseId, delta);
    }

    const movement = await em.save(StockMovement, em.create(StockMovement, {
      companyId,
      stockItemId: item.id,
      itemSerialId: serial?.id ?? null,
      type,
      quantity: dto.quantity,
      fromWarehouseId: dto.fromWarehouseId ?? null,
      toWarehouseId: dto.toWarehouseId ?? null,
      missionId: dto.missionId ?? null,
      technicianId: dto.technicianId ?? null,
      note: dto.note?.trim() || null,
      createdBy: userId,
      deltas,
    }));

    if (serial) await this.applySerialEffect(em, serial, type, dto);
    return movement;
  }

  /** Variations d'un mouvement antérieur à la colonne deltas (reconstruites depuis son type). */
  private legacyDeltas(mv: StockMovement): Record<string, number> | null {
    const q = mv.quantity;
    switch (mv.type) {
      case 'entree':
      case 'retour':
        return mv.toWarehouseId ? { [mv.toWarehouseId]: q } : null;
      case 'transfert':
        return mv.fromWarehouseId && mv.toWarehouseId ? { [mv.fromWarehouseId]: -q, [mv.toWarehouseId]: q } : null;
      case 'consommation':
        return mv.fromWarehouseId ? { [mv.fromWarehouseId]: -q } : null;
      case 'echange_sav':
        return mv.toWarehouseId ? { [mv.toWarehouseId]: q } : {};
      // affectation / sortie_feraillerie n'avaient aucun effet avant la colonne deltas.
      case 'affectation':
      case 'sortie_feraillerie':
        return {};
      default:
        return null;
    }
  }

  private async assertWarehouse(companyId: string, warehouseId: string) {
    const warehouse = await this.warehouseRepository.findOne({ where: { companyId, id: warehouseId } });
    if (!warehouse) throw new NotFoundException(`Emplacement ${warehouseId} introuvable pour ce tenant`);
  }

  private async assertLinks(companyId: string, missionId?: string | null, technicianId?: string | null) {
    if (missionId) {
      const rows = await this.dataSource.query('SELECT 1 FROM missions WHERE id = $1 AND company_id = $2', [missionId, companyId]);
      if (!rows.length) throw new BadRequestException('Mission introuvable pour ce tenant');
    }
    if (technicianId) {
      const rows = await this.dataSource.query('SELECT 1 FROM technicians WHERE id = $1 AND company_id = $2', [technicianId, companyId]);
      if (!rows.length) throw new BadRequestException('Technicien introuvable pour ce tenant');
    }
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
    let level = await em.findOne(StockLevel, { where: { stockItemId, warehouseId }, lock: { mode: 'pessimistic_write' } });
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
   * entree/retour → disponible dans le dépôt ; transfert/affectation → déplacé ;
   * consommation → en_cours (posé) ; echange_sav → defectueux (récupéré) ;
   * sortie_feraillerie → feraillerie ; ajustement → inchangé.
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
      case 'affectation':
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
      case 'sortie_feraillerie':
        serial.status = 'feraillerie';
        serial.currentWarehouseId = null;
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
