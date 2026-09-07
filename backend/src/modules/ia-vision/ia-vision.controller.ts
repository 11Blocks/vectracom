import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IaVisionService } from './ia-vision.service';
import { ActiveLearningService } from './active-learning.service';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { ValidateAnalysisDto } from './dto/validate-analysis.dto';
import { FeedbackQueryDto } from './dto/feedback.dto';
import { VisionUploadService } from './vision-upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

class ListAnalysesQueryDto {
  @IsOptional() @IsString() incidentId?: string;
  @IsOptional() @IsBooleanString() pending?: string;
}

@Controller('ia-vision')
@Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHEF_EQUIPE)
export class IaVisionController {
  constructor(
    private readonly iaVisionService: IaVisionService,
    private readonly activeLearning: ActiveLearningService,
    private readonly uploads: VisionUploadService,
  ) {}

  /** PHOTO -> YOLO -> Gemini -> proposition (jamais de décision automatique). */
  // ── Pré-audit photo par upload (web) : analyse des octets réels ──

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  upload(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.uploads.audit(companyId, file, userId);
  }

  @Get('uploads')
  listUploads(
    @CurrentUser('companyId') companyId: string | null,
    @Query('verdict') verdict?: string,
  ) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.uploads.list(companyId, verdict);
  }

  @Delete('uploads/:id')
  deleteUpload(@CurrentUser('companyId') companyId: string | null, @Param('id') id: string) {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
    return this.uploads.remove(companyId, id);
  }

  @Post('analyze')
  analyze(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Body() dto: AnalyzeImageDto,
  ) {
    this.requireTenant(companyId);
    return this.iaVisionService.analyzeImage(companyId!, dto, userId);
  }

  @Get('analyses')
  analyses(@CurrentUser('companyId') companyId: string | null, @Query() query: ListAnalysesQueryDto) {
    this.requireTenant(companyId);
    return this.iaVisionService.listAnalyses(companyId!, {
      incidentId: query.incidentId,
      pending: query.pending === 'true',
    });
  }

  /** Validation humaine : l'admin valide, corrige ou rejette la proposition IA. */
  @Put('validate/:analysisId')
  @Roles(UserRole.ADMIN)
  validate(
    @CurrentUser('companyId') companyId: string | null,
    @CurrentUser('id') userId: string,
    @Param('analysisId') analysisId: string,
    @Body() dto: ValidateAnalysisDto,
  ) {
    this.requireTenant(companyId);
    return this.iaVisionService.validate(companyId!, analysisId, dto, userId);
  }

  @Get('feedback')
  feedback(@CurrentUser('companyId') companyId: string | null, @Query() query: FeedbackQueryDto) {
    this.requireTenant(companyId);
    return this.activeLearning.list(
      companyId!,
      query.processed === undefined ? undefined : query.processed === 'true',
    );
  }

  @Post('feedback/process')
  @Roles(UserRole.ADMIN)
  processFeedback(@CurrentUser('companyId') companyId: string | null) {
    this.requireTenant(companyId);
    return this.activeLearning.processBatch(companyId!);
  }

  @Post('retrain')
  @Roles(UserRole.ADMIN)
  retrain() {
    return this.activeLearning.retrainModel();
  }

  private requireTenant(companyId: string | null): void {
    if (!companyId) throw new BadRequestException('Réservé aux comptes rattachés à un tenant');
  }
}
