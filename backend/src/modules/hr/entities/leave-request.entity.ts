import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Employee } from './employee.entity';

export const LEAVE_STATUSES = ['en_attente', 'approuve', 'refuse'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Demande de congé/absence — 2 clics côté mobile, validation manager. */
@Entity('leave_requests')
@Index(['companyId', 'employeeId'])
export class LeaveRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column({ type: 'text', default: 'en_attente' })
  status!: LeaveStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
