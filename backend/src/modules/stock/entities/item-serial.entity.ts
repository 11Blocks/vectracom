import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StockItem } from './stock-item.entity';
import { Warehouse } from './warehouse.entity';

export const SERIAL_STATUSES = [
  'disponible',
  'en_cours',
  'defectueux',
  'perdu',
  'retourne',
  'recupere_bon',
  'recupere_defectueux',
  'feraillerie',
] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];
export const _SERIAL_TYPE_KEEP = 0;

/** Numéro de série d'un ASSET — chaîne : SONATEL → dépôt → équipe → client. */
@Entity('item_serials')
@Index(['companyId', 'serialNumber'], { unique: true })
export class ItemSerial extends BaseEntity {
  @Column({ type: 'uuid' })
  stockItemId!: string;

  @ManyToOne(() => StockItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_item_id' })
  stockItem: StockItem;

  @Column()
  serialNumber!: string;

  @Column({ type: 'text', default: 'disponible' })
  status!: SerialStatus;

  /** Traçabilité bout en bout (fichier Suivi modems F6600) : n° carton, équipe livrée, client posé. */
  @Column({ type: 'text', nullable: true })
  cartonNumber: string | null;

  @Column({ type: 'uuid', nullable: true })
  deliveredToTeamId: string | null;

  @Column({ type: 'date', nullable: true })
  deliveredToTeamAt: string | null;

  /** ND du client chez qui l'équipement est posé. */
  @Column({ type: 'text', nullable: true })
  installedAtClientNd: string | null;

  @Column({ type: 'date', nullable: true })
  installedAt: string | null;

  @Column({ type: 'date', nullable: true })
  returnedToSonatelAt: string | null;

  /** Sortie feraillerie — montant de vente (FCFA). */
  @Column({ type: 'integer', nullable: true })
  feraillerieAmountFcfa: number | null;

  @Column({ type: 'date', nullable: true })
  feraillerieSoldAt: string | null;

  @Column({ type: 'uuid', nullable: true })
  currentWarehouseId: string | null;

  @ManyToOne(() => Warehouse, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_warehouse_id' })
  currentWarehouse: Warehouse | null;
}
