import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Satisfaction client : note globale + propreté + comportement (1..5). */
@Entity('client_feedback')
@Index(['companyId', 'teamId'])
export class ClientFeedback extends BaseEntity {
  @Column({ type: 'uuid' })
  missionId!: string;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ type: 'integer', nullable: true })
  cleanliness: number | null;

  @Column({ type: 'integer', nullable: true })
  behavior: number | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'text', nullable: true })
  clientName: string | null;
}
