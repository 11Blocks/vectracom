import { computePayrollSplit, DEFAULT_CHEF_PCT, isValidPeriod } from '../../src/modules/payroll/payroll-split';

describe('Rémunération équipe — répartition chef / binôme (L6)', () => {
  it('applique 65/35 par défaut : 100 000 → 65 000 / 35 000', () => {
    expect(DEFAULT_CHEF_PCT).toBe(65);
    expect(computePayrollSplit(100_000)).toEqual({ chefShare: 65_000, binomeShare: 35_000 });
  });

  it.each([
    [100_000, 70, 70_000, 30_000],
    [100_000, 50, 50_000, 50_000],
    [100_000, 0, 0, 100_000],
    [100_000, 100, 100_000, 0],
    [17_550, 65, 11_408, 6_142], // 11 407,5 arrondi au franc supérieur
  ])('revenu %i à %i %% → chef %i / binôme %i', (revenue, pct, chef, binome) => {
    expect(computePayrollSplit(revenue, pct)).toEqual({ chefShare: chef, binomeShare: binome });
  });

  it('chef + binôme = revenu, sans perte d’un franc (montants impairs)', () => {
    for (const revenue of [0, 1, 3, 999, 14_001, 123_457]) {
      for (const pct of [35, 65, 65.5, 80, 87, 93]) {
        const { chefShare, binomeShare } = computePayrollSplit(revenue, pct);
        expect(chefShare + binomeShare).toBe(revenue);
        expect(Number.isInteger(chefShare)).toBe(true);
        expect(binomeShare).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('revenu nul → 0 / 0', () => {
    expect(computePayrollSplit(0)).toEqual({ chefShare: 0, binomeShare: 0 });
  });

  it.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])('refuse un revenu invalide (%p)', (revenue) => {
    expect(() => computePayrollSplit(revenue)).toThrow(RangeError);
  });

  it.each([[-1], [100.01], [Number.NaN]])('refuse un pourcentage chef hors 0–100 (%p)', (pct) => {
    expect(() => computePayrollSplit(100_000, pct)).toThrow(RangeError);
  });

  describe('période YYYY-MM', () => {
    it.each(['2026-01', '2026-09', '2026-12'])('accepte %s', (p) => expect(isValidPeriod(p)).toBe(true));
    it.each(['2026-00', '2026-13', '2026-9', '26-09', '2026/09', ''])('refuse « %s »', (p) =>
      expect(isValidPeriod(p)).toBe(false),
    );
  });

  // À activer avec la correction secondaire « bloquer une feuille validée ».
  it.todo('refuse la modification d’une feuille de paie au statut « validee »');
  // À activer quand le revenu sera calculé depuis les missions et les charges déduites.
  it.todo('déduit les charges (carburant, mécanique, location) avant la répartition 65/35');
});
