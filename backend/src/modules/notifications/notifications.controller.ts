import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PageQueryDto, withTotal } from '../../common/pagination';
import { IsBooleanString, IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationsCronService } from './notifications-cron.service';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from './entities/notification.entity';

class ListNotificationsQueryDto extends PageQueryDto {
  @IsOptional() @IsBooleanString() unreadOnly?: string;
}

class TestNotificationDto {
  @IsIn(NOTIFICATION_CHANNELS as unknown as string[])
  channel!: string;

  @IsOptional() @IsString() recipient?: string;
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
}

class RegisterPushDto {
  @IsString() @MinLength(10) token!: string;
  @IsIn(['ios', 'android', 'web']) platform!: string;
  @IsOptional() @IsString() deviceId?: string;
}

class UnregisterPushDto {
  @IsString() @MinLength(10) token!: string;
}

class SettingsDto {
  @IsOptional() pushEnabled?: boolean;
  @IsOptional() whatsappEnabled?: boolean;
  @IsOptional() emailEnabled?: boolean;
  @IsOptional() telegramEnabled?: boolean;
  @IsOptional() missionUrgentEnabled?: boolean;
  @IsOptional() echeanceEnabled?: boolean;
  @IsOptional() stockAlertEnabled?: boolean;
  @IsOptional() incidentAlertEnabled?: boolean;
  @IsOptional() paymentAlertEnabled?: boolean;
}

@Controller('notifications')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly cron: NotificationsCronService,
  ) {}

  @Get()
  async list(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Query() query: ListNotificationsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.requireTenant(companyId);
    return withTotal(res, await this.notificationsService.list(companyId!, userId, {
      unreadOnly: query.unreadOnly === 'true',
      limit: query.limit,
      offset: query.offset,
    }));
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string) {
    this.requireTenant(companyId);
    return { count: await this.notificationsService.getUnreadCount(companyId!, userId) };
  }

  @Get('settings')
  settings(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.notificationsService.getSettings(companyId!);
  }

  @Put('settings')
  @Roles(UserRole.ADMIN)
  updateSettings(@CurrentUser('companyId') companyId: string | null, @Body() dto: SettingsDto) {
    this.requireTenant(companyId);
    return this.notificationsService.updateSettings(companyId!, dto);
  }

  @Put('read-all')
  markAllAsRead(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string) {
    this.requireTenant(companyId);
    return this.notificationsService.markAllAsRead(companyId!, userId);
  }

  @Put(':id/read')
  markAsRead(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    this.requireTenant(companyId);
    return this.notificationsService.markAsRead(companyId!, userId, id);
  }

  @Post('register-push')
  registerPush(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPushDto,
  ) {
    this.requireTenant(companyId);
    return this.notificationsService.registerPush(companyId!, userId, dto);
  }

  @Post('unregister-push')
  unregisterPush(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: UnregisterPushDto,
  ) {
    this.requireTenant(companyId);
    return this.notificationsService.unregisterPush(companyId!, userId, dto.token);
  }

  /** Test d'un canal par l'admin ; destinataire par défaut = ses propres coordonnées. */
  @Post('test')
  @Roles(UserRole.ADMIN)
  async test(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: TestNotificationDto,
  ) {
    this.requireTenant(companyId);
    const me = await this.notificationsService.userContact(companyId!, userId);
    const fallback = dto.channel === 'email' ? me?.email : dto.channel === 'whatsapp' ? me?.phone : null;
    return this.notificationsService.send({
      companyId: companyId!,
      type: 'test',
      channel: dto.channel as never,
      userId,
      recipient: dto.recipient?.trim() || fallback || null,
      title: dto.title ?? 'Notification de test VECTRACOM',
      body: dto.body ?? `Test du canal ${dto.channel}`,
      data: dto.data,
    });
  }

  /** Déclenchement manuel des alertes quotidiennes, limité au tenant appelant. */
  @Post('cron/run-daily')
  @Roles(UserRole.ADMIN)
  runDailyCron(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.cron.runDaily(companyId!);
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
