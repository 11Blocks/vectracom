import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../teams/entities/team.entity';

/**
 * Lot P5 — Journalier d'une équipe déploiement (document ERP fondateur :
 * « Un chef d'équipe avec cinq à six journaliers »). Pointé quotidiennement
 * sur chantier, salarié à la journée (comptabilité par rubrique).
 */
@Entity('daily_workers')
@Index(['companyId', 'teamId'])
export class DailyWorker extends BaseEntity {
  @Column({ type: 'text' })
  fullName!: string;

  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  /** Salaire journalier convenu (FCFA/jour). */
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  dailyRate!: string;

  @Column({ default: true })
  active!: boolean;
}
