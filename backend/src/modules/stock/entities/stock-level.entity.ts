import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StockItem } from './stock-item.entity';
import { Warehouse } from './warehouse.entity';

/** Niveau de stock d'un article par emplacement — maintenu par les mouvements. */
@Entity('stock_levels')
@Unique('uq_stock_level', ['stockItemId', 'warehouseId'])
export class StockLevel extends BaseEntity {
  @Column({ type: 'uuid' })
  stockItemId!: string;

  @ManyToOne(() => StockItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column({ type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Column({ type: 'integer', default: 0 })
  quantity!: number;

  /** Réservé pour missions planifiées (Green-T). */
  @Column({ type: 'integer', default: 0 })
  reservedQuantity!: number;

  /** Seuils propres à l'emplacement (surcharge du seuil article). */
  @Column({ type: 'integer', nullable: true })
  thresholdAlert: number | null;

  @Column({ type: 'integer', nullable: true })
  thresholdCritical: number | null;

  /** Dernier inventaire physique de l'emplacement. */
  @Column({ type: 'timestamptz', nullable: true })
  lastInventoryAt: Date | null;
}
