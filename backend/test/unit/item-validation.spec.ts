import { BadRequestException } from '@nestjs/common';
import {
  findCompositionProblems,
  findMissionTypeProblems,
  MAX_ROLE_COUNT,
  normalizeComposition,
} from '../../src/modules/items/item-validation';
import { ItemsController } from '../../src/modules/items/items.module';

/** ITM-1 — validations des Items (domaines métier). */
const FTTH = { id: 'i-ftth', code: 'FTTH', missionTypes: ['INSTALLATION', 'SURVEY', 'SAV', 'SURVEY_OSM'] };
const INFRA = { id: 'i-infra', code: 'INFRA', missionTypes: ['INFRA'] };

describe('findMissionTypeProblems', () => {
  it('liste valide, types libres → aucun problème', () => {
    expect(findMissionTypeProblems(['GC', 'PLANTATION'], null, [FTTH, INFRA])).toEqual([]);
  });

  it('type hors liste fermée → refusé', () => {
    expect(findMissionTypeProblems(['GC', 'PASSAGE'], null, [])).toEqual(['Type de mission inconnu : PASSAGE']);
  });

  it('la casse compte (liste fermée exacte)', () => {
    expect(findMissionTypeProblems(['gc'], null, [])).toEqual(['Type de mission inconnu : gc']);
  });

  it('type en double dans le même item → refusé', () => {
    expect(findMissionTypeProblems(['GC', 'GC'], null, [])).toEqual(['Type de mission en double : GC']);
  });

  it('type déjà rattaché à un autre item → refusé, en nommant cet item', () => {
    expect(findMissionTypeProblems(['SAV'], null, [FTTH, INFRA])).toEqual(["Le type SAV appartient déjà à l'item FTTH"]);
  });

  it('l’item modifié peut garder ses propres types', () => {
    expect(findMissionTypeProblems(FTTH.missionTypes, FTTH.id, [FTTH, INFRA])).toEqual([]);
  });

  it('liste vide acceptée', () => {
    expect(findMissionTypeProblems([], null, [FTTH])).toEqual([]);
  });

  it('valeur non-liste ou élément non texte → refusé', () => {
    expect(findMissionTypeProblems('GC', null, [])).toEqual(['missionTypes doit être une liste']);
    expect(findMissionTypeProblems([42], null, [])).toEqual(['Type de mission inconnu : 42']);
  });
});

describe('findCompositionProblems', () => {
  it('composition du seed DÉPLOIEMENT (2 tireurs + 1 raccordeur + 4 journaliers) → valide', () => {
    const c = [
      { role: 'CHEF_TIREUR', count: 2 },
      { role: 'CHEF_RACCORDEUR', count: 1 },
      { role: 'JOURNALIER', count: 4 },
    ];
    expect(findCompositionProblems(c)).toEqual([]);
  });

  it('rôle inconnu → refusé', () => {
    expect(findCompositionProblems([{ role: 'PILOTE', count: 1 }])).toEqual(['Rôle inconnu : PILOTE']);
  });

  it('rôle en double → refusé', () => {
    expect(findCompositionProblems([{ role: 'CHEF', count: 1 }, { role: 'CHEF', count: 2 }])).toEqual(['Rôle en double : CHEF']);
  });

  it.each([[0], [-1], [1.5], [MAX_ROLE_COUNT + 1], ['2' as any], [undefined as any]])('effectif %p → refusé', (count) => {
    expect(findCompositionProblems([{ role: 'BINOME', count }])).toEqual([`Effectif invalide pour BINOME (entier de 1 à ${MAX_ROLE_COUNT})`]);
  });

  it(`effectifs limites 1 et ${MAX_ROLE_COUNT} acceptés`, () => {
    expect(findCompositionProblems([{ role: 'CHEF', count: 1 }, { role: 'JOURNALIER', count: MAX_ROLE_COUNT }])).toEqual([]);
  });

  it('valeur non-liste → refusé', () => {
    expect(findCompositionProblems({ role: 'CHEF', count: 1 })).toEqual(['teamComposition doit être une liste']);
  });

  it('normalizeComposition ne garde que role et count', () => {
    expect(normalizeComposition([{ role: 'CHEF', count: 1, extra: 'x' } as any])).toEqual([{ role: 'CHEF', count: 1 }]);
  });
});

describe('ItemsController — branchement des validations (ITM-1)', () => {
  const A = '0a000000-0000-4000-8000-00000000000a';
  function fakeRepo(items: any[]) {
    return {
      find: jest.fn(async () => items.map((i) => ({ ...i, companyId: A }))),
      findOne: jest.fn(async ({ where }: any) => {
        const i = items.find((x) => (where.id ? x.id === where.id : x.code === where.code));
        return i ? { ...i, companyId: A, teamComposition: i.teamComposition ?? [] } : null;
      }),
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    } as any;
  }

  it('création avec un type déjà pris par un autre item → 400, rien n’est enregistré', async () => {
    const repo = fakeRepo([FTTH]);
    const p = new ItemsController(repo).create(A, { code: 'BTS', label: 'BTS', missionTypes: ['SAV'] } as any);
    await expect(p).rejects.toBeInstanceOf(BadRequestException);
    await expect(new ItemsController(repo).create(A, { code: 'BTS', label: 'BTS', missionTypes: ['SAV'] } as any)).rejects.toThrow(
      "Le type SAV appartient déjà à l'item FTTH",
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('modification avec une composition invalide → 400, rien n’est enregistré', async () => {
    const repo = fakeRepo([FTTH]);
    await expect(
      new ItemsController(repo).update(A, FTTH.id, { teamComposition: [{ role: 'CHEF', count: 0 }] } as any),
    ).rejects.toThrow('Effectif invalide pour CHEF');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('modification de la seule composition : les types existants ne sont pas revalidés', async () => {
    // Base déjà incohérente : SAV présent dans deux items. Modifier la composition reste possible.
    const repo = fakeRepo([FTTH, { id: 'i-x', code: 'INFRA', missionTypes: ['SAV'] }]);
    const saved: any = await new ItemsController(repo).update(A, FTTH.id, { teamComposition: [{ role: 'CHEF', count: 2 }] } as any);
    expect(saved.teamComposition).toEqual([{ role: 'CHEF', count: 2 }]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('modification valide des types et de la composition → enregistrée, composition normalisée', async () => {
    const repo = fakeRepo([FTTH, INFRA]);
    const saved: any = await new ItemsController(repo).update(A, INFRA.id, {
      missionTypes: ['INFRA', 'GC'],
      teamComposition: [{ role: 'CHEF', count: 1, note: 'x' }],
    } as any);
    expect(saved).toMatchObject({ missionTypes: ['INFRA', 'GC'], teamComposition: [{ role: 'CHEF', count: 1 }] });
  });
});
