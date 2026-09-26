import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';
import { JwtPayloadUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayloadUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    // super_admin traverse toutes les barrières de rôle (console Green-T).
    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (!required.includes(user.role as UserRole)) {
      const allowed = required.map((r) => ROLE_LABELS[r] ?? r).join(', ');
      throw new ForbiddenException(`Action réservée à : ${allowed} (votre rôle : ${ROLE_LABELS[user.role] ?? user.role})`);
    }
    return true;
  }
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin Green-T', finance_admin: 'Finance Green-T', support_admin: 'Support Green-T',
  admin: 'Administrateur', direction: 'Direction', chef_equipe: "Chef d'équipe", magasinier: 'Magasinier',
};
