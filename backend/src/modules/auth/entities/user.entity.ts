import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/decorators/roles.decorator';
import { Company } from './company.entity';

export const USER_LICENSE_TYPES = ['mobile', 'web', 'rag', 'geolocation'] as const;
export type UserLicenseType = (typeof USER_LICENSE_TYPES)[number];

@Entity('users')
@Index(['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, (company) => company.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @Column()
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column()
  fullName!: string;

  @Column({ type: 'text' })
  role!: UserRole;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'text', nullable: true })
  licenseType: UserLicenseType | null;

  @Column({ default: true })
  licenseActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ default: false })
  mustChangePassword!: boolean;

  /** Les JWT émis avant cette date sont refusés (changement / reset de mot de passe). */
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ type: 'text', nullable: true, select: false })
  passwordResetToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpires: Date | null;
}
