import { Injectable } from '@nestjs/common';

export interface ReceiptExtraction {
  photoUrl: string;
  amount: number | null;
  currency: string;
  date: string | null;
  category: string;
  confidence: number;
  requiresHumanValidation: boolean;
}

const CATEGORY_KEYWORDS: Array<[string, string]> = [
  ['carburant', 'transport'],
  ['essence', 'transport'],
  ['gasoil', 'transport'],
  ['petrol', 'transport'],
  ['taxi', 'transport'],
  ['outil', 'materiel'],
  ['outillage', 'materiel'],
  ['quincaillerie', 'materiel'],
  ['gaine', 'materiel'],
  ['cable', 'materiel'],
  ['câble', 'materiel'],
  ['salaire', 'main_oeuvre'],
  ['paie', 'main_oeuvre'],
  ['perdiem', 'main_oeuvre'],
  ['restaurant', 'divers'],
  ['cafe', 'divers'],
  ['bureau', 'divers'],
];

/**
 * Extraction de reçu : lit la photo et PROPOSE montant/catégorie — la dépense
 * en 5 secondes reste validée par l'utilisateur (jamais imposée).
 * Déterministe en dev (mots-clés + montant du nom de fichier).
 */
@Injectable()
export class ReceiptExtractionService {
  async extractReceipt(photoUrl: string): Promise<ReceiptExtraction> {
    const name = decodeURIComponent(photoUrl.split('/').pop() ?? '');
    const lower = name.toLowerCase();

    // Montant : premier nombre ≥ 3 chiffres du nom (ex. carburant-32000.jpg).
    const amountMatch = lower.match(/(\d{3,})/);
    const amount = amountMatch ? Number(amountMatch[1]) : null;

    const category = CATEGORY_KEYWORDS.find(([kw]) => lower.includes(kw))?.[1] ?? 'divers';

    const dateMatch = lower.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

    return {
      photoUrl,
      amount,
      currency: 'FCFA',
      date,
      category,
      confidence: amount !== null && category !== 'divers' ? 0.92 : 0.6,
      requiresHumanValidation: true,
    };
  }

  async extractReceipts(photoUrls: string[]): Promise<ReceiptExtraction[]> {
    return Promise.all(photoUrls.map((url) => this.extractReceipt(url)));
  }
}
