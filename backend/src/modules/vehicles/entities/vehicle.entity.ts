import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Warehouse } from '../../stock/entities/warehouse.entity';
import { Team } from '../../teams/entities/team.entity';
import { Technician } from '../../technicians/entities/technician.entity';

export const VEHICLE_STATUSES = ['disponible', 'en_mission', 'en_reparation'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/**
 * Véhicule fusionné avec le stock mobile : warehouseId (UNIQUE) désigne
 * l'entrepôt de type VEHICLE créé automatiquement avec le véhicule — les
 * niveaux de stock « camionnette » vivent dessus.
 */
@Entity('vehicles')
@Index(['companyId', 'immatriculation'], { unique: true })
@Index(['warehouseId'], { unique: true })
export class Vehicle extends BaseEntity {
  @Column({ type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column()
  immatriculation!: string;

  @Column({ type: 'text', nullable: true })
  modele: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @ManyToOne(() => Technician, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @Column({ type: 'integer', default: 0 })
  kilometrage!: number;

  @Column({ type: 'date', nullable: true })
  insuranceExpiration: string | null;

  @Column({ type: 'date', nullable: true })
  technicalInspectionExpiration: string | null;

  @Column({ type: 'integer', nullable: true })
  nextMaintenanceKm: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  monthlyCost: string | null;

  @Column({ type: 'text', default: 'disponible' })
  status!: VehicleStatus;
}
