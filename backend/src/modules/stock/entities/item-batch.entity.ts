import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StockItem } from './stock-item.entity';

/** Lot de réception (livraison SONATEL → dépôt). */
@Entity('item_batches')
@Index(['companyId', 'stockItemId', 'batchNumber'], { unique: true })
export class ItemBatch extends BaseEntity {
  @Column({ type: 'uuid' })
  stockItemId!: string;

  @ManyToOne(() => StockItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column()
  batchNumber!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'date', nullable: true })
  sonatelDeliveryDate: string | null;

  @Column({ type: 'date', nullable: true })
  receivedAt: string | null;
}
