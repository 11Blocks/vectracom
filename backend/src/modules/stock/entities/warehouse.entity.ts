import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const WAREHOUSE_TYPES = ['CENTRAL', 'REGIONAL', 'SATELLITE', 'VEHICLE', 'SITE'] as const;
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

/**
 * Emplacement de stock : dépôt central, véhicule (un véhicule EST un
 * emplacement — fusion véhicule/stock) ou site terrain.
 */
@Entity('warehouses')
@Index(['companyId', 'name'], { unique: true })
export class Warehouse extends BaseEntity {
  @Column({ type: 'text' })
  type!: WarehouseType;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  zone: string | null;

  /** Hiérarchie Green-T : Région (THIES, DAKAR…) → sous-zone. */
  @Column({ type: 'text', nullable: true })
  region: string | null;

  @Column({ type: 'text', nullable: true })
  subZone: string | null;

  /** Code unique du tenant (ex. DPT-MBR, VEH-001). */
  @Column({ type: 'text', nullable: true })
  code: string | null;

  /** Parent hiérarchique (dépôt d'un véhicule, région d'un satellite). */
  @Column({ type: 'uuid', nullable: true })
  parentWarehouseId: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLatitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  gpsLongitude: string | null;

  @Column({ type: 'integer', nullable: true })
  capacityM3: number | null;

  /** Niveau de sécurité des locaux (contrat stock SONATEL : 9 points). */
  @Column({ type: 'text', nullable: true })
  securityLevel: string | null;
}
