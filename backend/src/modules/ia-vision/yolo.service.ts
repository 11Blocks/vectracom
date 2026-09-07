import { Injectable, Logger } from '@nestjs/common';

export interface YoloDetection {
  label: string;
  confidence: number;
  box: [number, number, number, number];
}

/**
 * Détection rapide des objets (PBO, poteau, câble, chambre) via YOLOv8.
 * En production : service d'inférence ONNX distant (YOLO_API_URL). Sans
 * configuration : mode détection heuristique déterministe (tests/dev) fondé
 * sur l'URL de l'image et l'annotation.
 */
@Injectable()
export class YoloService {
  private readonly logger = new Logger(YoloService.name);

  async processYolo(imageUrl: string, annotation?: string): Promise<YoloDetection[]> {
    const apiUrl = process.env.YOLO_API_URL;
    if (apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
        });
        const data = (await response.json()) as { detections?: YoloDetection[] };
        return data.detections ?? [];
      } catch (err) {
        this.logger.warn(`YOLO distant injoignable, repli heuristique : ${err instanceof Error ? err.message : err}`);
      }
    }
    return this.heuristicDetections(imageUrl, annotation);
  }

  /** Heuristique déterministe : mots-clés de l'URL et de l'annotation. */
  private heuristicDetections(imageUrl: string, annotation?: string): YoloDetection[] {
    const haystack = `${imageUrl} ${annotation ?? ''}`.toLowerCase();
    const detections: YoloDetection[] = [];
    const push = (label: string, confidence: number) =>
      detections.push({ label, confidence, box: [0.1, 0.1, 0.8, 0.8] });

    if (haystack.includes('pbo')) push('PBO', 0.92);
    if (haystack.includes('poteau')) push('POTEAU', 0.88);
    if (haystack.includes('cable') || haystack.includes('câble')) push('CABLE', 0.85);
    if (haystack.includes('chambre') || haystack.includes('bpe')) push('CHAMBRE', 0.87);
    if (haystack.includes('conduite')) push('CONDUITE', 0.8);
    if (detections.length === 0) push('OBJET_INCONNU', 0.4);
    return detections;
  }
}
