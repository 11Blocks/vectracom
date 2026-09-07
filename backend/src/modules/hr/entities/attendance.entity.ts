import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Technician } from '../../technicians/entities/technician.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Feuille de présence hebdomadaire L M M M J V S D — weekStart est le lundi
 * de la semaine. Utilisée pour la RH et le suivi SONATEL.
 */
@Entity('attendance')
@Index(['companyId', 'technicianId', 'weekStart'], { unique: true })
export class Attendance extends BaseEntity {
  @Column({ type: 'uuid' })
  technicianId!: string;

  @ManyToOne(() => Technician, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician;

  @Column({ type: 'date' })
  weekStart!: string;

  @Column({ default: false })
  monday!: boolean;

  @Column({ default: false })
  tuesday!: boolean;

  @Column({ default: false })
  wednesday!: boolean;

  @Column({ default: false })
  thursday!: boolean;

  @Column({ default: false })
  friday!: boolean;

  @Column({ default: false })
  saturday!: boolean;

  @Column({ default: false })
  sunday!: boolean;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'validated_by' })
  validatedByUser: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt: Date | null;
}
