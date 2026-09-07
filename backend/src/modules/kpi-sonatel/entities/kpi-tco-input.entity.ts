import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Segments de TCO définis par l'annexe Optimax (facture mensuelle / redevance / PO). */
export const TCO_SEGMENTS = [
  'PRODUCTION_EM',
  'PRODUCTION_HM_MM',
  'PRODUCTION_B2B',
  'AUTRE_TECHNO',
  'MAINTENANCE',
  'EXTENSION_LOT',
  'DENSIFICATION_LOT',
] as const;
export type TcoSegment = (typeof TCO_SEGMENTS)[number];

export const TCO_SEGMENT_LABELS: Record<TcoSegment, string> = {
  PRODUCTION_EM: 'Production — Entrée de Marché (B2C)',
  PRODUCTION_HM_MM: 'Production — Haut & Moyen Marché (B2C)',
  PRODUCTION_B2B: 'Production — B2B',
  AUTRE_TECHNO: 'Autres technologies (5G, satellite, TDD…)',
  MAINTENANCE: 'Redevance maintenance (curative & préventive)',
  EXTENSION_LOT: 'PO lot extension',
  DENSIFICATION_LOT: 'PO lot densification',
};

/**
 * Saisie mensuelle du TCO par segment — base du calcul des pénalités
 * (Objectif − taux) × TCO. À défaut de saisie, le moteur retombe sur les
 * montants facturés du mois.
 */
@Entity('kpi_tco_inputs')
@Unique('uq_tco_period_segment', ['companyId', 'period', 'segment'])
@Index(['companyId', 'period'])
export class KpiTcoInput extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  /** Mois évalué, format YYYY-MM. */
  @Column({ type: 'text' })
  period!: string;

  @Column({ type: 'text' })
  segment!: TcoSegment;

  /** Montant FCFA HT du mois pour ce segment. */
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
