import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  FINANCE_ADMIN = 'finance_admin',
  SUPPORT_ADMIN = 'support_admin',
  ADMIN = 'admin',
  DIRECTION = 'direction',
  CHEF_EQUIPE = 'chef_equipe',
  MAGASINIER = 'magasinier',
}

/** Rôles Green-T : accès console, non rattachés à un tenant. */
export const GREEN_T_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN];

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
