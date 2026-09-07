import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const SHEET_TYPES = ['planning', 'affect'] as const;
export type SheetType = (typeof SHEET_TYPES)[number];

/** Champs cibles reconnus pour chaque onglet. */
export const PLANNING_TARGET_FIELDS = [
  'dossierNumber',
  'segment',
  'coper',
  'commandeClient',
  'typeLogement',
  'clientAvise',
  'contactClient',
  'heure',
  'ageDays',
  'srPlaque',
  'gpsEasyWork',
  'ciPrcl',
  'client',
  'task',
  'zone',
  'dateMission',
  'olt',
  'produit',
  'subcontractor',
] as const;

export const AFFECT_TARGET_FIELDS = ['dossierNumber', 'team', 'technicians', 'heureDebut', 'heureFin'] as const;

/**
 * Correspondance colonne Excel SONATEL → champ VECTRACOM, configurable
 * par tenant et réutilisable d'un import à l'autre.
 */
@Entity('sonatel_column_mappings')
@Unique('uq_column_mapping', ['companyId', 'sheetType', 'sourceColumnName'])
export class SonatelColumnMapping extends BaseEntity {
  @Column({ type: 'text' })
  sheetType!: SheetType;

  @Column({ type: 'text' })
  sourceColumnName!: string;

  @Column({ type: 'text' })
  targetField!: string;
}
