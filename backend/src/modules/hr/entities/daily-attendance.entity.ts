import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Lot P5 — Pointage chantier d'un journalier : une ligne par ouvrier et par
 * jour travaillé, rattachée à la mission (quantités matière relevées à chaque
 * étape via la fiche de chantier).
 */
@Entity('daily_attendances')
@Index(['companyId', 'missionId', 'day'])
export class DailyAttendance extends BaseEntity {
  @Column({ type: 'uuid' })
  dailyWorkerId!: string;

  @Column({ type: 'uuid', nullable: true })
  missionId: string | null;

  /** Jour pointé (YYYY-MM-DD). */
  @Column({ type: 'date' })
  day!: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1 })
  daysWorked!: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
