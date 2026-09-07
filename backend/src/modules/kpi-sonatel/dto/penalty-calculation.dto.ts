/** Calcul des pénalités d'une période et application à la facture. */
export class PenaltyCalculationDto {
  period!: string;
  penalties!: Array<{
    kpiName: string;
    target: number;
    actual: number;
    penaltyAmount: number;
  }>;
  total!: number;
}
