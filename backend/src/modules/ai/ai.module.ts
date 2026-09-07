import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { RagChatController } from './rag-chat.controller';
import { AiService } from './ai.service';
import { RagChatService } from './rag-chat.service';
import { AgentPlanningService } from './agent-planning.service';
import { AgentStockService } from './agent-stock.service';
import { AgentOptimisationService } from './agent-optimisation.service';
import { PhotoAuditService } from './photo-audit.service';
import { ReceiptExtractionService } from './receipt-extraction.service';
import { VoiceShortcutService } from './voice-shortcut.service';
import { RagConversation } from './entities/rag-conversation.entity';
import { RagDocument } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { RagMessage } from './entities/rag-message.entity';
import { CompanySubscription } from '../saas/entities/company-subscription.entity';
import { Mission } from '../missions/entities/mission.entity';
import { StockItem } from '../stock/entities/stock-item.entity';
import { StockLevel } from '../stock/entities/stock-level.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { VehicleEvent } from '../vehicles/entities/vehicle-event.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { SonatelKpiLog } from '../kpi-sonatel/entities/sonatel-kpi-log.entity';
import { Team } from '../teams/entities/team.entity';
import { Technician } from '../technicians/entities/technician.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RagConversation,
      RagMessage,
      RagDocument,
      RagChunk,
      CompanySubscription,
      Mission,
      StockItem,
      StockLevel,
      StockMovement,
      Vehicle,
      VehicleEvent,
      Incident,
      SonatelKpiLog,
      Team,
      Technician,
    ]),
  ],
  controllers: [AiController, RagChatController],
  providers: [
    AiService,
    RagChatService,
    AgentPlanningService,
    AgentStockService,
    AgentOptimisationService,
    PhotoAuditService,
    ReceiptExtractionService,
    VoiceShortcutService,
  ],
  exports: [AiService, RagChatService],
})
export class AiModule {}
