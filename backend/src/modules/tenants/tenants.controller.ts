import { Body, Controller, Get, HttpCode, Ip, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { COMPANY_SUBSCRIPTION_STATUSES, CompanySubscriptionStatus } from '../auth/entities/company.entity';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

class ImpersonateDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

class SetActiveDto {
  @IsBoolean()
  active!: boolean;
}

class SetSubscriptionStatusDto {
  @IsIn(COMPANY_SUBSCRIPTION_STATUSES as unknown as string[])
  status!: CompanySubscriptionStatus;
}

const CONSOLE_READERS = [UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN];

@Controller('tenants')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles(...CONSOLE_READERS)
  list(@Query('includeArchived') includeArchived?: string) {
    return this.tenantsService.list(includeArchived === 'true');
  }

  @Get(':id')
  @Roles(...CONSOLE_READERS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.detail(id);
  }

  @Get(':id/audit-logs')
  @Roles(...CONSOLE_READERS)
  auditLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('all') all?: string,
  ) {
    return this.tenantsService.auditLogs(id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      all: all === 'true',
    });
  }

  @Post()
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.tenantsService.create(dto, { user, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.tenantsService.update(id, dto, { user, ip });
  }

  @Patch(':id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.tenantsService.setActive(id, dto.active, { user, ip });
  }

  @Patch(':id/subscription-status')
  setSubscriptionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSubscriptionStatusDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.tenantsService.setSubscriptionStatus(id, dto.status, { user, ip });
  }

  @Post(':id/archive')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.tenantsService.archive(id, { user, ip });
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.tenantsService.restore(id, { user, ip });
  }

  @Post(':id/impersonate')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN)
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.tenantsService.impersonate(id, dto.userId, { user, ip });
  }
}
