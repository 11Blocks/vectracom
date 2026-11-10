import { computeLossRate, DEFAULT_LOSS_THRESHOLD_PCT } from '../../src/modules/purchases/loss-rate';

describe('Pertes stock — seuil contractuel SONATEL (L5)', () => {
  it('seuil par défaut = 10 %', () => {
    expect(DEFAULT_LOSS_THRESHOLD_PCT).toBe(10);
  });

  it('9,9 % → pas d’alerte', () => {
    expect(computeLossRate(1000, 99)).toEqual({ taux: 9.9, depasseSeuil: false });
  });

  it('10,0 % pile → alerte (décision provisoire `>=`, à trancher)', () => {
    expect(computeLossRate(1000, 100)).toEqual({ taux: 10, depasseSeuil: true });
  });

  it('10,1 % → alerte', () => {
    expect(computeLossRate(1000, 101)).toEqual({ taux: 10.1, depasseSeuil: true });
  });

  it('arrondit au dixième : 1/3 → 33,3 %', () => {
    expect(computeLossRate(3, 1).taux).toBe(33.3);
  });

  it('un taux de 9,96 % arrondi à 10,0 % déclenche l’alerte (le seuil porte sur le taux affiché)', () => {
    expect(computeLossRate(10_000, 996)).toEqual({ taux: 10, depasseSeuil: true });
  });

  it('aucune perte → 0 %, pas d’alerte', () => {
    expect(computeLossRate(500, 0)).toEqual({ taux: 0, depasseSeuil: false });
  });

  it('seuil personnalisable', () => {
    expect(computeLossRate(100, 5, 5).depasseSeuil).toBe(true);
    expect(computeLossRate(100, 5, 6).depasseSeuil).toBe(false);
  });

  it('comportement ACTUEL : 0 entrée et des pertes → taux 0, pas d’alerte', () => {
    // Fige le comportement existant. À inverser avec la correction secondaire
    // « alerte si 0 entrée + pertes > 0 ».
    expect(computeLossRate(0, 12)).toEqual({ taux: 0, depasseSeuil: false });
  });

  it.todo('0 entrée et pertes > 0 → alerte (correction secondaire à venir)');
});
