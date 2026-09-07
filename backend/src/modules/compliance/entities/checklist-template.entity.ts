import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export interface ChecklistItem {
  label: string;
  required: boolean;
}

/**
 * Checklist de conformité opérationnelle, paramétrable par type de mission.
 * Aucun item n'est codé en dur : tout est configurable par tenant.
 */
@Entity('compliance_checklist_templates')
@Index(['companyId', 'missionType'], { unique: true })
export class ComplianceChecklistTemplate extends BaseEntity {
  @Column({ type: 'text' })
  missionType!: string;

  @Column({ type: 'jsonb' })
  items!: ChecklistItem[];
}
