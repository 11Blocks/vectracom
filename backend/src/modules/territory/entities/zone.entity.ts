import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Zone d'intervention (Mbour, Thiès, Tivaouane, Kaolack…). */
@Entity('zones')
@Unique('uq_zone_company_name', ['companyId', 'name'])
export class Zone extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  code: string | null;

  @Column({ default: true })
  active!: boolean;
}
