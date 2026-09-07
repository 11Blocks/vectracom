import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MissionFieldReport } from './entities/field-report.entity';
import { Mission } from './entities/mission.entity';
import { QualityScoreService } from './quality-score.service';
import { Step1SstDto } from './dto/field-report-step1-sst.dto';
import { Step2IdentificationDto } from './dto/field-report-step2-identification.dto';
import { Step3TechniqueDto } from './dto/field-report-step3-technique.dto';
import { Step4PhotosDto } from './dto/field-report-step4-photos.dto';
import { Step5MaterielDto } from './dto/field-report-step5-materiel.dto';
import { Step5EchangeSavDto } from './dto/field-report-step5-echange-sav.dto';
import { Step6ClotureDto } from './dto/field-report-step6-cloture.dto';
import { FieldReportDataDto } from './dto/field-report-data.dto';
import { GeolocationService } from '../geolocation/geolocation.service';

/** Seuil d'alerte dBm du cahier des charges : -25 dBm. */
const DBM_ALERT_THRESHOLD = -25;

/**
 * Sauvegarde des étapes du rapport terrain.
 * Côté mobile chaque étape est écrite en local (offline-first) puis synchronisée
 * ici ; le SST est bloquant : aucune étape 2-6 n'est acceptée avant lui.
 * L'étape 2 (GPS site) alimente aussi geopositions (source mission_check) si licence GEOLOCATION.
 */
@Injectable()
export class FieldReportService {
  constructor(
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    private readonly qualityScore: QualityScoreService,
    private readonly geolocationService: GeolocationService,
  ) {}

  async getOrCreate(companyId: string, missionId: string): Promise<MissionFieldReport> {
    const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');

    let report = await this.reportRepository.findOne({ where: { missionId } });
    if (!report) {
      report = this.reportRepository.create({
        companyId,
        missionId,
        missionType: mission.typeTache,
      });
      report = await this.reportRepository.save(report);
    }
    return report;
  }

  async saveStep(companyId: string, missionId: string, stepId: string, dto: unknown) {
    const report = await this.getOrCreate(companyId, missionId);

    switch (stepId) {
      case '1':
        return this.saveStep1(report, dto as Step1SstDto);
      case '2':
        return this.saveStep2(companyId, report, dto as Step2IdentificationDto);
      case '3':
        return this.saveStep3(report, dto as Step3TechniqueDto);
      case '4':
        return this.saveStep4(report, dto as Step4PhotosDto);
      case '5':
        return this.saveStep5(report, dto as Step5MaterielDto & Step5EchangeSavDto);
      case '6':
        return this.saveStep6(companyId, report, dto as Step6ClotureDto);
      case 'data':
        return this.saveData(companyId, report, dto as FieldReportDataDto);
      default:
        throw new BadRequestException('Étape inconnue (1-6 ou "data")');
    }
  }

  // ----- Étape 1 : SST bloquante -----
  private async saveStep1(report: MissionFieldReport, dto: Step1SstDto) {
    const missingEpi = Object.entries(dto.sstChecklist ?? {})
      .filter(([, ok]) => !ok)
      .map(([item]) => item);
    if (missingEpi.length > 0) {
      throw new BadRequestException(
        `Sécurité SST bloquante — EPI non validés : ${missingEpi.join(', ')}`,
      );
    }
    report.sstChecklist = dto.sstChecklist;
    report.sstPhotoUrl = dto.sstPhotoUrl ?? null;
    report.sstValidatedAt = new Date();
    return this.reportRepository.save(report);
  }

  private assertSstValidated(report: MissionFieldReport) {
    if (!report.sstValidatedAt) {
      throw new BadRequestException(
        'Étape 1 (Sécurité SST) non validée — le formulaire est verrouillé',
      );
    }
  }

