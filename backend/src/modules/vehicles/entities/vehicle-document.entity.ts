import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Vehicle } from './vehicle.entity';

export const VEHICLE_DOC_TYPES = ['carte_grise', 'assurance', 'visite_technique'] as const;
export type VehicleDocType = (typeof VEHICLE_DOC_TYPES)[number];

/** Pochette digitale : documents du véhicule, URLs servies puis mises en cache hors ligne par le mobile. */
@Entity('vehicle_documents')
@Index(['companyId', 'vehicleId', 'docType'])
export class VehicleDocument extends BaseEntity {
  @Column({ type: 'uuid' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ type: 'text' })
  docType!: VehicleDocType;

  @Column({ type: 'text' })
  fileUrl!: string;

  @Column({ type: 'date', nullable: true })
  expirationDate: string | null;
}
