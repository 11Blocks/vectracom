import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles, UserRole } from '../decorators/roles.decorator';
import { AuditService } from './audit.service';

class AuditQueryDto {
  @IsOptional() @IsUUID() companyId?: string;
  /** "console" = actions de l'équipe Green-T hors tenant. */
  @IsOptional() @IsIn(['console']) scope?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsIn(['true', 'false']) all?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() offset?: string;
}

/** Journal d'audit transverse (console Green-T). */
@Controller('audit-logs')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: AuditQueryDto) {
    return this.audit.list({
      companyId: q.scope === 'console' ? null : q.companyId,
      entityType: q.entityType,
      entityId: q.entityId,
      onlyNamed: q.all !== 'true',
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
  }
}
