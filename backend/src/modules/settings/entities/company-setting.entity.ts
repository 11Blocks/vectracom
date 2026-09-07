import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Configuration tenant (13 sections Paramètres) — un enregistrement par entreprise. */
@Entity('company_settings')
@Unique('uq_company_settings_company', ['companyId'])
export class CompanySetting extends BaseEntity {
  /** Blob JSON des 13 sections. */
  @Column({ type: 'jsonb', default: {} })
  data!: Record<string, unknown>;
}
