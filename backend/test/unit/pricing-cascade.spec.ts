import {
  applyPercentage,
  CascadeError,
  CascadeRule,
  computeCascade,
  findRuleProblems,
} from '../../src/modules/pricing/cascade';

/**
 * Cascade tarifaire (L0) — décisions Moussa du 10/11/2026 :
 * arrondi au franc à chaque étape ; prestation > item > défaut ;
 * partenaire final à choisir en cas d'embranchement.
 */

const SONATEL = 'p-sonatel';
const SOFATELCOM = 'p-sofatelcom';
const ONECOMIT = 'p-onecomit';
const ABC = 'p-abc-sarl';
const AGENT = 'p-assane-dieng';
const ITEM_FTTH = 'item-ftth';
const ITEM_INFRA = 'item-infra';
const SI = 'PRODUCTION:survey + installation';
const SURVEY = 'PRODUCTION:survey';
const RELEVE = 'SAV:releve derangement';

let seq = 0;
function rule(parent: string, child: string, percentage: number, over: Partial<CascadeRule> = {}): CascadeRule {
  seq += 1;
  return {
    id: `r${seq}`,
    parentPartnerId: parent,
    childPartnerId: child,
    itemId: null,
    prestationKey: null,
    percentage,
    effectiveFrom: null,
    effectiveTo: null,
    active: true,
    ...over,
  };
}

const DATE = '2026-11-10';

/** Chaîne de référence : SOFATELCOM → ONECOMIT 65 % → ABC SARL 80 %. */
const chain = () => [rule(SOFATELCOM, ONECOMIT, 65), rule(ONECOMIT, ABC, 80)];

function expectCascadeError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CascadeError);
    expect((e as CascadeError).code).toBe(code);
    return;
  }
  throw new Error(`CascadeError ${code} attendue, aucune erreur levée`);
}

describe('applyPercentage — arrondi au franc', () => {
  it.each([
    [27_000, 65, 17_550],
    [17_550, 80, 14_040],
    [17_550, 87, 15_269], // 15 268,5 → 15 269
    [17_550, 93, 16_322], // 16 321,5 → 16 322
    [17_550, 91, 15_971], // 15 970,5 → 15 971
    [10_000, 65.55, 6_555], // décimales sans erreur flottante
    [0, 80, 0],
  ])('%i × %p %% = %i', (amount, pct, expected) => {
    expect(applyPercentage(amount, pct)).toBe(expected);
  });
});

describe('computeCascade — chaîne SOFATELCOM → ONECOMIT → ABC SARL', () => {
  it('27 000 → 17 550 → 14 040 (pas d’arrondi au millier)', () => {
    const res = computeCascade(chain(), { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE });
    expect(res.steps.map((s) => s.amountOut)).toEqual([17_550, 14_040]);
    expect(res.finalAmount).toBe(14_040);
    expect(res.finalPartnerId).toBe(ABC);
    expect(res.steps[0]).toMatchObject({ parentPartnerId: SOFATELCOM, childPartnerId: ONECOMIT, percentage: 65, amountIn: 27_000, scope: 'defaut' });
  });

  it('s’arrête au partenaire final demandé (ONECOMIT)', () => {
    const res = computeCascade(chain(), { fromPartnerId: SOFATELCOM, toPartnerId: ONECOMIT, basePrice: 27_000, date: DATE });
    expect(res.steps).toHaveLength(1);
    expect(res.finalAmount).toBe(17_550);
  });

  it('départ = arrivée → aucun maillon, montant inchangé', () => {
    const res = computeCascade(chain(), { fromPartnerId: ONECOMIT, toPartnerId: ONECOMIT, basePrice: 17_550, date: DATE });
    expect(res.steps).toHaveLength(0);
    expect(res.finalAmount).toBe(17_550);
  });

  it('partenaire sans règle sortante et sans partenaire final → fin de chaîne', () => {
    const res = computeCascade(chain(), { fromPartnerId: ABC, basePrice: 14_040, date: DATE });
    expect(res.steps).toHaveLength(0);
  });
});

