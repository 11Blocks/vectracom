import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

class UpdateSectionDto {
  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ImportDto {
  @IsObject()
  data!: Record<string, unknown>;
}

@Controller('settings')
@Roles(UserRole.ADMIN, UserRole.DIRECTION)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getAll(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.settings.getAll(companyId!);
  }

  @Get('journal')
  journal(
    @CurrentUser('companyId') companyId: string | null,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(companyId);
    return this.settings.journal(companyId!, limit ? Number(limit) : 50);
  }

  @Get('audit-logs')
  auditLogs(
    @CurrentUser('companyId') companyId: string | null,
    @Query('limit') limit?: string,
    @Query('kind') kind?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('all') all?: string,
  ) {
    this.requireTenant(companyId);
    return this.settings.auditLogs(companyId!, limit ? Number(limit) : 50, {
      kind: kind ?? (all === 'true' ? undefined : 'metier'), userId, from, to, q, offset: offset ? Number(offset) || 0 : 0,
    });
  }

  @Get('export')
  export(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.settings.exportConfig(companyId!);
  }

  @Get(':section')
  getSection(
    @CurrentUser('companyId') companyId: string | null,
    @Param('section') section: string,
  ) {
    this.requireTenant(companyId);
    return this.settings.getSection(companyId!, section);
  }

  @Put(':section')
  @Roles(UserRole.ADMIN)
  updateSection(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string | undefined,
    @Param('section') section: string,
    @Body() body: UpdateSectionDto,
  ) {
    this.requireTenant(companyId);
    return this.settings.updateSection(companyId!, section, body.data ?? {}, {
      userId,
      userEmail: userEmail ?? null,
      reason: body.reason,
    });
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  import(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string | undefined,
    @Body() body: ImportDto,
  ) {
    this.requireTenant(companyId);
    return this.settings.importConfig(companyId!, body, {
      userId,
      userEmail: userEmail ?? null,
    });
  }

  @Post('restore-defaults')
  @Roles(UserRole.ADMIN)
  restore(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') userEmail: string | undefined,
  ) {
    this.requireTenant(companyId);
    return this.settings.restoreDefaults(companyId!, {
      userId,
      userEmail: userEmail ?? null,
    });
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
