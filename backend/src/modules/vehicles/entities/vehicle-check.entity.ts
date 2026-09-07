import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Vehicle } from './vehicle.entity';

/** Checklist de prise de poste — 15 secondes, une fois par jour et par véhicule. */
@Entity('vehicle_checks')
@Index(['companyId', 'vehicleId', 'createdAt'])
export class VehicleCheck extends BaseEntity {
  @Column({ type: 'uuid' })
  vehicleId!: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  /** Rattaché automatiquement au démarrage d'une mission si fourni. */
  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @Column({ default: true })
  huile!: boolean;

  @Column({ default: true })
  eau!: boolean;

  @Column({ default: true })
  freins!: boolean;

  @Column({ default: true })
  pneus!: boolean;

  @Column({ default: true })
  batterie!: boolean;

  @Column({ default: true })
  eclairage!: boolean;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;
}
