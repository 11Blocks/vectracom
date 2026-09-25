import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  LinkTechnicianDto,
  SetUserActiveDto,
  SetUserPasswordDto,
  UpdateUserDto,
} from './dto/users.dto';

/**
 * Console Green-T : comptes d'un tenant.
 * super_admin / finance_admin : gestion complète ; support_admin : consultation + mots de passe.
 */
@Controller('tenants/:companyId/users')
@Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
export class TenantUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
  list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.users.list(companyId);
  }

  @Post()
  create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.create(companyId, dto, { user, ip });
  }

  @Patch(':id')
  update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.update(companyId, id, dto, { user, ip });
  }

  @Patch(':id/active')
  setActive(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setActive(companyId, id, dto.active, { user, ip });
  }

  @Post(':id/password')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
  setPassword(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setPassword(companyId, id, dto, { user, ip });
  }

  @Post(':id/reset-link')
  @HttpCode(200)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
  resetLink(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.createResetLink(companyId, id, { user, ip });
  }
}

/** Admin tenant : gestion des comptes de sa propre entreprise. */
@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  list(@CurrentUser('companyId') companyId: string) {
    return this.users.list(this.tenant(companyId));
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.users.create(this.tenant(user.companyId), dto, { user, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.update(this.tenant(user.companyId), id, dto, { user, ip });
  }

  @Patch(':id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setActive(this.tenant(user.companyId), id, dto.active, { user, ip });
  }

  @Post(':id/password')
  @HttpCode(200)
  setPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setPassword(this.tenant(user.companyId), id, dto, { user, ip });
  }

  @Post(':id/reset-link')
  @HttpCode(200)
  resetLink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.users.createResetLink(this.tenant(user.companyId), id, { user, ip });
  }

  @Patch(':id/technician')
  linkTechnician(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkTechnicianDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.linkTechnician(this.tenant(user.companyId), id, dto.technicianId, { user, ip });
  }

  private tenant(companyId: string | null): string {
    // super_admin traverse RolesGuard mais n'a pas de tenant : il passe par /tenants/:companyId/users.
    if (!companyId) throw new BadRequestException('Utilisez la console : /tenants/:companyId/users');
    return companyId;
  }
}

/** Équipe Green-T (comptes console) — super_admin uniquement. */
@Controller('console/team')
@Roles(UserRole.SUPER_ADMIN)
export class ConsoleTeamController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list(null);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.users.create(null, dto, { user, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.update(null, id, dto, { user, ip });
  }

  @Patch(':id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setActive(null, id, dto.active, { user, ip });
  }

  @Post(':id/password')
  @HttpCode(200)
  setPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
    @CurrentUser() user: JwtPayloadUser,
    @Ip() ip: string,
  ) {
    return this.users.setPassword(null, id, dto, { user, ip });
  }

  @Post(':id/reset-link')
  @HttpCode(200)
  resetLink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayloadUser, @Ip() ip: string) {
    return this.users.createResetLink(null, id, { user, ip });
  }
}