describe('Priorité : prestation > item > défaut', () => {
  const rules = () => [
    rule(SOFATELCOM, ONECOMIT, 65),
    rule(ONECOMIT, ABC, 80), // défaut
    rule(ONECOMIT, ABC, 85, { itemId: ITEM_FTTH }), // item
    rule(ONECOMIT, ABC, 93, { prestationKey: SURVEY }), // prestation
    rule(ONECOMIT, ABC, 91, { prestationKey: RELEVE }),
    rule(ONECOMIT, ABC, 87, { prestationKey: SI, itemId: ITEM_FTTH }), // prestation + item
  ];
  const run = (q: { itemId?: string; prestationKey?: string }) =>
    computeCascade(rules(), { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE, ...q }).steps[1];

  it('aucune précision → règle par défaut (80 %)', () => {
    expect(run({})).toMatchObject({ percentage: 80, scope: 'defaut', amountOut: 14_040 });
  });

  it('item FTTH → règle d’item (85 %)', () => {
    expect(run({ itemId: ITEM_FTTH })).toMatchObject({ percentage: 85, scope: 'item' });
  });

  it('item INFRA (sans règle dédiée) → règle par défaut', () => {
    expect(run({ itemId: ITEM_INFRA })).toMatchObject({ percentage: 80, scope: 'defaut' });
  });

  it('prestation Survey, même avec item FTTH → règle de prestation (93 %)', () => {
    expect(run({ itemId: ITEM_FTTH, prestationKey: SURVEY })).toMatchObject({ percentage: 93, scope: 'prestation', amountOut: 16_322 });
  });

  it('prestation Relevé → 91 %', () => {
    expect(run({ prestationKey: RELEVE })).toMatchObject({ percentage: 91, amountOut: 15_971 });
  });

  it('prestation + item → la plus précise (87 %, 15 269)', () => {
    expect(run({ itemId: ITEM_FTTH, prestationKey: SI })).toMatchObject({ percentage: 87, scope: 'prestation_item', amountOut: 15_269 });
  });

  it('règle prestation+item ignorée si l’item ne correspond pas', () => {
    expect(run({ itemId: ITEM_INFRA, prestationKey: SI })).toMatchObject({ percentage: 80, scope: 'defaut' });
  });
});

describe('Dates d’effet', () => {
  const dated = () => [
    rule(SOFATELCOM, ONECOMIT, 60, { effectiveTo: '2026-06-30' }), // ancienne
    rule(SOFATELCOM, ONECOMIT, 65, { effectiveFrom: '2026-07-01' }), // en vigueur
    rule(SOFATELCOM, ONECOMIT, 70, { effectiveFrom: '2027-01-01', prestationKey: SI }), // future
  ];
  const pct = (date: string, prestationKey?: string) =>
    computeCascade(dated(), { fromPartnerId: SOFATELCOM, toPartnerId: ONECOMIT, basePrice: 27_000, date, prestationKey }).steps[0].percentage;

  it('règle expirée ignorée, règle en vigueur appliquée', () => {
    expect(pct('2026-11-10')).toBe(65);
    expect(pct('2026-03-15')).toBe(60);
  });

  it('bornes incluses', () => {
    expect(pct('2026-06-30')).toBe(60);
    expect(pct('2026-07-01')).toBe(65);
  });

  it('règle future ignorée avant sa date, appliquée ensuite', () => {
    expect(pct('2026-12-31', SI)).toBe(65);
    expect(pct('2027-01-01', SI)).toBe(70);
  });

  it('règle inactive ignorée', () => {
    const rules = [rule(SOFATELCOM, ONECOMIT, 65, { active: false })];
    expectCascadeError(
      () => computeCascade(rules, { fromPartnerId: SOFATELCOM, toPartnerId: ONECOMIT, basePrice: 27_000, date: DATE }),
      'MAILLON_MANQUANT',
    );
  });
});

describe('Erreurs explicites', () => {
  it('embranchement sans partenaire final → EMBRANCHEMENT', () => {
    const rules = [...chain(), rule(ONECOMIT, AGENT, 80)];
    expectCascadeError(() => computeCascade(rules, { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE }), 'EMBRANCHEMENT');
  });

  it('embranchement avec partenaire final choisi → chemin unique', () => {
    const rules = [...chain(), rule(ONECOMIT, AGENT, 91)];
    const res = computeCascade(rules, { fromPartnerId: SOFATELCOM, toPartnerId: AGENT, basePrice: 27_000, date: DATE });
    expect(res.finalPartnerId).toBe(AGENT);
    expect(res.finalAmount).toBe(15_971);
  });

  it('deux chemins vers le même partenaire final → EMBRANCHEMENT', () => {
    const rules = [rule(SONATEL, SOFATELCOM, 90), rule(SONATEL, ONECOMIT, 60), rule(SOFATELCOM, ONECOMIT, 65)];
    expectCascadeError(
      () => computeCascade(rules, { fromPartnerId: SONATEL, toPartnerId: ONECOMIT, basePrice: 27_000, date: DATE }),
      'EMBRANCHEMENT',
    );
  });

  it('partenaire final inaccessible → MAILLON_MANQUANT', () => {
    expectCascadeError(
      () => computeCascade(chain(), { fromPartnerId: SOFATELCOM, toPartnerId: AGENT, basePrice: 27_000, date: DATE }),
      'MAILLON_MANQUANT',
    );
  });

  it('cycle → CYCLE', () => {
    const rules = [rule(SOFATELCOM, ONECOMIT, 65), rule(ONECOMIT, SOFATELCOM, 80)];
    expectCascadeError(() => computeCascade(rules, { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE }), 'CYCLE');
  });

  it('deux règles de même précision sur un maillon → CONFLIT', () => {
    const rules = [rule(SOFATELCOM, ONECOMIT, 65), rule(SOFATELCOM, ONECOMIT, 66)];
    expectCascadeError(() => computeCascade(rules, { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE }), 'CONFLIT');
  });

  it.each([
    [{ basePrice: -1 }],
    [{ basePrice: 100.5 }],
    [{ date: '10/11/2026' }],
    [{ prestationKey: 'PRODUCTION:inconnue' }],
  ])('entrée invalide %p → ENTREE_INVALIDE', (over) => {
    expectCascadeError(
      () => computeCascade(chain(), { fromPartnerId: SOFATELCOM, basePrice: 27_000, date: DATE, ...over }),
      'ENTREE_INVALIDE',
    );
  });
});

