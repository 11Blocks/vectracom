import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMembership } from './entities/chat-membership.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RemonteeController } from './remontee.controller';
import { RemonteeBridgeService } from './remontee-bridge.service';
import { MatrixClient } from './matrix.client';
import { Team } from '../teams/entities/team.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { User } from '../auth/entities/user.entity';
import { Company } from '../auth/entities/company.entity';
import { Mission } from '../missions/entities/mission.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { IaVisionModule } from '../ia-vision/ia-vision.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      ChatMembership,
      ChatMessage,
      Team,
      Technician,
      User,
      Company,
      Mission,
    ]),
    NotificationsModule,
    IaVisionModule,
  ],
  controllers: [ChatController, RemonteeController],
  providers: [ChatService, MatrixClient, RemonteeBridgeService],
  exports: [ChatService, RemonteeBridgeService],
})
export class ChatModule {}
