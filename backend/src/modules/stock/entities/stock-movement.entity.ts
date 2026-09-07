import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StockItem } from './stock-item.entity';
import { ItemSerial } from './item-serial.entity';
import { Warehouse } from './warehouse.entity';

export const MOVEMENT_TYPES = [
  'entree',
  'affectation',
  'transfert',
  'consommation',
  'echange_sav',
  'ajustement',
  'retour',
  'sortie_feraillerie',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Mouvement tracé. Chaque type impose ses emplacements :
 * entree → to ; transfert → from+to ; consommation/echange_sav → from ;
 * ajustement → to (valeur absolue) ; retour → to.
 */
@Entity('stock_movements')
export class StockMovement extends BaseEntity {
  @Column({ type: 'uuid' })
  stockItemId!: string;

  @ManyToOne(() => StockItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column({ type: 'uuid', nullable: true })
  itemSerialId: string | null;

  @ManyToOne(() => ItemSerial, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'item_serial_id' })
  itemSerial: ItemSerial | null;

  @Column({ type: 'text' })
  type!: MovementType;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'uuid', nullable: true })
  fromWarehouseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  toWarehouseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
