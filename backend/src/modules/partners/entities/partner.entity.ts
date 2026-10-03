import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PRICE_GRIDS = ['BORDEREAU_3STB', 'GRID_SOFATELCOM'] as const;
export type PriceGrid = (typeof PRICE_GRIDS)[number];

export const PRICE_GRID_LABELS: Record<PriceGrid, string> = {
  BORDEREAU_3STB: 'Bordereau 3STB (travaux)',
  GRID_SOFATELCOM: 'Grille prestations SOFATELCOM',
};

/**
 * Partenaire donneur d'ordre du sous-traitant (ONECOMIT travaille pour
 * SOFATELCOM — zone Mbour — et 3STB — national). Chaque partenaire impose
 * sa grille tarifaire : elle détermine la valorisation des missions et
 * la structure de l'attachement mensuel.
 */
@Entity('partners')
@Unique('uq_partner_code', ['companyId', 'code'])
@Index(['companyId', 'active'])
export class Partner extends BaseEntity {
  /** Code court utilisé dans les fichiers SONATEL (colonne ST). */
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Grille tarifaire appliquée aux missions de ce partenaire. */
  @Column({ type: 'text' })
  priceGrid!: PriceGrid;

  /** Zone d'exclusivité éventuelle (ex. Mbour pour SOFATELCOM). */
  @Column({ type: 'text', nullable: true })
  exclusiveZone: string | null;

  /** Niveau dans la chaîne de sous-traitance (1 = donneur direct, 2, 3…). */
  @Column({ type: 'integer', nullable: true })
  level: number | null;

  /** Partenaire amont (donneur d'ordre) dans la chaîne. */
  @Column({ type: 'uuid', nullable: true })
  parentPartnerId: string | null;

  /** Pièce jointe : contrat de sous-traitance (URL). */
  @Column({ type: 'text', nullable: true })
  contractFile: string | null;

  /** Pièce jointe : bordereau de prix (URL). */
  @Column({ type: 'text', nullable: true })
  bordereauFile: string | null;

  @Column({ default: true })
  active!: boolean;
}
