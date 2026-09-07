import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { GREEN_T_ROLES } from '../decorators/roles.decorator';

/**
 * Multi-tenant strict : toute requête non-publique est isolée par companyId.
 * - Les rôles Green-T (company_id null) passent (console + support transverse).
 * - Pour les autres : le companyId de référence est TOUJOURS celui du JWT.
 *   Un companyId déclaré dans la requête mais différent → 403.
 *   La valeur de référence est exposée via request.tenantId (jamais injectée
 *   dans query/body : le ValidationPipe en whitelist refuserait la propriété).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayloadUser | undefined = request.user;
    if (!user) throw new ForbiddenException('Non authentifié');

    if (user.companyId === null && GREEN_T_ROLES.includes(user.role)) {
      request.tenantId = request.body?.companyId ?? request.query?.companyId ?? null;
      return true;
    }

    if (!user.companyId) throw new ForbiddenException('Compte sans rattachement tenant');

    const claimed =
      (request.body?.companyId as string | undefined) ??
      (request.query?.companyId as string | undefined) ??
      (request.params?.companyId as string | undefined);

    if (claimed && claimed !== user.companyId) {
      throw new ForbiddenException('Accès refusé : ressource hors tenant');
    }

    request.tenantId = user.companyId;
    return true;
  }
}
