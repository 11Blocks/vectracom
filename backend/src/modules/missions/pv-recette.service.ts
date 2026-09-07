import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PdfGeneratorService } from '../../common/pdf/pdf-generator.service';
import { Mission } from './entities/mission.entity';
import { MissionFieldReport } from './entities/field-report.entity';
import { Company } from '../auth/entities/company.entity';

/**
 * PV de recette — PDF au format attendu par SONATEL (mission clôturée).
 */
@Injectable()
export class PvRecetteService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionFieldReport)
    private readonly reportRepository: Repository<MissionFieldReport>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly pdf: PdfGeneratorService,
  ) {}

  async generate(companyId: string, missionId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');

    const report = await this.reportRepository.findOne({ where: { missionId: mission.id } });
    if (!report || !report.fieldStatus) {
      throw new BadRequestException('PV de recette : le rapport terrain doit être clôturé (étape 6)');
    }

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    const ref = mission.sonatelDossierNumber ?? mission.id.slice(0, 8).toUpperCase();

    const lines: Array<{ text: string; size?: number; bold?: boolean; spaceBefore?: number }> = [
      { text: (company?.name ?? 'VECTRACOM').toUpperCase(), size: 18, bold: true },
      { text: 'Procès-Verbal de Recette', size: 14, bold: true, spaceBefore: 6 },
      { text: `Reference mission : ${ref}`, spaceBefore: 10 },
      { text: `Edite le ${new Date().toLocaleDateString('fr-FR')} par VECTRACOM`, size: 9 },
      { text: '1. Mission', size: 12, bold: true, spaceBefore: 14 },
      { text: `Type : ${mission.typeTache}` },
      { text: `Site client : ${mission.clientSite}` },
      { text: `Zone : ${mission.zone ?? '-'}` },
      { text: `OLT : ${mission.sonatelOlt ?? '-'}    Produit : ${mission.sonatelProduit ?? '-'}` },
      { text: `Date mission : ${new Date(mission.dateMission).toLocaleDateString('fr-FR')}` },
      { text: `Statut : ${mission.status}` },
      { text: '2. Execution technique', size: 12, bold: true, spaceBefore: 12 },
      { text: `Etat initial : ${report.initialEquipmentState ?? '-'}` },
      { text: `Action realisee : ${report.actionRealized ?? '-'}` },
      {
        text: `Mesure dBm : ${report.dbmMeasurement ?? '-'} dBm ${report.dbmOutOfNorm ? '(HORS NORME)' : '(conforme)'}`,
      },
      { text: `GPS : ${report.gpsLatitude ?? '-'}, ${report.gpsLongitude ?? '-'}` },
      { text: '3. Preuves visuelles', size: 12, bold: true, spaceBefore: 12 },
      { text: `Photo site : ${report.photoSiteUrl ? 'fournie' : 'manquante'}` },
      { text: `Photo interieur PBO : ${report.photoPboInteriorUrl ? 'fournie' : 'manquante'}` },
      { text: `Photo PBO ferme : ${report.photoPboClosedUrl ? 'fournie' : 'manquante'}` },
      { text: `Photo PTO/modem : ${report.photoPtoModemUrl ? 'fournie' : 'manquante'}` },
      { text: '4. Materiel consomme', size: 12, bold: true, spaceBefore: 12 },
      ...(report.materialsConsumed && report.materialsConsumed.length > 0
        ? report.materialsConsumed.map<Array<{ text: string }>>((m) => [
            { text: `Item ${m.itemNumber ?? '-'} ${m.designation ?? ''} x${m.quantity}` },
          ]).flat()
        : [{ text: 'Aucun materiel consomme' }]),
      { text: '5. Cloture', size: 12, bold: true, spaceBefore: 12 },
      { text: `Statut terrain : ${report.fieldStatus}${report.failureReason ? ` (${report.failureReason})` : ''}` },
      { text: `Score qualite : ${report.qualityScore ?? '-'} / 100` },
      { text: `Duree : ${report.dureeMinutes ?? '-'} min` },
      { text: `Validation interne : ${report.internalValidationStatus}` },
      { text: `Approbation SONATEL : ${report.sonatelApprovalStatus}` },
      { text: `Recette : ${report.recetteStatus}` },
      { text: '6. Signatures', size: 12, bold: true, spaceBefore: 12 },
      { text: `Signature technicien : ${report.signatureTechnicianUrl ? 'collectee' : 'manquante'}` },
      { text: `Signature client : ${report.signatureClientUrl ? 'collectee' : 'manquante'}` },
      { text: 'Observations :', bold: true, spaceBefore: 10 },
      { text: report.observations ?? '-' },
    ];

    const buffer = this.pdf.generate(lines);
    // Convention terrain ONECOMIT : ND_TYPE_CLIENT.pdf (ex. 339517296_SAV-Adja Aida Mbengue Faye.pdf)
    const nd = mission.contactClient?.match(/\d{9}/)?.[0] ?? ref;
    const clientSlug = (mission.clientSite ?? 'client')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .replace(/ /g, '-')
      .slice(0, 40);
    return { buffer, fileName: `${nd}_${mission.typeTache}_${clientSlug}.pdf` };
  }

  async attachUrl(companyId: string, missionId: string, url: string) {
    await this.reportRepository.update({ missionId, companyId }, { pvRecettePdfUrl: url });
  }
}
