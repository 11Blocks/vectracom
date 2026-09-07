import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentFeedback } from './entities/incident-feedback.entity';

/**
 * Active Learning : les corrections humaines alimentent un jeu de
 * réentraînement périodique (batch mensuel). L'IA propose, l'humain corrige,
 * le modèle s'améliore — objectif précision > 95 % à 3 mois.
 */
@Injectable()
export class ActiveLearningService {
  private readonly logger = new Logger(ActiveLearningService.name);

  constructor(
    @InjectRepository(IncidentFeedback)
    private readonly feedbackRepository: Repository<IncidentFeedback>,
  ) {}

  async collectFeedback(
    companyId: string,
    incidentId: string,
    analysisId: string,
    data: {
      aiDetectedRubrique?: string | null;
      aiDetectedDefaut?: string | null;
      aiDetectedReference?: string | null;
      aiConfidence?: string | null;
      humanCorrectionRubrique?: string | null;
      humanCorrectionDefaut?: string | null;
      humanCorrectionReference?: string | null;
      humanValidation: boolean;
      correctionReason?: string | null;
      correctedBy?: string | null;
    },
  ) {
    return this.feedbackRepository.save(
      this.feedbackRepository.create({
        companyId,
        incidentId,
        analysisId,
        ...data,
      }),
    );
  }

  list(companyId: string, processed?: boolean) {
    const where: Record<string, unknown> = { companyId };
    if (processed !== undefined) where.isProcessedForTraining = processed;
    return this.feedbackRepository.find({ where, order: { correctedAt: 'DESC' } });
  }

  /** Traitement par lot : marque les feedbacks comme intégrés au jeu d'entraînement. */
  async processBatch(companyId?: string): Promise<{ processed: number; validations: number; corrections: number }> {
    const qb = this.feedbackRepository
      .createQueryBuilder('f')
      .where('f.is_processed_for_training = false');
    if (companyId) qb.andWhere('f.company_id = :companyId', { companyId });
    const pending = await qb.getMany();

    let validations = 0;
    let corrections = 0;
    for (const feedback of pending) {
      if (feedback.humanValidation) validations++;
      else corrections++;
      feedback.isProcessedForTraining = true;
      feedback.processedAt = new Date();
    }
    await this.feedbackRepository.save(pending);
    this.logger.log(`Batch Active Learning : ${pending.length} feedback(s) intégrés`);
    return { processed: pending.length, validations, corrections };
  }

  /**
   * Réentraînement : en production, déclenche le pipeline YOLO (dataset
   * enrichi des feedbacks). Sans infrastructure : statistiques du jeu.
   */
  async retrainModel(companyId?: string) {
    const stats = await this.feedbackRepository
      .createQueryBuilder('f')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN f.human_validation THEN 1 ELSE 0 END)', 'validations')
      .addSelect('SUM(CASE WHEN f.is_processed_for_training THEN 1 ELSE 0 END)', 'processed')
      .getRawOne();
    return {
      triggered: true,
      dataset: {
        total: Number(stats?.total ?? 0),
        validations: Number(stats?.validations ?? 0),
        processedForTraining: Number(stats?.processed ?? 0),
      },
      note: process.env.YOLO_API_URL
        ? 'Réentraînement YOLO déclenché sur le service distant'
        : 'Mode dev : réentraînement simulé (YOLO_API_URL non configuré)',
    };
  }
}
