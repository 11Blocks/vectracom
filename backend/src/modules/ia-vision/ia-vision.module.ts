import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IaVisionController } from './ia-vision.controller';
import { IaVisionService } from './ia-vision.service';
import { YoloService } from './yolo.service';
import { GeminiVisionService } from './gemini-vision.service';
import { ActiveLearningService } from './active-learning.service';
import { IncidentAiAnalysis } from './entities/incident-ai-analysis.entity';
import { IncidentFeedback } from './entities/incident-feedback.entity';
import { VisionUpload } from './entities/vision-upload.entity';
import { VisionUploadService } from './vision-upload.service';
import { IncidentsModule } from '../incidents/incidents.module';

@Module({
  imports: [TypeOrmModule.forFeature([IncidentAiAnalysis, IncidentFeedback, VisionUpload]), IncidentsModule],
  controllers: [IaVisionController],
  providers: [IaVisionService, YoloService, GeminiVisionService, ActiveLearningService, VisionUploadService],
  exports: [IaVisionService, ActiveLearningService],
})
export class IaVisionModule {}
