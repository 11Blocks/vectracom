import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const RENFORT_STATUSES = ['actif', 'termine', 'annule'] as const;
export type RenfortStatus = (typeof RENFORT_STATUSES)[number];

/**
 * Renfort : équipe déplacée de sa zone d'origine vers une zone de renfort.
 * Chaque membre touche un supplément perdiem/jour (perdiemPerDay, défaut 1000 F).
 */
@Entity('renforts')
@Index(['companyId', 'teamId'])
export class Renfort extends BaseEntity {
  @Column({ type: 'uuid' })
  teamId!: string;

  @Column({ type: 'uuid', nullable: true })
  fromZoneId: string | null;

  @Column({ type: 'uuid', nullable: true })
  toZoneId: string | null;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 1000 })
  perdiemPerDay!: number;

  @Column({ type: 'text', default: 'actif' })
  status!: RenfortStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
