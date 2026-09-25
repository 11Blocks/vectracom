import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayloadUser {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  /** null pour super_admin/finance_admin Green-T (hors tenant) */
  companyId: string | null;
  companyName?: string;
  licenseType?: string | null;
  mustChangePassword?: boolean;
  /** Super admin à l'origine d'une session support, sinon null. */
  impersonatedBy?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayloadUser | undefined, ctx: ExecutionContext): JwtPayloadUser | string | null => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
