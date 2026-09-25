import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '../../../common/decorators/roles.decorator';
import { USER_LICENSE_TYPES, UserLicenseType } from '../../auth/entities/user.entity';

export const TENANT_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTION,
  UserRole.CHEF_EQUIPE,
  UserRole.MAGASINIER,
] as const;

export const CONSOLE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
] as const;

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  role!: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Absent = mot de passe temporaire généré et retourné une seule fois. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsIn(USER_LICENSE_TYPES as unknown as string[])
  licenseType?: UserLicenseType;

  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  role?: UserRole;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(USER_LICENSE_TYPES as unknown as string[])
  licenseType?: UserLicenseType | null;
}

export class SetUserActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class SetUserPasswordDto {
  /** Absent = génération d'un mot de passe temporaire. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}

export class LinkTechnicianDto {
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  technicianId!: string | null;
}
