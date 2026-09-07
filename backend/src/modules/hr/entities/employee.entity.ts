import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../teams/entities/team.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

export const EMPLOYEE_STATUSES = ['actif', 'en_conge'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_DOC_TYPES = [
  'CNI',
  'CONTRAT',
  'CV',
  'DIPLOME',
  'CERTIFICAT',
  'ATTESTATION',
  'PERMIS',
] as const;

export interface EmployeeDocument {
  type: (typeof EMPLOYEE_DOC_TYPES)[number];
  fileUrl: string;
  expirationDate?: string;
}

/** Fiche employé (RH) — distincte du technicien terrain mais souvent liée. */
@Entity('employees')
@Index(['companyId', 'matricule'])
export class Employee extends BaseEntity {
  @Column()
  fullName!: string;

  @Column({ type: 'text', nullable: true })
  jobTitle: string | null;

  @Column({ type: 'uuid', nullable: true })
  teamId: string | null;

  @ManyToOne(() => Team, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => Vehicle, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ type: 'text', nullable: true })
  matricule: string | null;

  @Column({ type: 'text', default: 'actif' })
  status!: EmployeeStatus;

  @Column({ type: 'date', nullable: true })
  habilitationExpiration: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  documents!: EmployeeDocument[];
}
