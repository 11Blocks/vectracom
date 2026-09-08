import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';

class PostMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

class ListMessagesQuery {
  @IsOptional()
  @IsString()
  limit?: string;
}

@Controller('chat')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('status')
  status() {
    return this.chat.status();
  }

  @Get('matrix/ping')
  matrixPing() {
    return this.chat.matrixPing();
  }

  @Get('rooms')
  rooms(@CurrentUser('companyId') companyId: string | null, @CurrentUser('id') userId: string) {
    this.requireTenant(companyId);
    return this.chat.ensureMyRooms(companyId!, userId);
  }

  @Get('rooms/for-mission/:missionId')
  forMission(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('missionId') missionId: string,
    @Query('missionRoom') missionRoom?: string,
  ) {
    this.requireTenant(companyId);
    return this.chat.roomForMission(companyId!, userId, missionId, {
      missionRoom: missionRoom === '1' || missionRoom === 'true',
    });
  }

  @Get('rooms/:id/messages')
  messages(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() query: ListMessagesQuery,
  ) {
    this.requireTenant(companyId);
    const limit = query.limit ? Number(query.limit) : 50;
    return this.chat.listMessages(companyId!, userId, id, Number.isFinite(limit) ? limit : 50);
  }

  @Post('rooms/:id/messages')
  post(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: PostMessageDto,
  ) {
    this.requireTenant(companyId);
    return this.chat.postMessage(companyId!, userId, id, dto);
  }

  private requireTenant(companyId: string | null) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
