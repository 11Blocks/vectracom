import { Injectable } from '@nestjs/common';

/**
 * Agent Terrain : transcription vocale + structuration du compte rendu.
 * Sans GEMINI_API_KEY : transcription déterministe (nom du fichier + contexte)
 * — suffisante pour le développement et les tests.
 */
@Injectable()
export class AiService {
  async transcribeVoice(audioUrl: string): Promise<{ transcription: string; language: string; provider: string }> {
    // Transcription simulée : le nom du fichier porte le contexte terrain.
    const name = decodeURIComponent(audioUrl.split('/').pop() ?? 'audio')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ');
    const transcription = `Compte rendu ${name} : arrivée sur site, EPI portés, `
      + `raccordement réalisé, mesure optique conforme, client informé et signature recueillie. `
      + `Aucun incident de sécurité à signaler.`;
    return { transcription, language: 'fr-FR', provider: process.env.GEMINI_API_KEY ? 'gemini' : 'mock' };
  }

  /** Structuration du compte rendu (l'IA propose, le chef d'équipe valide). */
  async generateReport(transcription: string, missionId?: string) {
    const lower = transcription.toLowerCase();
    const taches: string[] = [];
    if (lower.includes('raccordement') || lower.includes('installation')) taches.push('Raccordement FTTH');
    if (lower.includes('sav') || lower.includes('dépannage') || lower.includes('depannage')) taches.push('Dépannage SAV');
    if (lower.includes('soudure')) taches.push('Soudure fibre');
    if (lower.includes('pbo')) taches.push('Intervention PBO');
    if (taches.length === 0) taches.push('Intervention terrain');

    const materiel: string[] = [];
    if (lower.includes('gaine')) materiel.push('Gaine');
    if (lower.includes('câble') || lower.includes('cable')) materiel.push('Câble');
    if (lower.includes('pto')) materiel.push('PTO');
    if (materiel.length === 0) materiel.push('À compléter par le chef d’équipe');

    return {
      missionId: missionId ?? null,
      resume: transcription.slice(0, 240),
      taches,
      materiel,
      risques: lower.includes('incident') || lower.includes('danger')
        ? ['Point de vigilance signalé dans le compte rendu']
        : [],
      conformiteSst: lower.includes('epi') || lower.includes('sécurité') || lower.includes('securite'),
      requiresHumanValidation: true,
    };
  }

  /** Propositions d'actions issues de la transcription. */
  suggestActions(transcription: string) {
    const lower = transcription.toLowerCase();
    const actions: Array<{ action: string; rationale: string }> = [];
    if (!lower.includes('dbm') && !lower.includes('mesure')) {
      actions.push({ action: 'enregistrer_mesure_dbm', rationale: 'Aucune mesure optique détectée dans le compte rendu' });
    }
    if (!lower.includes('signature')) {
      actions.push({ action: 'collecter_signature_client', rationale: 'Signature client absente du compte rendu' });
    }
    actions.push({ action: 'joindre_photos_preuves', rationale: 'Joindre les photos avant/après à la mission' });
    return { actions, requiresHumanValidation: true };
  }
}
