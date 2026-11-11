import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ZONE_NAME_TAKEN, ZonesController } from '../../src/modules/territory/territory.module';

/**
 * TER-1 — nom de zone en doublon : 400 « Nom de zone déjà utilisé »,
 * jamais une erreur 500 (contrainte uq_zone_company_name).
 */
const A = '0a000000-0000-4000-8000-00000000000a';
const MBOUR = { id: 'z-mbour', companyId: A, name: 'Mbour', code: null, active: true };
const THIES = { id: 'z-thies', companyId: A, name: 'Thiès', code: null, active: true };

/** Dépôt simulé : `zones` est la table du tenant A ; findOne cherche par id ou par nom. */
function fakeRepo(zones: Array<Record<string, any>>, saveError?: Error) {
  return {
    findOne: jest.fn(async ({ where }: any) => {
      const z = zones.find((x) => x.companyId === where.companyId && (where.id ? x.id === where.id : x.name === where.name));
      return z ? { ...z } : null;
    }),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => {
      if (saveError) throw saveError;
      return x;
    }),
  } as any;
}

const uniqueViolation = () => {
  const e = new QueryFailedError('INSERT …', [], new Error('duplicate key value violates unique constraint "uq_zone_company_name"'));
  (e as any).code = '23505';
  return e;
};

async function expect400(p: Promise<unknown>, message: string) {
  await expect(p).rejects.toBeInstanceOf(BadRequestException);
  await expect(p).rejects.toThrow(message);
}

describe('Zones — nom en doublon (TER-1)', () => {
  it('modification vers le nom d’une autre zone → 400, rien n’est enregistré', async () => {
    const repo = fakeRepo([MBOUR, THIES]);
    await expect400(new ZonesController(repo).update(A, THIES.id, { name: 'Mbour' }), ZONE_NAME_TAKEN);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('les espaces autour du nom ne contournent pas le contrôle', async () => {
    const repo = fakeRepo([MBOUR, THIES]);
    await expect400(new ZonesController(repo).update(A, THIES.id, { name: '  Mbour  ' }), ZONE_NAME_TAKEN);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('création avec un nom déjà pris → 400 avec le même message', async () => {
    const repo = fakeRepo([MBOUR]);
    await expect400(new ZonesController(repo).create(A, { name: 'Mbour' }), ZONE_NAME_TAKEN);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('garder son propre nom (autre champ modifié) est accepté', async () => {
    const repo = fakeRepo([MBOUR, THIES]);
    const saved: any = await new ZonesController(repo).update(A, MBOUR.id, { name: 'Mbour', code: 'MBR' });
    expect(saved).toMatchObject({ id: MBOUR.id, name: 'Mbour', code: 'MBR' });
  });

  it('renommer vers un nom libre est accepté, nom nettoyé des espaces', async () => {
    const repo = fakeRepo([MBOUR, THIES]);
    const saved: any = await new ZonesController(repo).update(A, THIES.id, { name: '  Tivaouane ' });
    expect(saved.name).toBe('Tivaouane');
  });

  it('nom vide ou d’un seul caractère après nettoyage → 400', async () => {
    const repo = fakeRepo([MBOUR]);
    await expect400(new ZonesController(repo).update(A, MBOUR.id, { name: '   ' }), 'Nom de zone trop court');
    await expect400(new ZonesController(repo).update(A, MBOUR.id, { name: ' x ' }), 'Nom de zone trop court');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('course : la base refuse le doublon (23505) → 400, pas 500', async () => {
    const repo = fakeRepo([THIES], uniqueViolation());
    await expect400(new ZonesController(repo).update(A, THIES.id, { name: 'Ziguinchor' }), ZONE_NAME_TAKEN);
  });

  it('une autre erreur de base n’est pas masquée', async () => {
    const repo = fakeRepo([THIES], new Error('connexion perdue'));
    await expect(new ZonesController(repo).update(A, THIES.id, { name: 'Ziguinchor' })).rejects.toThrow('connexion perdue');
  });
});
