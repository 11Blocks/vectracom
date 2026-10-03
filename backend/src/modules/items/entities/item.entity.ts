import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Les 6 domaines métier (Item), confirmés par la réunion directeur. */
export const ITEM_CODES = [
  'FTTH',
  'INFRA',
  'PP_GC',
  'EXT_DENSIF',
  'DEPLOIEMENT',
  'BTS',
] as const;
export type ItemCode = (typeof ITEM_CODES)[number];

export const ITEM_LABELS: Record<ItemCode, string> = {
  FTTH: 'FTTH (installation, SAV, survey fibre/ADSL/5G/VSAT)',
  INFRA: 'INFRA (dérangements centrales ↔ PBO)',
  PP_GC: 'Plantation poteau & Génie Civil',
  EXT_DENSIF: 'Extension & Densification',
  DEPLOIEMENT: 'Déploiement (zone non fibrée)',
  BTS: 'BTS (antennes mobiles 4G/5G)',
};

/** Rôle dans la composition d'équipe (fonction occupée). */
export const EQUIPE_ROLES = [
  'CHEF',
  'BINOME',
  'STAGIAIRE',
  'ACCOMPAGNANT',
  'JOURNALIER',
  'CHEF_TIREUR',
  'CHEF_RACCORDEUR',
] as const;

export interface TeamRoleComposition {
  role: string;
  count: number;
}

/**
 * Domaine métier (Item) : regroupe les missionType en 6 axes.
 * L'Item porte la composition type d'équipe, la conformité type et la
 * grille tarifaire. Il est un niveau au-dessus de missionType (11 types).
 */
@Entity('items')
@Unique('uq_item_company_code', ['companyId', 'code'])
export class Item extends BaseEntity {
  @Column({ type: 'text' })
  code!: ItemCode;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** missionType couverts (ex. FTTH → INSTALLATION, SURVEY, SAV…). */
  @Column({ type: 'jsonb', default: '[]' })
  missionTypes!: string[];

  /** Composition type : [{ role, count }]. */
  @Column({ type: 'jsonb', default: '[]' })
  teamComposition!: TeamRoleComposition[];

  @Column({ default: true })
  active!: boolean;
}
