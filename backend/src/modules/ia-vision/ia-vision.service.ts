import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentAiAnalysis } from './entities/incident-ai-analysis.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { YoloService } from './yolo.service';
import { GeminiVisionService } from './gemini-vision.service';
import { ActiveLearningService } from './active-learning.service';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { severityFromClients } from '../incidents/incidents.service';

/** Type de mission suggéré selon la rubrique détectée. */
const RUBRIQUE_TO_MISSION: Record<string, string> = {
  PBO: 'SAV',
  PIO: 'PLANTATION',
  CHAMBRE: 'GC',
};

/**
 * Pipeline IA Vision : PHOTO -> YOLO (détection) -> Gemini (interprétation)
 * -> classification -> corrélation -> proposition. L'IA propose, l'humain
 * décide (validation dans le contrôleur).
 */
@Injectable()
export class IaVisionService {
  private readonly logger = new Logger(IaVisionService.name);

  constructor(
    @InjectRepository(IncidentAiAnalysis)
    private readonly analysisRepository: Repository<IncidentAiAnalysis>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
    private readonly yolo: YoloService,
    private readonly gemini: GeminiVisionService,
    private readonly activeLearning: ActiveLearningService,
  ) {}

  async analyzeImage(companyId: string, dto: AnalyzeImageDto, reportedBy: string | null) {
    // 1. YOLO : détection rapide
    const yoloResults = await this.yolo.processYolo(dto.imageUrl, dto.annotation);

    // 2. Gemini : analyse contextuelle (OCR + interprétation)
    const gemini = await this.gemini.processGemini(dto.imageUrl, yoloResults, dto.annotation);

    // 3. Classification PBO / PIO / Chambre
    const rubrique = this.classify(gemini.rubrique, yoloResults);
    const clients = gemini.clientsImpacted ?? 0;
    const suggestedSeverity = severityFromClients(clients);

    // 4. Incident rattaché : existant (dto.incidentId) ou créé au statut signalement
    let incident: Incident;
    if (dto.incidentId) {
      const existing = await this.incidentRepository.findOne({ where: { companyId, id: dto.incidentId } });
      if (!existing) throw new NotFoundException('Incident à compléter introuvable');
      incident = existing;
    } else {
      const count = await this.incidentRepository.count({ where: { companyId } });
      const year = new Date().getUTCFullYear();
      incident = await this.incidentRepository.save(
        this.incidentRepository.create({
          companyId,
          incidentNumber: `INC-${year}-${String(count + 1).padStart(4, '0')}`,
          source: 'WHATSAPP',
          reportedBy,
          rubrique: (rubrique ?? 'PBO') as Incident['rubrique'],
          zone: 'à qualifier',
          annotationOriginale: dto.annotation ?? null,
          photos: [{ type: 'signalement', url: dto.imageUrl }],
          status: 'signalement',
          severity: suggestedSeverity,
        }),
      );
    }

    // 5. Corrélation avec un incident ouvert existant
    const matched = await this.correlate(companyId, rubrique, gemini.pboReference);

    const analysis = await this.analysisRepository.save(
      this.analysisRepository.create({
        companyId,
        incidentId: incident.id,
        rubriqueDetected: rubrique,
        pboReferenceDetected: gemini.pboReference,
        pboDefautDetected: gemini.pboDefaut,
        pioTypeDetected: gemini.pioType,
        pioEtatDetected: gemini.pioEtat,
        chambreTypeDetected: gemini.chambreType,
        chambreEtatDetected: gemini.chambreEtat,
        annotationExtracted: dto.annotation ?? null,
        annotationParsed: {
          reference: gemini.pboReference,
          defaut: gemini.pboDefaut,
          clients: gemini.clientsImpacted,
        },
        gpsExtracted: gemini.gps
          ? { latitude: gemini.gps.latitude, longitude: gemini.gps.longitude }
          : dto.gpsLatitude !== undefined
            ? { latitude: dto.gpsLatitude, longitude: dto.gpsLongitude ?? 0 }
            : null,
        confidenceRubrique: String(Math.round(gemini.confidence * 100)),
        confidencePbo: rubrique === 'PBO' ? String(Math.round(gemini.confidence * 100)) : null,
        confidencePio: rubrique === 'PIO' ? String(Math.round(gemini.confidence * 100)) : null,
        confidenceChambre: rubrique === 'CHAMBRE' ? String(Math.round(gemini.confidence * 100)) : null,
        matchedIncidentId: matched?.id ?? null,
        matchingConfidence: matched ? '80' : null,
        suggestedMissionType: rubrique ? RUBRIQUE_TO_MISSION[rubrique] ?? 'INFRA' : 'INFRA',
        suggestedSeverity,
      }),
    );

    this.logger.log(
      `Analyse IA ${analysis.id} : rubrique=${rubrique ?? '?'}, confiance=${gemini.confidence}, incident=${incident.incidentNumber}`,
    );
    return { incident, analysis };
  }

  /** Classification : priorité à l'interprétation Gemini, repli sur les objets détectés. */
  classify(rubrique: string | null, yoloResults: Array<{ label: string }>): string | null {
    if (rubrique) return rubrique;
    const labels = yoloResults.map((d) => d.label);
    if (labels.includes('PBO')) return 'PBO';
    if (labels.includes('POTEAU') || labels.includes('CABLE')) return 'PIO';
    if (labels.includes('CHAMBRE')) return 'CHAMBRE';
    return null;
  }

