import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_ACCOUNT_ROUTE_KEY } from '../decorators/account-route.decorator';
import { GREEN_T_ROLES } from '../decorators/roles.decorator';
import { JwtPayloadUser } from '../decorators/current-user.decorator';
import { Company } from '../../modules/auth/entities/company.entity';

/**
 * Blocage progressif selon le statut d'abonnement du tenant :
 *   ACTIF / TRIAL / RETARD_J1 / RETARD_J15 → accès complet
 *   RETARD_J20                            → lecture seule
 *   SUSPENDU / RESILIE                    → accès bloqué
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const isAccountRoute = this.reflector.getAllAndOverride<boolean>(IS_ACCOUNT_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAccountRoute) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayloadUser | undefined = request.user;
    if (!user) return true; // JwtAuthGuard rejette déjà les requêtes non authentifiées.

    if (user.companyId === null || GREEN_T_ROLES.includes(user.role)) return true;

    const company = await this.companyRepository.findOne({
      where: { id: user.companyId },
      select: ['id', 'active', 'subscriptionStatus'],
    });

    if (!company || !company.active) {
      throw new ForbiddenException('Tenant inactif — contactez Green-T');
    }

    switch (company.subscriptionStatus) {
      case 'suspendu':
        throw new ForbiddenException('Accès suspendu (impayé J+30) — régularisez votre abonnement');
      case 'resilie':
        throw new ForbiddenException('Compte résilié — contactez Green-T');
      case 'retard_j20': {
        const method = request.method.toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
          throw new ForbiddenException('Accès en lecture seule (avertissement suspension J+20)');
        }
        return true;
      }
      default:
        return true;
    }
  }
}
