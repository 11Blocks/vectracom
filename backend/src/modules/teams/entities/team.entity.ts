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

  @Column({ default: true })
  active!: boolean;

  @OneToMany('Technician', 'team')
  technicians?: unknown[];
}
