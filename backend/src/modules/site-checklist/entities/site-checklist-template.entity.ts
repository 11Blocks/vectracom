import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const SITE_SHEET_TYPES = ['OSM', 'GC', 'DENSIF', 'SURVEY_OSM'] as const;
export type SiteSheetType = (typeof SITE_SHEET_TYPES)[number];

export interface SiteChecklistItem {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'photos';
  unit?: string;
  /** Référence optionnelle au bordereau 3STB (price_items.item_number). */
  priceItem?: number;
  options?: string[];
}

export interface SiteChecklistSection {
  section: string;
  items: SiteChecklistItem[];
}

/** Fiche de chantier numérique — templates basés sur les fiches Excel ONECOMIT. */
@Entity('site_checklist_templates')
@Index(['companyId', 'templateType'], { unique: true })
export class SiteChecklistTemplate extends BaseEntity {
  @Column({ type: 'text' })
  templateType!: SiteSheetType;

  @Column()
  label!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  sections!: SiteChecklistSection[];

  @Column({ type: 'jsonb', default: '[]' })
  requiredPhotos!: Array<{ type: string; label: string; count: number }>;

  @Column({ type: 'jsonb', default: '{}' })
  extraFields!: Record<string, unknown>;
}
