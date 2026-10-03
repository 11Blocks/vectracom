import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PERMANENCE_TYPES = ['SAV', 'PRODUCTION'] as const;
export type PermanenceType = (typeof PERMANENCE_TYPES)[number];

/**
 * Créneau de permanence (week-end / jour férié).
 * type = SAV (astreinte dépannage) ou PRODUCTION (installations).
 * team_id = équipe assignée par rotation ; null tant que non affectée.
 */
@Entity('permanence_slots')
@Unique('uq_permanence_type_day', ['companyId', 'type', 'day'])
@Index(['companyId', 'day'])
export class PermanenceSlot extends BaseEntity {
  @Column({ type: 'text' })
  type!: PermanenceType;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'date' })
  day!: string;

  @Column({ type: 'text', nullable: true })
  zone: string | null;
}