describe('findRuleProblems — validations création / modification', () => {
  const ok = () => rule(ONECOMIT, ABC, 80);

  it('règle valide → aucun problème', () => {
    expect(findRuleProblems(chain().slice(0, 1), ok())).toEqual([]);
  });

  it.each([[0], [-5], [100.01], [1000], [Number.NaN]])('pourcentage %p refusé', (p) => {
    expect(findRuleProblems([], rule(ONECOMIT, ABC, p))).toContain('Pourcentage invalide (doit être > 0 et ≤ 100)');
  });

  it('100 % accepté, 65,55 % accepté, 65,555 % refusé', () => {
    expect(findRuleProblems([], rule(ONECOMIT, ABC, 100))).toEqual([]);
    expect(findRuleProblems([], rule(ONECOMIT, ABC, 65.55))).toEqual([]);
    expect(findRuleProblems([], rule(ONECOMIT, ABC, 65.555))).toContain('Pourcentage : 2 décimales au plus');
  });

  it('parent = enfant refusé', () => {
    expect(findRuleProblems([], rule(ONECOMIT, ONECOMIT, 80))).toContain('Le partenaire amont et le partenaire aval doivent être différents');
  });

  it('début > fin refusé', () => {
    const r = rule(ONECOMIT, ABC, 80, { effectiveFrom: '2026-12-01', effectiveTo: '2026-11-01' });
    expect(findRuleProblems([], r)).toContain('La date de début doit être antérieure ou égale à la date de fin');
  });

  it('prestation inconnue refusée', () => {
    expect(findRuleProblems([], rule(ONECOMIT, ABC, 80, { prestationKey: 'SAV:passage' }))).toContain('Prestation inconnue : SAV:passage');
  });

  it('chevauchement de périodes pour la même portée refusé', () => {
    const existing = [rule(ONECOMIT, ABC, 80, { effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' })];
    const candidate = rule(ONECOMIT, ABC, 82, { effectiveFrom: '2026-12-01' });
    expect(findRuleProblems(existing, candidate)).toContain('Une règle identique existe déjà sur une période qui se chevauche');
  });

  it('périodes successives sans chevauchement acceptées', () => {
    const existing = [rule(ONECOMIT, ABC, 80, { effectiveTo: '2026-12-31' })];
    expect(findRuleProblems(existing, rule(ONECOMIT, ABC, 82, { effectiveFrom: '2027-01-01' }))).toEqual([]);
  });

  it('portées différentes (prestation vs défaut) → pas de chevauchement', () => {
    const existing = [rule(ONECOMIT, ABC, 80)];
    expect(findRuleProblems(existing, rule(ONECOMIT, ABC, 93, { prestationKey: SURVEY }))).toEqual([]);
  });

  it('règle qui fermerait un cycle refusée', () => {
    expect(findRuleProblems(chain(), rule(ABC, SOFATELCOM, 50))).toContain('Cette règle créerait un cycle dans la chaîne de sous-traitance');
  });

  it('modification : la règle elle-même n’entre pas en conflit avec sa version stockée', () => {
    const stored = rule(ONECOMIT, ABC, 80);
    expect(findRuleProblems([stored], { ...stored, percentage: 82 })).toEqual([]);
  });

  it('règle désactivée : pas de contrôle de chevauchement ni de cycle', () => {
    expect(findRuleProblems(chain(), rule(ABC, SOFATELCOM, 50, { active: false }))).toEqual([]);
  });
});
