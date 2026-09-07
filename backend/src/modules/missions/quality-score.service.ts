import { Injectable } from '@nestjs/common';
import { MissionFieldReport } from './entities/field-report.entity';

export interface QualityScoreResult {
  score: number;
  details: {
    photos: number;
    photosMax: number;
    dbm: number;
    dbmMax: number;
    materiel: number;
    materielMax: number;
    signatures: number;
    signaturesMax: number;
  };
}

/**
 * Score qualité (0-100) calculé à la clôture :
 * - Complétude des photos ........ 40 pts (4 × 10)
 * - dBm dans la norme (>= -25) ... 20 pts (hors norme : 5, absent : 0)
 * - Matériel renseigné ........... 20 pts
 * - Signatures ................... 20 pts (technicien 10 + client 10)
 */
@Injectable()
export class QualityScoreService {
  compute(report: MissionFieldReport): QualityScoreResult {
    const photoFields = [
      report.photoSiteUrl,
      report.photoPboInteriorUrl,
      report.photoPboClosedUrl,
      report.photoPtoModemUrl,
    ];
    const photos = photoFields.filter(Boolean).length * 10;

    let dbm = 0;
    if (report.dbmMeasurement !== null && report.dbmMeasurement !== undefined) {
      dbm = report.dbmOutOfNorm ? 5 : 20;
    }

    const materiel =
      report.materialsConsumed && report.materialsConsumed.length > 0 ? 20 : 0;

    const signatures =
      (report.signatureTechnicianUrl ? 10 : 0) + (report.signatureClientUrl ? 10 : 0);

    const details = {
      photos,
      photosMax: 40,
      dbm,
      dbmMax: 20,
      materiel,
      materielMax: 20,
      signatures,
      signaturesMax: 20,
    };
    const score = photos + dbm + materiel + signatures;
    return { score, details };
  }
}
