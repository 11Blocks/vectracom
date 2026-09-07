import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const GEOPosition_SOURCES = ['mobile', 'mission_check', 'vehicle_gps'] as const;

/**
 * Position GPS horodatée d'un technicien (option payante GEOLOCATION).
 * Capturée par le mobile en arrière-plan ou à l'étape 2 d'une mission.
 */
@Entity('geopositions')
@Index(['companyId', 'technicianId', 'recordedAt'])
export class Geoposition extends BaseEntity {
  @Column({ type: 'uuid' })
  technicianId!: string;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  latitude!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  longitude!: string;

  /** Précision GPS en mètres. */
  @Column({ type: 'integer', nullable: true })
  accuracyM: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  speedKmh: string | null;

  /** Batterie du téléphone au moment du point. */
  @Column({ type: 'integer', nullable: true })
  batteryPct: number | null;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'text', default: 'mobile' })
  source!: (typeof GEOPosition_SOURCES)[number];
}
