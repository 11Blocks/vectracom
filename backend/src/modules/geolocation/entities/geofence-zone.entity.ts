import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const GEOFENCE_TYPES = ['site_mission', 'zone_travail', 'depot'] as const;

/** Zone géographique de référence (site de mission, zone de travail, dépôt). */
@Entity('geofence_zones')
@Index(['companyId', 'active'])
export class GeofenceZone extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  type!: (typeof GEOFENCE_TYPES)[number];

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  centerLatitude!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7 })
  centerLongitude!: string;

  /** Rayon en mètres. */
  @Column({ type: 'integer', default: 500 })
  radiusM!: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ default: true })
  active!: boolean;
}
