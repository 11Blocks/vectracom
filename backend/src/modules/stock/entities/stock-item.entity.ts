import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const STOCK_CATEGORIES = ['CONSUMABLE', 'ASSET'] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export const STOCK_FAMILIES = ['FIBRE', 'CUIVRE', 'OUTILLAGE'] as const;
export type StockFamily = (typeof STOCK_FAMILIES)[number];

/**
 * Article de stock :
 * - CONSUMABLE : géré par quantité (niveaux par emplacement)
 * - ASSET : géré par numéro de série (traçabilité SONATEL → dépôt → équipe)
 */
@Entity('stock_items')
@Index(['companyId', 'reference'], { unique: true })
export class StockItem extends BaseEntity {
  @Column()
  reference!: string;

  @Column()
  designation!: string;

  @Column({ type: 'text' })
  category!: StockCategory;

  @Column({ type: 'text' })
  family!: StockFamily;

  @Column({ type: 'text', nullable: true })
  unit: string | null;

  /** Alerte si le stock total passe sous ce seuil (cron Phase 6). */
  @Column({ type: 'integer', default: 10 })
  thresholdAlert!: number;
}
