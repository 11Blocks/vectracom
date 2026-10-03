import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const TEAM_TYPES = ['PROD', 'SAV', 'INFRA', 'EXTENSION'] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

@Entity('teams')
@Index(['companyId', 'name'], { unique: true })
export class Team extends BaseEntity {
  @Column()
  name!: string;

  @Column({ type: 'text' })
  type!: TeamType;

  @Column({ type: 'text', nullable: true })
  zone: string | null;

  /** Zone d'intervention (référentiel zones). */
  @Column({ type: 'uuid', nullable: true })
  zoneId: string | null;

  /** Pilote superviseur du groupe d'équipes. */
  @Column({ type: 'uuid', nullable: true })
  pilotId: string | null;

  /** Domaine métier (Item) de l'équipe. */
  @Column({ type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ default: true })
  active!: boolean;

  @OneToMany('Technician', 'team')
  technicians?: unknown[];
}
