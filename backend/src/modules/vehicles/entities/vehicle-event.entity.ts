import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Vehicle } from './vehicle.entity';

export const VEHICLE_EVENT_TYPES = ['panne', 'reparation', 'piece', 'carburant'] as const;
export type VehicleEventType = (typeof VEHICLE_EVENT_TYPES)[number];

export const REPARATION_STATUSES = ['planifiee', 'en_cours', 'terminee'] as const;
export type ReparationStatus = (typeof REPARATION_STATUSES)[number];

/**
 * Événement de véhicule : panne déclarée, réparation (garage, pièces),
 * pièce remplacée ou plein de carburant — alimente le coût par véhicule
 * et le rapport Usage stock & véhicules.
 */
@Entity('vehicle_events')
@Index(['companyId', 'vehicleId', 'type'])
export class VehicleEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ type: 'text' })
  type!: VehicleEventType;

  @Column({ type: 'date' })
  eventDate!: string;

  @Column({ type: 'integer', nullable: true })
  odometerKm: number | null;

  /** Coût total FCFA (réparation, pièce, ou plein). */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cost!: string;

  /** Carburant : litres du plein. */
  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  liters: string | null;

  /** Garage / fournisseur. */
  @Column({ type: 'text', nullable: true })
  provider: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Pièces remplacées : [{ designation, cost? }]. */
  @Column({ type: 'jsonb', default: '[]' })
  parts!: Array<{ designation: string; cost?: number }>;

  /** Statut de la réparation (types panne/reparation). */
  @Column({ type: 'text', default: 'terminee' })
  status!: ReparationStatus;

  /** Mission liée (panne survenue pendant une intervention). */
  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;
}
