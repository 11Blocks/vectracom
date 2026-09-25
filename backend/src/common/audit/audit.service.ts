import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEntry {
  companyId: string | null;
  actorId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Journal métier des actions d'administration (actions nommées, ex. `user.password_set`),
 * en complément de la trace HTTP brute écrite par AuditInterceptor.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly dataSource: DataSource) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (id, company_id, user_id, action, entity_type, entity_id, payload, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          uuidv4(),
          entry.companyId,
          entry.actorId,
          entry.action,
          entry.entityType ?? null,
          entry.entityId ?? null,
          JSON.stringify(entry.payload ?? {}),
          entry.ip ?? null,
        ],
      );
    } catch (err) {
      this.logger.warn(`Audit non écrit (${entry.action}) : ${(err as Error).message}`);
    }
  }

  /**
   * Lecture du journal. `companyId` undefined = tous tenants (console Green-T),
   * `onlyNamed` = uniquement les actions métier (exclut les traces HTTP "POST /… → 200").
   */
  async list(filters: {
    companyId?: string | null;
    entityType?: string;
    entityId?: string;
    onlyNamed?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.companyId !== undefined) {
      if (filters.companyId === null) where.push('a.company_id IS NULL');
      else {
        params.push(filters.companyId);
        where.push(`a.company_id = $${params.length}`);
      }
    }
    if (filters.entityType) {
      params.push(filters.entityType);
      where.push(`a.entity_type = $${params.length}`);
    }
    if (filters.entityId) {
      params.push(filters.entityId);
      where.push(`a.entity_id = $${params.length}`);
    }
    if (filters.onlyNamed) where.push(`a.action NOT LIKE '% → %'`);

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);
    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `SELECT a.id, a.company_id AS "companyId", c.name AS "companyName",
              a.user_id AS "userId", u.email AS "userEmail", u.full_name AS "userName",
              a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.payload, a.ip, a.created_at AS "createdAt"
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN companies c ON c.id = a.company_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY a.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows, limit, offset };
  }
}
