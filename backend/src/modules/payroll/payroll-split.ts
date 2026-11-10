/** Part du chef par défaut (règle 65/35 ONECOMIT, configurable par équipe). */
export const DEFAULT_CHEF_PCT = 65;

export interface PayrollSplit {
  chefShare: number;
  binomeShare: number;
}

/**
 * Répartition chef / binôme d'un revenu d'équipe (FCFA, entiers).
 * La part du chef est arrondie au franc ; le binôme reçoit le complément,
 * de sorte que chefShare + binomeShare === revenue, toujours.
 */
export function computePayrollSplit(revenue: number, chefPct: number = DEFAULT_CHEF_PCT): PayrollSplit {
  if (!Number.isFinite(revenue) || revenue < 0) throw new RangeError('Revenu invalide');
  if (!Number.isFinite(chefPct) || chefPct < 0 || chefPct > 100) throw new RangeError('Pourcentage chef invalide');
  const chefShare = Math.round((revenue * chefPct) / 100);
  return { chefShare, binomeShare: revenue - chefShare };
}

/** Période de paie au format YYYY-MM (mois 01 à 12). */
export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}
