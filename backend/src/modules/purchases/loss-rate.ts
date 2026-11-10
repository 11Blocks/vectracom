/**
 * Seuil de perte contractuel SONATEL (en %).
 *
 * ⚠️ DÉCISION PROVISOIRE (10/11/2026) : l'alerte se déclenche à partir de
 * 10,0 % inclus (`>=`). Le cas « 10,0 % pile » reste à trancher par Moussa
 * (Green-T) ; avant cette date, la comparaison était stricte (`>`).
 */
export const DEFAULT_LOSS_THRESHOLD_PCT = 10;

export interface LossRate {
  /** Taux de perte en %, arrondi au dixième. */
  taux: number;
  /** true si le taux atteint ou dépasse le seuil (alerte sanction). */
  depasseSeuil: boolean;
}

/**
 * Taux de perte = pertes / entrées × 100, arrondi au dixième.
 * Sans entrée, le taux vaut 0 (comportement actuel — voir le cas
 * « 0 entrée + pertes > 0 » dans les corrections secondaires).
 */
export function computeLossRate(
  entrees: number,
  pertes: number,
  seuilPct: number = DEFAULT_LOSS_THRESHOLD_PCT,
): LossRate {
  const taux = entrees > 0 ? Math.round((pertes / entrees) * 1000) / 10 : 0;
  return { taux, depasseSeuil: taux >= seuilPct };
}
