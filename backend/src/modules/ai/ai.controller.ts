import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { AgentPlanningService } from './agent-planning.service';
import { AgentStockService } from './agent-stock.service';
import { AgentOptimisationService } from './agent-optimisation.service';
import { PhotoAuditService } from './photo-audit.service';
import { ReceiptExtractionService } from './receipt-extraction.service';
import { VoiceShortcutService } from './voice-shortcut.service';

class AudioUrlDto {
  @IsString() @MinLength(4) audioUrl!: string;
}

class TranscriptionDto {
  @IsString() @MinLength(10) transcription!: string;
  @IsOptional() @IsUUID() missionId?: string;
}

class MissionIdDto {
  @IsOptional() @IsUUID() missionId?: string;
}

class PhotoUrlDto {
  @IsString() @MinLength(4) photoUrl!: string;
}

class PhotoUrlsDto {
  @IsArray() @ArrayMinSize(1) photoUrls!: string[];
}

class VoiceCommandDto {
  @IsString() @MinLength(3) command!: string;
  @IsOptional() @IsUUID() missionId?: string;
}

class DateQueryDto {
  @IsISO8601() date!: string;
}

@Controller('ai')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE, UserRole.MAGASINIER)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly planning: AgentPlanningService,
    private readonly stock: AgentStockService,
    private readonly optimisation: AgentOptimisationService,
    private readonly photoAudit: PhotoAuditService,
    private readonly receipts: ReceiptExtractionService,
    private readonly voice: VoiceShortcutService,
  ) {}

  private tenant(companyId: string | null): string {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return companyId;
  }

  /** Moteurs réellement branchés : sans clé, les réponses viennent de règles déterministes. */
  @Get('status')
  status() {
    const gemini = !!process.env.GEMINI_API_KEY;
    const yolo = !!process.env.YOLO_API_URL;
    return { gemini, yolo, mode: gemini || yolo ? 'ia' : 'regles' };
  }

  // ----- Agent Terrain -----

  @Post('terrain/transcribe')
  transcribe(@Body() dto: AudioUrlDto) {
    return this.ai.transcribeVoice(dto.audioUrl);
  }

  @Post('terrain/report')
  report(@Body() dto: TranscriptionDto) {
    return this.ai.generateReport(dto.transcription, dto.missionId);
  }

  @Post('terrain/actions')
  actions(@Body() dto: TranscriptionDto) {
    return this.ai.suggestActions(dto.transcription);
  }

  // ----- Agent Planning -----

  @Post('planning/suggest/:missionId')
  suggest(@CurrentUser('companyId') companyId: string | null, @Param('missionId') missionId: string) {
    return this.planning.suggestAssignment(this.tenant(companyId), missionId);
  }

  @Post('planning/suggest-all')
  suggestAll(@CurrentUser('companyId') companyId: string | null) {
    return this.planning.suggestAll(this.tenant(companyId));
  }

  // ----- Agent Stock -----

  @Post('stock/anomalies')
  anomalies(@CurrentUser('companyId') companyId: string | null) {
    return this.stock.detectAnomalies(this.tenant(companyId));
  }

  @Post('stock/ruptures')
  ruptures(@CurrentUser('companyId') companyId: string | null) {
    return this.stock.detectRuptures(this.tenant(companyId));
  }

  // ----- Agent Optimisation -----

  @Post('optimisation/tour')
  tour(@CurrentUser('companyId') companyId: string | null, @Query() query: DateQueryDto) {
    return this.optimisation.optimizeTour(this.tenant(companyId), query.date);
  }

  @Post('optimisation/schedule')
  schedule(@CurrentUser('companyId') companyId: string | null, @Query() query: DateQueryDto) {
    return this.optimisation.suggestSchedule(this.tenant(companyId), query.date);
  }

  // ----- Pré-audit photo -----

  @Post('photo-audit')
  audit(@Body() dto: PhotoUrlDto) {
    return this.photoAudit.auditPhoto(dto.photoUrl);
  }

  @Post('photo-audit/batch')
  auditBatch(@Body() dto: PhotoUrlsDto) {
    return this.photoAudit.auditPhotos(dto.photoUrls);
  }

  // ----- Extraction de reçu -----

  @Post('receipt')
  receipt(@Body() dto: PhotoUrlDto) {
    return this.receipts.extractReceipt(dto.photoUrl);
  }

  @Post('receipt/batch')
  receiptBatch(@Body() dto: PhotoUrlsDto) {
    return this.receipts.extractReceipts(dto.photoUrls);
  }

  // ----- Raccourci vocal universel -----

  @Post('voice-command')
  voiceCommand(@Body() dto: VoiceCommandDto) {
    return this.voice.processVoiceCommand(dto.command, dto.missionId);
  }
}