  private async saveStep2(companyId: string, report: MissionFieldReport, dto: Step2IdentificationDto) {
    this.assertSstValidated(report);
    report.interventionType = dto.interventionType ?? report.interventionType;
    report.equipmentCode = dto.equipmentCode ?? report.equipmentCode;
    if (dto.gpsLatitude !== undefined) report.gpsLatitude = String(dto.gpsLatitude);
    if (dto.gpsLongitude !== undefined) report.gpsLongitude = String(dto.gpsLongitude);
    report.identificationAt = new Date();
    const saved = await this.reportRepository.save(report);

    const lat = dto.gpsLatitude ?? (report.gpsLatitude != null ? Number(report.gpsLatitude) : NaN);
    const lon = dto.gpsLongitude ?? (report.gpsLongitude != null ? Number(report.gpsLongitude) : NaN);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      await this.syncGeoposition(companyId, report.missionId, lat, lon);
    }
    return saved;
  }

  private async saveStep3(report: MissionFieldReport, dto: Step3TechniqueDto) {
    this.assertSstValidated(report);
    report.initialEquipmentState = dto.initialEquipmentState ?? report.initialEquipmentState;
    report.actionRealized = dto.actionRealized ?? report.actionRealized;
    if (dto.dbmMeasurement !== undefined) {
      report.dbmMeasurement = String(dto.dbmMeasurement);
      report.dbmOutOfNorm = dto.dbmMeasurement < DBM_ALERT_THRESHOLD;
    }
    report.techniqueAt = new Date();
    return this.reportRepository.save(report);
  }

  private async saveStep4(report: MissionFieldReport, dto: Step4PhotosDto) {
    this.assertSstValidated(report);
    report.photoSiteUrl = dto.photoSiteUrl ?? report.photoSiteUrl;
    report.photoPboInteriorUrl = dto.photoPboInteriorUrl ?? report.photoPboInteriorUrl;
    report.photoPboClosedUrl = dto.photoPboClosedUrl ?? report.photoPboClosedUrl;
    report.photoPtoModemUrl = dto.photoPtoModemUrl ?? report.photoPtoModemUrl;
    report.photosAt = new Date();
    return this.reportRepository.save(report);
  }

  private async saveStep5(
    report: MissionFieldReport,
    dto: Step5MaterielDto & Step5EchangeSavDto,
  ) {
    this.assertSstValidated(report);
    if (dto.materialsConsumed !== undefined) {
      report.materialsConsumed = dto.materialsConsumed;
    }
    if (dto.exchangeOldSerialId !== undefined) report.exchangeOldSerialId = dto.exchangeOldSerialId;
    if (dto.exchangeNewSerialId !== undefined) report.exchangeNewSerialId = dto.exchangeNewSerialId;
    report.materielAt = new Date();
    return this.reportRepository.save(report);
  }

  // ----- Étape 6 : clôture + score qualité + statut mission -----
  private async saveStep6(companyId: string, report: MissionFieldReport, dto: Step6ClotureDto) {
    this.assertSstValidated(report);
    if (dto.fieldStatus === 'echec' && !dto.failureReason) {
      throw new BadRequestException('Motif d\'échec obligatoire quand fieldStatus = echec');
    }
    report.fieldStatus = dto.fieldStatus as MissionFieldReport['fieldStatus'];
    report.failureReason = dto.failureReason ?? null;
    report.observations = dto.observations ?? null;
    report.signatureTechnicianUrl = dto.signatureTechnicianUrl ?? null;
    report.signatureClientUrl = dto.signatureClientUrl ?? null;
    report.savAction = dto.savAction ?? null;
    report.savOutcome = dto.savOutcome ?? null;

    const mission = await this.missionRepository.findOne({ where: { id: report.missionId } });
    if (mission) {
      await this.missionRepository.update(
        { id: mission.id },
        { nbsi: (mission.nbsi ?? 0) + 1, codeOperation: mission.codeOperation },
      );
    }

    const result = this.qualityScore.compute(report);
    report.qualityScore = String(result.score);

    report.dureeMinutes = Math.max(
      1,
      Math.round((Date.now() - new Date(report.createdAt).getTime()) / 60000),
    );

    await this.reportRepository.save(report);
    await this.missionRepository.update(
      { companyId, id: report.missionId },
      { status: 'terminee' },
    );
    return this.reportRepository.findOne({ where: { id: report.id } });
  }

  private async saveData(companyId: string, report: MissionFieldReport, dto: FieldReportDataDto) {
    this.assertSstValidated(report);
    report.data = { ...report.data, ...dto.data };
    if (dto.priceItemsUsed !== undefined) {
      report.priceItemsUsed = dto.priceItemsUsed;
    }

    const coords = extractGpsFromTemplateData(dto.data);
    if (coords) {
      if (report.gpsLatitude == null) report.gpsLatitude = String(coords.lat);
      if (report.gpsLongitude == null) report.gpsLongitude = String(coords.lon);
    }

    const saved = await this.reportRepository.save(report);
    if (coords) {
      await this.syncGeoposition(companyId, report.missionId, coords.lat, coords.lon);
    }
    return saved;
  }

  /**
   * Alimente geopositions pour la carte live (ne bloque pas le rapport si licence absente).
   */
  private async syncGeoposition(companyId: string, missionId: string, latitude: number, longitude: number) {
    try {
      const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
      const technicianId = mission?.technicianIds?.[0];
      if (!technicianId) return;
      await this.geolocationService.record(companyId, {
        technicianId,
        latitude,
        longitude,
        missionId,
        source: 'mission_check',
      });
    } catch {
      // licence GEOLOCATION absente / technicien invalide — silencieux
    }
  }

  // ----- Double validation -----

  async validateInternal(companyId: string, missionId: string, status: 'validee' | 'rejetee') {
    const report = await this.getOrCreate(companyId, missionId);
    if (!report.fieldStatus) {
      throw new BadRequestException('Le rapport terrain doit être clôturé avant validation');
    }
    report.internalValidationStatus = status;
    await this.reportRepository.save(report);
    await this.missionRepository.update(
      { companyId, id: missionId },
      { status: status === 'validee' ? 'validee' : 'rejetee' },
    );
    return this.reportRepository.findOne({ where: { id: report.id } });
  }

  async sonatelApprove(companyId: string, missionId: string, status: 'approuve' | 'rejete') {
    const report = await this.getOrCreate(companyId, missionId);
    if (report.internalValidationStatus !== 'validee') {
      throw new BadRequestException(
        'Approbation SONATEL impossible : validation interne requise au préalable',
      );
    }
    report.sonatelApprovalStatus = status;
    if (status === 'approuve') {
      report.recetteStatus = 'acceptee';
    }
    await this.reportRepository.save(report);
    return this.reportRepository.findOne({ where: { id: report.id } });
  }
}

/** Extrait lat/lng depuis les réponses template mobile (clés gps / gpsLatitude…). */
function extractGpsFromTemplateData(data: Record<string, unknown> | undefined): { lat: number; lon: number } | null {
  if (!data || typeof data !== 'object') return null;
  const latRaw =
    data.gpsLatitude ?? data.latitude ?? data.gps_lat ?? data.lat;
  const lonRaw =
    data.gpsLongitude ?? data.longitude ?? data.gps_lng ?? data.lng ?? data.lon;

  let lat = typeof latRaw === 'number' ? latRaw : typeof latRaw === 'string' ? Number(latRaw) : NaN;
  let lon = typeof lonRaw === 'number' ? lonRaw : typeof lonRaw === 'string' ? Number(lonRaw) : NaN;

  // Champ texte unique "gps" / "GPS" : "14.69, -17.44"
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && typeof data.gps === 'string') {
    const parts = data.gps.split(/[,;\s]+/).map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
    if (parts.length >= 2) {
      lat = parts[0];
      lon = parts[1];
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
