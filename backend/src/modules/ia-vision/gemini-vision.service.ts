import { Injectable, Logger } from '@nestjs/common';
import type { YoloDetection } from './yolo.service';

export interface GeminiInterpretation {
  rubrique: 'PBO' | 'PIO' | 'CHAMBRE' | null;
  pboReference: string | null;
  pboDefaut: string | null;
  pioType: string | null;
  pioEtat: string | null;
  chambreType: string | null;
  chambreEtat: string | null;
  clientsImpacted: number | null;
  gps: { latitude: number; longitude: number } | null;
  confidence: number;
}

const PBO_DEFAUT_KEYWORDS = ['DESORGANISE', 'SANS_COUVERCLE', 'ENDOMAGE', 'CABLE_DESORDRE'];
const PIO_ETAT_KEYWORDS = ['A_TERRE', 'INCLINE', 'CASSE', 'DEBOUT'];
const CHAMBRE_ETAT_KEYWORDS = ['BOUCHEE', 'ENDOMAGEE', 'INONDEE', 'ACCESSIBLE'];

/**
 * Analyse contextuelle (OCR, interprétation) via Gemini 2.0 Flash.
 * En production : appel API réel (GEMINI_API_KEY). Sans clé : interprétation
 * déterministe des détections YOLO + de l'annotation (regex) pour dev/tests.
 */
@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);

  async processGemini(
    imageUrl: string,
    yoloResults: YoloDetection[],
    annotation?: string,
  ): Promise<GeminiInterpretation> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        return await this.callGemini(imageUrl, yoloResults, annotation, apiKey);
      } catch (err) {
        this.logger.warn(`Gemini injoignable, repli heuristique : ${err instanceof Error ? err.message : err}`);
      }
    }
    return this.deterministicInterpretation(yoloResults, annotation);
  }

  private async callGemini(
    imageUrl: string,
    yoloResults: YoloDetection[],
    annotation: string | undefined,
    apiKey: string,
  ): Promise<GeminiInterpretation> {
    const prompt = `Analyse cette photo d'incident réseau télécom (détections YOLO : ${JSON.stringify(yoloResults)}).
Annotation : "${annotation ?? ''}".
Retourne un JSON : { rubrique: PBO|PIO|CHAMBRE|null, pboReference, pboDefaut (DESORGANISE|SANS_COUVERCLE|ENDOMAGE|CABLE_DESORDRE),
pioType, pioEtat (DEBOUT|INCLINE|A_TERRE|CASSE), chambreType, chambreEtat (ACCESSIBLE|BOUCHEE|ENDOMAGEE|INONDEE),
clientsImpacted: number, gps: {latitude, longitude}|null, confidence: 0..1 }`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { file_data: { file_uri: imageUrl } }] }],
        }),
      },
    );
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')) as GeminiInterpretation;
  }

  /** Interprétation déterministe : YOLO + regex sur l'annotation. */
  private deterministicInterpretation(yolo: YoloDetection[], annotation?: string): GeminiInterpretation {
    const text = (annotation ?? '').toUpperCase();
    const labels = yolo.map((d) => d.label);
    const bestConfidence = Math.max(...yolo.map((d) => d.confidence));

    let rubrique: GeminiInterpretation['rubrique'] = null;
    if (labels.includes('PBO')) rubrique = 'PBO';
    else if (labels.includes('POTEAU') || labels.includes('CABLE')) rubrique = 'PIO';
    else if (labels.includes('CHAMBRE')) rubrique = 'CHAMBRE';
    if (!rubrique && text.includes('PBO')) rubrique = 'PBO';
    if (!rubrique && (text.includes('POTEAU') || text.includes('CABLE'))) rubrique = 'PIO';
    if (!rubrique && text.includes('CHAMBRE')) rubrique = 'CHAMBRE';

    // Référence PBO : B08/D1-4-7, A12/S3-2…
    const refMatch = text.match(/\b([A-Z]\d{2}\/[A-Z0-9\-]+)\b/);
    const defaut = PBO_DEFAUT_KEYWORDS.find((k) => text.includes(k)) ?? null;
    const pioEtat = PIO_ETAT_KEYWORDS.find((k) => text.includes(k)) ?? null;
    const chambreEtat = CHAMBRE_ETAT_KEYWORDS.find((k) => text.includes(k)) ?? null;
    const typeMatch = text.match(/\b(POTEAU_SIMPLE|POTEAU_MOISE|ACCESSOIRE)\b/);
    const chambreTypeMatch = text.match(/\b(L[2356]T)\b/);
    const clientsMatch = text.match(/(\d+)\s*CLIENTS?/);
    const gpsMatch = text.match(/(\d{1,2}\.\d+)[ ,;]+(-?\d{1,3}\.\d+)/);

    return {
      rubrique,
      pboReference: rubrique === 'PBO' ? refMatch?.[1] ?? null : null,
      pboDefaut: rubrique === 'PBO' ? defaut : null,
      pioType: rubrique === 'PIO' ? typeMatch?.[1] ?? 'POTEAU_SIMPLE' : null,
      pioEtat: rubrique === 'PIO' ? pioEtat : null,
      chambreType: rubrique === 'CHAMBRE' ? chambreTypeMatch?.[1] ?? null : null,
      chambreEtat: rubrique === 'CHAMBRE' ? chambreEtat : null,
      clientsImpacted: clientsMatch ? Number(clientsMatch[1]) : null,
      gps: gpsMatch
        ? { latitude: Number(gpsMatch[1]), longitude: Number(gpsMatch[2]) }
        : null,
      confidence: rubrique ? Math.round(bestConfidence * 100) / 100 : 0.3,
    };
  }
}
