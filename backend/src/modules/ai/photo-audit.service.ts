import { Injectable } from '@nestjs/common';

export interface PhotoAuditResult {
  photoUrl: string;
  verdict: 'accepte' | 'a_reprendre';
  score: number;
  flags: string[];
  requiresHumanValidation: boolean;
}

/**
 * Pré-audit photo : vérifie netteté et pertinence AVANT validation terrain.
 * Déterministe en dev (mots-clés du nom/URL) ; branchement Gemini possible.
 */
@Injectable()
export class PhotoAuditService {
  async auditPhoto(photoUrl: string): Promise<PhotoAuditResult> {
    const name = decodeURIComponent(photoUrl.split('/').pop() ?? '').toLowerCase();
    const flags: string[] = [];
    let score = 95;

    if (name.includes('flou') || name.includes('blur')) {
      flags.push('nettete_insuffisante');
      score -= 60;
    }
    if (name.includes('sombre') || name.includes('dark') || name.includes('nuit')) {
      flags.push('luminosite_faible');
      score -= 35;
    }
    if (name.includes('tourne') || name.includes('rotated')) {
      flags.push('cadrage_incline');
      score -= 20;
    }
    if (name.includes(' selfie') || name.includes('visage')) {
      flags.push('photo_hors_sujet');
      score -= 50;
    }
    if (photoUrl.startsWith('http://')) {
      flags.push('url_non_securisee');
      score -= 5;
    }
    if (!/\.(jpg|jpeg|png|webp|heic)$/i.test(name)) {
      flags.push('format_inattendu');
      score -= 10;
    }

    return {
      photoUrl,
      verdict: score >= 60 ? 'accepte' : 'a_reprendre',
      score: Math.max(0, score),
      flags,
      requiresHumanValidation: true,
    };
  }

  async auditPhotos(photoUrls: string[]): Promise<PhotoAuditResult[]> {
    return Promise.all(photoUrls.map((url) => this.auditPhoto(url)));
  }
}
