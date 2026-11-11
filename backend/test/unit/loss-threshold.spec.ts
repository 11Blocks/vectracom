import { computeLossRate, DEFAULT_LOSS_THRESHOLD_PCT } from '../../src/modules/purchases/loss-rate';

describe('Pertes stock — seuil contractuel SONATEL (L5)', () => {
  it('seuil par défaut = 10 %', () => {
    expect(DEFAULT_LOSS_THRESHOLD_PCT).toBe(10);
  });

  it('9,9 % → pas d’alerte', () => {
    expect(computeLossRate(1000, 99)).toEqual({ taux: 9.9, sansEntree: false, depasseSeuil: false });
  });

  it('10,0 % pile → alerte (décision provisoire `>=`, à trancher)', () => {
    expect(computeLossRate(1000, 100)).toEqual({ taux: 10, sansEntree: false, depasseSeuil: true });
  });

  it('10,1 % → alerte', () => {
    expect(computeLossRate(1000, 101)).toEqual({ taux: 10.1, sansEntree: false, depasseSeuil: true });
  });

  it('arrondit au dixième : 1/3 → 33,3 %', () => {
    expect(computeLossRate(3, 1).taux).toBe(33.3);
  });

  it('un taux de 9,96 % arrondi à 10,0 % déclenche l’alerte (le seuil porte sur le taux affiché)', () => {
    expect(computeLossRate(10_000, 996)).toEqual({ taux: 10, sansEntree: false, depasseSeuil: true });
  });

  it('aucune perte → 0 %, pas d’alerte', () => {
    expect(computeLossRate(500, 0)).toEqual({ taux: 0, sansEntree: false, depasseSeuil: false });
  });

  it('seuil personnalisable', () => {
    expect(computeLossRate(100, 5, 5).depasseSeuil).toBe(true);
    expect(computeLossRate(100, 5, 6).depasseSeuil).toBe(false);
  });
});

describe('Pertes sans aucune entrée (STK-1)', () => {
  it('0 entrée et pertes > 0 → alerte, taux non calculable (0) signalé par `sansEntree`', () => {
    expect(computeLossRate(0, 12)).toEqual({ taux: 0, sansEntree: true, depasseSeuil: true });
  });

  it('une seule unité perdue sans entrée suffit à déclencher l’alerte', () => {
    expect(computeLossRate(0, 1)).toMatchObject({ sansEntree: true, depasseSeuil: true });
  });

  it('l’alerte sans entrée ne dépend pas du seuil', () => {
    expect(computeLossRate(0, 3, 50)).toMatchObject({ sansEntree: true, depasseSeuil: true });
  });

  it('0 entrée et 0 perte → aucune alerte (article jamais mouvementé)', () => {
    expect(computeLossRate(0, 0)).toEqual({ taux: 0, sansEntree: false, depasseSeuil: false });
  });

  it('des entrées existent → `sansEntree` reste faux, quel que soit le taux', () => {
    expect(computeLossRate(10, 0).sansEntree).toBe(false);
    expect(computeLossRate(10, 50).sansEntree).toBe(false);
  });
});
