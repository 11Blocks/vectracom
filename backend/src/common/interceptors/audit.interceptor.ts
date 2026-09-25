import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayloadUser } from '../decorators/current-user.decorator';

interface AuditRequest extends Request {
  user?: JwtPayloadUser;
  tenantId?: string | null;
}

/**
 * Trace toute mutation (POST/PATCH/PUT/DELETE) dans audit_logs :
 * qui, quelle action, quelle entité, statut de la réponse.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = request.method.toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const response = context.switchToHttp().getResponse();
    const route = (request.route?.path as string | undefined) ?? request.url;

    return next.handle().pipe(
      tap({
        next: () => void this.writeAudit(request, user, route, method, response.statusCode, null),
        error: (err) =>
          void this.writeAudit(request, user, route, method, err?.status ?? 500, err?.message ?? null),
      }),
    );
  }

  private async writeAudit(
    request: AuditRequest,
    user: JwtPayloadUser | undefined,
    route: string,
    method: string,
    statusCode: number,
    error: string | null,
  ) {
    try {
      const body = { ...request.body } as Record<string, unknown>;
      delete body.password;
      delete body.adminPassword;
      delete body.newPassword;
      delete body.passwordHash;

      await this.dataSource.query(
        `INSERT INTO audit_logs (id, company_id, user_id, action, entity_type, entity_id, payload, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          uuidv4(),
          request.tenantId ?? user?.companyId ?? null,
          user?.id ?? null,
          `${method} ${route} → ${statusCode}`,
          request.params?.id ?? null,
          request.params?.id ?? null,
          JSON.stringify(user?.impersonatedBy ? { body, error, impersonatedBy: user.impersonatedBy } : { body, error }),
          request.ip ?? null,
        ],
      );
    } catch {
      // L'audit ne doit jamais casser la requête métier.
    }
  }
}

