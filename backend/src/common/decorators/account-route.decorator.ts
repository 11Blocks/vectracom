import { SetMetadata } from '@nestjs/common';

export const IS_ACCOUNT_ROUTE_KEY = 'isAccountRoute';

/**
 * Route de gestion de son propre compte (profil, mot de passe) : reste accessible
 * même si un changement de mot de passe est exigé ou si le tenant est en lecture seule.
 */
export const AccountRoute = () => SetMetadata(IS_ACCOUNT_ROUTE_KEY, true);
