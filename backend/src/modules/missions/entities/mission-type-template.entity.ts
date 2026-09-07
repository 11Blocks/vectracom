import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const MISSION_TYPES = [
  'INSTALLATION',
  'SURVEY',
  'SAV',
  'INFRA',
  'OSM',
  'GC',
  'PLANTATION',
  'DEVOIEMENT',
  'DEPLOIEMENT',
  'DENSIFICATION',
  'SURVEY_OSM',
] as const;
export type MissionType = (typeof MISSION_TYPES)[number];

export interface TemplateStepField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'photos' | 'signature' | 'checklist';
  required?: boolean;
  options?: string[];
}

export interface TemplateStep {
  id: string;
  label: string;
  icon: string;
  blocking?: boolean;
  fields: TemplateStepField[];
}

export interface RequiredPhoto {
  type: string;
  label: string;
  count: number;
}

/**
 * Template de formulaire pilotant la saisie terrain selon le type de mission.
 * Un tenant peut surcharger les défauts ; getEffective() du service des
 * templates assure le repli.
 */
@Entity('mission_type_templates')
@Index(['companyId', 'typeName'], { unique: true })
export class MissionTypeTemplate extends BaseEntity {
  @Column({ type: 'text' })
  typeName!: MissionType;

  @Column()
  label!: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  steps!: TemplateStep[];

  @Column({ type: 'jsonb', default: '[]' })
  requiredPhotos!: RequiredPhoto[];

  @Column({ type: 'jsonb', default: '[]' })
  checklistTemplate!: Array<{ itemNumber?: number; label: string; unit?: string }>;

  @Column({ type: 'jsonb', default: {} })
  workflow!: { statuses?: string[] };

  @Column({ default: true })
  isActive!: boolean;
}
