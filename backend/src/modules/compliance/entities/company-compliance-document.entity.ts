import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Conformité contractuelle — 3 piliers SONATEL :
 * Code de Conduite Fournisseur, Directives SST, Gestion des déchets D3E.
 */
export const COMPLIANCE_DOC_TYPES = ['code_conduite', 'charte_sst', 'dechets_d3e'] as const;
export type ComplianceDocType = (typeof COMPLIANCE_DOC_TYPES)[number];

@Entity('company_compliance_documents')
@Index(['companyId', 'docType'])
export class CompanyComplianceDocument extends BaseEntity {
  @Column({ type: 'text' })
  docType!: ComplianceDocType;

  @Column({ default: false })
  signed!: boolean;

  @Column({ type: 'date', nullable: true })
  signedAt: string | null;

  @Column({ type: 'text' })
  fileUrl!: string;
}
