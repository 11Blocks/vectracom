import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../common/decorators/roles.decorator';

/**
 * Utilisé par la Console Green-T pour créer un tenant + son admin.
 * Réservé super_admin / finance_admin (contrôlé par @Roles).
 */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsOptional()
  @IsString()
  sonatelSubcontractorName?: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsString()
  @MinLength(2)
  adminFullName!: string;

  @IsOptional()
  @IsString()
  adminRole?: Extract<UserRole, 'admin'>;
}
