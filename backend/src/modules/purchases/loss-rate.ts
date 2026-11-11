/**
 * Seuil de perte contractuel SONATEL (en %).
 *
 * ⚠️ DÉCISION PROVISOIRE (10/11/2026) : l'alerte se déclenche à partir de
 * 10,0 % inclus (`>=`). Le cas « 10,0 % pile » reste à trancher par Moussa
 * (Green-T) ; avant cette date, la comparaison était stricte (`>`).
 */
export const DEFAULT_LOSS_THRESHOLD_PCT = 10;

export interface LossRate {
  /** Taux de perte en %, arrondi au dixième (0 quand il n'y a aucune entrée). */
  taux: number;
  /** true si des pertes existent alors qu'aucune entrée n'est enregistrée (taux non calculable). */
  sansEntree: boolean;
  /** true si le taux atteint ou dépasse le seuil, ou si `sansEntree` (alerte sanction). */
  depasseSeuil: boolean;
}

/**
 * Taux de perte = pertes / entrées × 100, arrondi au dixième.
 *
 * STK-1 (11/11/2026) : sans aucune entrée, le taux n'est pas calculable et vaut 0,
 * mais des pertes réelles (> 0) déclenchent quand même l'alerte (`sansEntree`).
 * Avant, ce cas passait inaperçu (0 % → pas d'alerte).
 */
export function computeLossRate(
  entrees: number,
  pertes: number,
  seuilPct: number = DEFAULT_LOSS_THRESHOLD_PCT,
): LossRate {
  const taux = entrees > 0 ? Math.round((pertes / entrees) * 1000) / 10 : 0;
  const sansEntree = entrees <= 0 && pertes > 0;
  return { taux, sansEntree, depasseSeuil: sansEntree || taux >= seuilPct };
}
