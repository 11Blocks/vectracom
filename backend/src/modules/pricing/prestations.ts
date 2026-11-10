/**
 * Prestations auxquelles une règle de cascade peut s'appliquer.
 *
 * Clés reprises À L'IDENTIQUE de `InvoicesService.resolvePrestation`
 * (format « CATÉGORIE:clé »), pour pouvoir brancher plus tard la cascade
 * sur les factures sans table de correspondance. Toute nouvelle clé
 * doit d'abord exister côté facturation.
 *
 * En attente du directeur ONECOMIT (docs/QUESTIONS-DIRECTEUR-ONECOMIT.md) :
 *   Q7 « S+I APP » (variante appartement de survey + installation ?)
 *   Q8 « PASSAGE » (= deplacement sav ?)
 */
export const PRESTATIONS = [
  { key: 'PRODUCTION:survey + installation', label: 'Survey + Installation' },
  { key: 'PRODUCTION:survey', label: 'Survey' },
  { key: 'PRODUCTION:deplacement avec remontee de blocage production', label: 'Déplacement avec remontée de blocage (Production)' },
  { key: 'SAV:releve derangement', label: 'Relevé dérangement' },
  { key: 'SAV:deplacement sav', label: 'Déplacement SAV' },
  { key: 'SAV:diagnostic derangement sans releve + re', label: 'Diagnostic de dérangement (sans relève) + REOR' },
] as const;

export type PrestationKey = (typeof PRESTATIONS)[number]['key'];

const KEYS = new Set<string>(PRESTATIONS.map((p) => p.key));

export function isKnownPrestation(key: string): key is PrestationKey {
  return KEYS.has(key);
}

export function prestationLabel(key: string | null): string | null {
  if (!key) return null;
  return PRESTATIONS.find((p) => p.key === key)?.label ?? key;
}
