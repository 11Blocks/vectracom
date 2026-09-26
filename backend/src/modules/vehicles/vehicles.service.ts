import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Vehicle, VehicleStatus } from './entities/vehicle.entity';
import { VehicleCheck } from './entities/vehicle-check.entity';
import { VehicleDocument, VehicleDocType } from './entities/vehicle-document.entity';
import { VehicleEvent, VehicleEventType, ReparationStatus } from './entities/vehicle-event.entity';
import { CreateVehicleEventDto, UpdateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { Warehouse } from '../stock/entities/warehouse.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateVehicleCheckDto } from './dto/create-vehicle-check.dto';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';

export type Badge = 'rouge' | 'orange' | 'vert';

export interface ExpiryBadge {
  badge: Badge;
  daysLeft: number | null;
  expirationDate: string | null;
}

export interface VehicleBadges {
  insurance: ExpiryBadge;
  technicalInspection: ExpiryBadge;
  global: Badge;
}

/** Règle déterministe (jamais d'IA) : rouge ≤ 7 j (ou dépassé), orange ≤ 30 j, vert sinon/absent. */
export function computeBadge(expirationDate: string | null, now = new Date()): ExpiryBadge {
  if (!expirationDate) {
    return { badge: 'vert', daysLeft: null, expirationDate: null };
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiry = new Date(`${expirationDate}T00:00:00Z`).getTime();
  const daysLeft = Math.round((expiry - today) / 86_400_000);
  const badge: Badge = daysLeft <= 7 ? 'rouge' : daysLeft <= 30 ? 'orange' : 'vert';
  return { badge, daysLeft, expirationDate };
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(VehicleCheck)
    private readonly checkRepository: Repository<VehicleCheck>,
    @InjectRepository(VehicleDocument)
    private readonly documentRepository: Repository<VehicleDocument>,
    @InjectRepository(VehicleEvent)
    private readonly eventRepository: Repository<VehicleEvent>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  /**
   * Création atomique : véhicule + son entrepôt VEHICLE (fusion stock mobile).
   * L'entrepôt porte le nom de l'immatriculation.
   */
  async create(companyId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    const immatriculation = dto.immatriculation.trim().toUpperCase();
    const existing = await this.vehicleRepository.findOne({
      where: { companyId, immatriculation },
    });
    if (existing) throw new ConflictException(`Le véhicule « ${immatriculation} » existe déjà`);
    await this.assertLinks(companyId, dto.teamId, dto.technicianId);

    return this.dataSource.transaction(async (em) => {
      const warehouse = await em.save(Warehouse, {
        companyId,
        type: 'VEHICLE',
        name: immatriculation,
        zone: null,
      });
      return em.save(Vehicle, {
        companyId,
        warehouseId: warehouse.id,
        immatriculation,
        modele: dto.modele?.trim() ?? null,
        teamId: dto.teamId ?? null,
        technicianId: dto.technicianId ?? null,
        kilometrage: dto.kilometrage ?? 0,
        insuranceExpiration: dto.insuranceExpiration?.slice(0, 10) ?? null,
        technicalInspectionExpiration: dto.technicalInspectionExpiration?.slice(0, 10) ?? null,
        nextMaintenanceKm: dto.nextMaintenanceKm ?? null,
        monthlyCost: dto.monthlyCost !== undefined ? String(dto.monthlyCost) : null,
        status: 'disponible',
      });
    });
  }

  async list(
    companyId: string,
    filters: { teamId?: string; status?: string; echeance?: Badge },
  ) {
    const qb = this.vehicleRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.warehouse', 'w')
      .leftJoinAndSelect('v.team', 'team')
      .leftJoinAndSelect('v.technician', 'tech')
      .where('v.company_id = :companyId', { companyId })
      .orderBy('v.immatriculation', 'ASC');
    if (filters.teamId) qb.andWhere('v.team_id = :teamId', { teamId: filters.teamId });
    if (filters.status) qb.andWhere('v.status = :status', { status: filters.status });

    let vehicles = await qb.getMany();
    if (filters.echeance) {
      vehicles = vehicles.filter((v) => this.badges(v).global === filters.echeance);
    }
    return vehicles.map((v) => ({ ...v, badges: this.badges(v) }));
  }

  async findOne(companyId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({
      where: { companyId, id },
      relations: ['warehouse', 'team', 'technician'],
    });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable');
    return vehicle;
  }

  async detail(companyId: string, id: string) {
    const vehicle = await this.findOne(companyId, id);
    return { ...vehicle, badges: this.badges(vehicle) };
  }

  badges(vehicle: Pick<Vehicle, 'insuranceExpiration' | 'technicalInspectionExpiration'>): VehicleBadges {
    const insurance = computeBadge(vehicle.insuranceExpiration);
    const technicalInspection = computeBadge(vehicle.technicalInspectionExpiration);
    const global: Badge =
      insurance.badge === 'rouge' || technicalInspection.badge === 'rouge'
        ? 'rouge'
        : insurance.badge === 'orange' || technicalInspection.badge === 'orange'
          ? 'orange'
          : 'vert';
    return { insurance, technicalInspection, global };
  }

  async update(companyId: string, id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(companyId, id);
    await this.assertLinks(companyId, dto.teamId, dto.technicianId);

    if (dto.immatriculation && dto.immatriculation.trim().toUpperCase() !== vehicle.immatriculation) {
      const immat = dto.immatriculation.trim().toUpperCase();
      const existing = await this.vehicleRepository.findOne({ where: { companyId, immatriculation: immat } });
      if (existing && existing.id !== id) throw new ConflictException('Immatriculation déjà utilisée');
      vehicle.immatriculation = immat;
      // L'entrepôt associé suit l'immatriculation (nom lisible côté stock).
      await this.warehouseRepository.update({ id: vehicle.warehouseId }, { name: immat });
    }

    Object.assign(vehicle, {
      ...(dto.modele !== undefined ? { modele: dto.modele } : {}),
      ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
      ...(dto.technicianId !== undefined ? { technicianId: dto.technicianId } : {}),
      ...(dto.kilometrage !== undefined ? { kilometrage: dto.kilometrage } : {}),
      ...(dto.insuranceExpiration !== undefined
        ? { insuranceExpiration: dto.insuranceExpiration?.slice(0, 10) ?? null }
        : {}),
      ...(dto.technicalInspectionExpiration !== undefined
        ? { technicalInspectionExpiration: dto.technicalInspectionExpiration?.slice(0, 10) ?? null }
        : {}),
      ...(dto.nextMaintenanceKm !== undefined ? { nextMaintenanceKm: dto.nextMaintenanceKm } : {}),
      ...(dto.monthlyCost !== undefined ? { monthlyCost: dto.monthlyCost !== null ? String(dto.monthlyCost) : null } : {}),
      ...(dto.status !== undefined ? { status: dto.status as VehicleStatus } : {}),
    });
    // Les relations chargées par findOne masqueraient les nouveaux IDs au save.
    const { team: _t, technician: _k, warehouse: _w, ...plain } = vehicle;
    await this.vehicleRepository.save(plain as Vehicle);
    return this.findOne(companyId, id);
  }

  private async assertLinks(companyId: string, teamId?: string | null, technicianId?: string | null) {
    if (teamId) {
      const rows = await this.dataSource.query('SELECT 1 FROM teams WHERE id = $1 AND company_id = $2', [teamId, companyId]);
      if (!rows.length) throw new BadRequestException('Équipe introuvable pour ce tenant');
    }
    if (technicianId) {
      const rows = await this.dataSource.query('SELECT 1 FROM technicians WHERE id = $1 AND company_id = $2', [technicianId, companyId]);
      if (!rows.length) throw new BadRequestException('Technicien introuvable pour ce tenant');
    }
  }

  /** Suppression : refuse si la camionnette détient encore du stock, sinon supprime véhicule + entrepôt. */
  async remove(companyId: string, id: string) {
    const vehicle = await this.findOne(companyId, id);
    const stocked = await this.dataSource.query(
      `SELECT COALESCE(SUM(quantity), 0) FROM stock_levels WHERE warehouse_id = $1`,
      [vehicle.warehouseId],
    );
    if (Number(stocked[0]?.coalesce ?? 0) > 0) {
      throw new ConflictException('La camionnette détient encore du stock — transférez-le avant suppression');
    }
    await this.dataSource.transaction(async (em) => {
      await em.delete(Vehicle, { companyId, id });
      await em.delete(Warehouse, { companyId, id: vehicle.warehouseId });
    });
    return { deleted: true };
  }

  // ------------------- Checks (1×/jour) -------------------

  async createCheck(companyId: string, vehicleId: string, dto: CreateVehicleCheckDto): Promise<VehicleCheck> {
    await this.findOne(companyId, vehicleId);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const already = await this.checkRepository
      .createQueryBuilder('c')
      .where('c.company_id = :companyId AND c.vehicle_id = :vehicleId', { companyId, vehicleId })
      .andWhere('c.created_at >= :startOfDay', { startOfDay })
      .getCount();
    if (already > 0) {
      throw new ConflictException('Checklist déjà réalisée aujourd\'hui pour ce véhicule (1×/jour)');
    }

    return this.checkRepository.save(
      this.checkRepository.create({
        companyId,
        vehicleId,
        missionId: dto.missionId ?? null,
        huile: dto.huile,
        eau: dto.eau,
        freins: dto.freins,
        pneus: dto.pneus,
        batterie: dto.batterie,
        eclairage: dto.eclairage,
        observations: dto.observations ?? null,
        photoUrl: dto.photoUrl ?? null,
      }),
    );
  }

  async listChecks(companyId: string, vehicleId: string): Promise<VehicleCheck[]> {
    await this.findOne(companyId, vehicleId);
    return this.checkRepository.find({
      where: { companyId, vehicleId },
      order: { createdAt: 'DESC' },
    });
  }

  // ------------------- Pochette digitale -------------------

  async addDocument(companyId: string, vehicleId: string, dto: CreateVehicleDocumentDto): Promise<VehicleDocument> {
    await this.findOne(companyId, vehicleId);
    return this.documentRepository.save(
      this.documentRepository.create({
        companyId,
        vehicleId,
        docType: dto.docType as VehicleDocType,
        fileUrl: dto.fileUrl.trim(),
        expirationDate: dto.expirationDate?.slice(0, 10) ?? null,
      }),
    );
  }

  async listDocuments(companyId: string, vehicleId: string): Promise<VehicleDocument[]> {
    await this.findOne(companyId, vehicleId);
    return this.documentRepository.find({
      where: { companyId, vehicleId },
      order: { docType: 'ASC' },
    });
  }

  async removeDocument(companyId: string, vehicleId: string, documentId: string) {
    await this.findOne(companyId, vehicleId);
    const doc = await this.documentRepository.findOne({
      where: { companyId, id: documentId, vehicleId },
    });
    if (!doc) throw new NotFoundException('Document introuvable pour ce véhicule');
    await this.documentRepository.remove(doc);
    return { deleted: true };
  }

  // ─────────────────────────────────────────────
  //  Événements : pannes / réparations / pièces / carburant
  // ─────────────────────────────────────────────
  async createEvent(companyId: string, vehicleId: string, dto: CreateVehicleEventDto): Promise<VehicleEvent> {
    await this.findOne(companyId, vehicleId);
    const partsCost = (dto.parts ?? []).reduce((s, p) => s + (p.cost ?? 0), 0);
    const event = await this.eventRepository.save(
      this.eventRepository.create({
        companyId,
        vehicleId,
        type: dto.type as VehicleEventType,
        eventDate: dto.eventDate.slice(0, 10),
        odometerKm: dto.odometerKm ?? null,
        cost: String(dto.cost ?? partsCost ?? 0),
        liters: dto.liters != null ? String(dto.liters) : null,
        provider: dto.provider ?? null,
        description: dto.description ?? null,
        parts: dto.parts ?? [],
        status: (dto.status ?? 'terminee') as ReparationStatus,
        missionId: dto.missionId ?? null,
      }),
    );

    // Le kilométrage du véhicule suit l'événement le plus récent.
    if (dto.odometerKm != null) {
      const vehicle = await this.vehicleRepository.findOne({ where: { companyId, id: vehicleId } });
      if (vehicle && dto.odometerKm > vehicle.kilometrage) {
        vehicle.kilometrage = dto.odometerKm;
        await this.vehicleRepository.save(vehicle);
      }
    }
    return event;
  }

  async listEvents(companyId: string, vehicleId: string, type?: string): Promise<VehicleEvent[]> {
    await this.findOne(companyId, vehicleId);
    const where: Record<string, unknown> = { companyId, vehicleId };
    if (type) where.type = type;
    return this.eventRepository.find({ where, order: { eventDate: 'DESC' } });
  }

  async updateEventStatus(companyId: string, vehicleId: string, eventId: string, dto: UpdateVehicleEventDto): Promise<VehicleEvent> {
    const event = await this.eventRepository.findOne({ where: { companyId, id: eventId, vehicleId } });
    if (!event) throw new NotFoundException('Événement introuvable pour ce véhicule');
    if (dto.status) event.status = dto.status as ReparationStatus;
    if (dto.cost != null) event.cost = String(dto.cost);
    return this.eventRepository.save(event);
  }

  /** Synthèse des coûts d'un véhicule : par type + total + carburant litres. */
  async vehicleCosts(companyId: string, vehicleId: string) {
    await this.findOne(companyId, vehicleId);
    const events = await this.eventRepository.find({ where: { companyId, vehicleId } });
    const byType: Record<string, { count: number; total: number }> = {};
    for (const e of events) {
      const entry = (byType[e.type] ??= { count: 0, total: 0 });
      entry.count += 1;
      entry.total += Number(e.cost);
    }
    return {
      vehicleId,
      byType,
      totalCost: round2(events.reduce((s, e) => s + Number(e.cost), 0)),
      totalLiters: round2(events.filter((e) => e.type === 'carburant').reduce((s, e) => s + Number(e.liters ?? 0), 0)),
      eventsCount: events.length,
    };
  }

  /** Coûts de tous les véhicules (alimente le rapport Usage stock & véhicules). */
  async fleetCosts(companyId: string) {
    const [vehicles, events] = await Promise.all([
      this.vehicleRepository.find({ where: { companyId } }),
      this.eventRepository.find({ where: { companyId } }),
    ]);
    return vehicles.map((v) => {
      const own = events.filter((e) => e.vehicleId === v.id);
      return {
        vehicleId: v.id,
        immatriculation: v.immatriculation,
        modele: v.modele,
        repairs: own.filter((e) => e.type === 'reparation').length,
        breakdowns: own.filter((e) => e.type === 'panne').length,
        fuelLiters: round2(own.filter((e) => e.type === 'carburant').reduce((s, e) => s + Number(e.liters ?? 0), 0)),
        totalCost: round2(own.reduce((s, e) => s + Number(e.cost), 0)),
      };
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