  /**
   * Corrélation : incident ouvert avec même référence PBO — la référence
   * détectée n'est appliquée qu'après validation, donc on cherche aussi dans
   * l'annotation originale des incidents en attente de qualification.
   */
  async correlate(companyId: string, rubrique: string | null, pboReference: string | null): Promise<Incident | null> {
    if (rubrique !== 'PBO' || !pboReference) return null;
    return this.incidentRepository
      .createQueryBuilder('i')
      .where('i.company_id = :companyId AND i.rubrique = :rubrique', { companyId, rubrique })
      .andWhere(
        '(i.pbo_reference = :ref OR i.annotation_originale ILIKE :like)',
        { ref: pboReference, like: `%${pboReference}%` },
      )
      .andWhere("i.status <> 'cloture'")
      .getOne();
  }

  /**
   * Validation humaine : valide (applique la proposition), corrige (applique
   * les corrections + feedback Active Learning) ou rejette (feedback seul).
   */
  async validate(
    companyId: string,
    analysisId: string,
    dto: { validationStatus: string; corrections?: Record<string, string>; correctionNotes?: string },
    validatedBy: string,
  ) {
    const analysis = await this.analysisRepository.findOne({ where: { companyId, id: analysisId } });
    if (!analysis) throw new NotFoundException('Analyse introuvable');
    if (analysis.validationStatus) throw new BadRequestException('Analyse déjà validée');
    const incident = await this.incidentRepository.findOne({ where: { companyId, id: analysis.incidentId } });
    if (!incident) throw new NotFoundException('Incident lié introuvable');

    analysis.validationStatus = dto.validationStatus;
    analysis.validatedBy = validatedBy;
    analysis.validatedAt = new Date();

    if (dto.validationStatus === 'valide') {
      this.applyToIncident(incident, {
        rubrique: analysis.rubriqueDetected ?? undefined,
        pboReference: analysis.pboReferenceDetected ?? undefined,
        pboDefaut: analysis.pboDefautDetected ?? undefined,
        pioType: analysis.pioTypeDetected ?? undefined,
        pioEtat: analysis.pioEtatDetected ?? undefined,
        chambreType: analysis.chambreTypeDetected ?? undefined,
        chambreEtat: analysis.chambreEtatDetected ?? undefined,
        severity: analysis.suggestedSeverity ?? undefined,
      });
      incident.annotationParse = analysis.annotationParsed;
      await this.incidentRepository.save(incident);
      await this.activeLearning.collectFeedback(companyId, incident.id, analysis.id, {
        aiDetectedRubrique: analysis.rubriqueDetected,
        aiDetectedDefaut: analysis.pboDefautDetected,
        aiDetectedReference: analysis.pboReferenceDetected,
        aiConfidence: analysis.confidenceRubrique,
        humanValidation: true,
        correctedBy: validatedBy,
      });
    } else if (dto.validationStatus === 'corrige') {
      if (!dto.corrections || Object.keys(dto.corrections).length === 0) {
        throw new BadRequestException('Corrections requises pour le statut corrige');
      }
      analysis.isCorrected = true;
      analysis.correctionNotes = dto.correctionNotes ?? null;
      this.applyToIncident(incident, dto.corrections);
      if (dto.corrections.severity) incident.severity = dto.corrections.severity as never;
      if (dto.corrections.zone) incident.zone = dto.corrections.zone;
      await this.incidentRepository.save(incident);
      await this.activeLearning.collectFeedback(companyId, incident.id, analysis.id, {
        aiDetectedRubrique: analysis.rubriqueDetected,
        aiDetectedDefaut: analysis.pboDefautDetected,
        aiDetectedReference: analysis.pboReferenceDetected,
        aiConfidence: analysis.confidenceRubrique,
        humanCorrectionRubrique: dto.corrections.rubrique ?? null,
        humanCorrectionDefaut: dto.corrections.pboDefaut ?? null,
        humanCorrectionReference: dto.corrections.pboReference ?? null,
        humanValidation: false,
        correctionReason: dto.correctionNotes ?? null,
        correctedBy: validatedBy,
      });
    } else {
      // rejet : feedback sans modification de l'incident
      await this.activeLearning.collectFeedback(companyId, incident.id, analysis.id, {
        aiDetectedRubrique: analysis.rubriqueDetected,
        aiDetectedDefaut: analysis.pboDefautDetected,
        aiDetectedReference: analysis.pboReferenceDetected,
        aiConfidence: analysis.confidenceRubrique,
        humanValidation: false,
        correctionReason: dto.correctionNotes ?? 'Analyse rejetée',
        correctedBy: validatedBy,
      });
    }

    return { analysis: await this.analysisRepository.save(analysis), incident };
  }

  listAnalyses(companyId: string, filters: { incidentId?: string; pending?: boolean }) {
    const qb = this.analysisRepository
      .createQueryBuilder('a')
      .where('a.company_id = :companyId', { companyId })
      .orderBy('a.createdAt', 'DESC')
      .take(200);
    if (filters.incidentId) qb.andWhere('a.incident_id = :iid', { iid: filters.incidentId });
    if (filters.pending) qb.andWhere('a.validation_status IS NULL');
    return qb.getMany();
  }

  private applyToIncident(incident: Incident, fields: Record<string, string | undefined>) {
    if (fields.rubrique) incident.rubrique = fields.rubrique as never;
    if (fields.pboReference) incident.pboReference = fields.pboReference;
    if (fields.pboDefaut) incident.pboDefaut = fields.pboDefaut as never;
    if (fields.pioType) incident.pioType = fields.pioType as never;
    if (fields.pioEtat) incident.pioEtat = fields.pioEtat as never;
    if (fields.chambreType) incident.chambreType = fields.chambreType as never;
    if (fields.chambreEtat) incident.chambreEtat = fields.chambreEtat as never;
  }
}
