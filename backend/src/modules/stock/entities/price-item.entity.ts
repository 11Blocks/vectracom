import { Column, Entity, Index } from 'typeorm';

export const PRICE_GRIDS = ['BORDEREAU_3STB', 'GRID_SOFATELCOM'] as const;
export type PriceGrid = (typeof PRICE_GRIDS)[number];
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Item du bordereau de prix 3STB (52 prestations facturables à SONATEL).
 * Versioning : plusieurs versions coexistent (2025, 2024…), une seule active
 * par (tenant, itemNumber) à une date donnée (effectiveFrom/effectiveTo).
 */
@Entity('price_items')
@Index(['companyId', 'itemNumber', 'version', 'priceGrid'], { unique: true })
export class PriceItem extends BaseEntity {
  @Column({ type: 'integer' })
  itemNumber!: number;

  @Column()
  designation!: string;

  @Column()
  unit!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'text', nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  subCategory: string | null;

  @Column({ type: 'text', default: '2025' })
  version!: string;

  /** Grille tarifaire : bordereau 3STB (travaux) ou prestations SOFATELCOM. */
  @Column({ type: 'text', default: 'BORDEREAU_3STB' })
  priceGrid!: string;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ default: true })
  isActive!: boolean;
}
