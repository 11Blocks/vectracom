import { BadRequestException } from '@nestjs/common';
import { assertTenantIds } from '../../src/common/tenant-ids';
import { PayrollService } from '../../src/modules/payroll/payroll.module';
import { PermanenceService } from '../../src/modules/permanence/permanence.module';
import { ExpensesService } from '../../src/modules/expenses/expenses.module';
import { RenfortsService } from '../../src/modules/renforts/renforts.module';
import { PurchasesService } from '../../src/modules/purchases/purchases.module';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { PilotesController } from '../../src/modules/territory/territory.module';
import { TeamsService } from '../../src/modules/teams/teams.service';

/**
 * Isolation multi-tenant des modules L0–L7 : un ID appartenant à un autre
 * tenant doit être refusé (400) et rien ne doit être écrit.
 *
 * Base simulée en mémoire : deux tenants A et B, chacun avec une ligne par table.
 */

const A = '0a000000-0000-4000-8000-00000000000a';
const B = '0b000000-0000-4000-8000-00000000000b';
const TABLES = ['teams', 'zones', 'pilotes', 'items', 'partners', 'technicians', 'missions', 'stock_items'] as const;
type T = (typeof TABLES)[number];

/** id déterministe : ex. id('teams', A) */
const id = (table: T, tenant: string) => {
  const n = (TABLES.indexOf(table) + 1).toString(16).padStart(2, '0');
  return `${tenant.slice(0, 2)}${n}0000-0000-4000-8000-000000000001`;
};
// Garde-fou : les IDs de test doivent être des UUID valides, sinon un refus
// « identifiant invalide » masquerait l'absence de contrôle tenant.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const expectTenantRefusal = (p: Promise<unknown>) => expect(p).rejects.toThrow('introuvable pour ce tenant');

const rows: Record<string, Array<{ id: string; company_id: string; repartition_chef_pct?: number }>> = {};
for (const t of TABLES) {
  rows[t] = [
    { id: id(t, A), company_id: A, repartition_chef_pct: 65 },
    { id: id(t, B), company_id: B, repartition_chef_pct: 65 },
  ];
}

/** Interprète les deux formes de requêtes de vérification utilisées par les services. */
async function fakeQuery(sql: string, params: unknown[] = []): Promise<any[]> {
  const s = sql.replace(/\s+/g, ' ');
  let m = /FROM (\w+) WHERE company_id = \$1 AND id = ANY\(\$2::uuid\[\]\)/.exec(s);
  if (m) {
    const [companyId, ids] = params as [string, string[]];
    return (rows[m[1]] ?? []).filter((r) => r.company_id === companyId && ids.includes(r.id));
  }
  m = /FROM (\w+) WHERE id = \$1 AND company_id = \$2/.exec(s);
  if (m) {
    const [rid, companyId] = params as [string, string];
    return (rows[m[1]] ?? []).filter((r) => r.id === rid && r.company_id === companyId);
  }
  throw new Error(`Requête non simulée : ${s}`);
}

function fakeRepo(overrides: Record<string, unknown> = {}) {
  return {
    query: jest.fn(fakeQuery),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    insert: jest.fn(async () => undefined),
    ...overrides,
  } as any;
}

const expect400 = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(BadRequestException);

it("les IDs de test sont des UUID valides", () => {
  for (const t of TABLES) for (const c of [A, B]) expect(id(t, c)).toMatch(UUID_RE);
});

describe('assertTenantIds (helper commun)', () => {
  const db = { query: jest.fn(fakeQuery) };
  beforeEach(() => db.query.mockClear());

  it('accepte les IDs du tenant', async () => {
    await expect(assertTenantIds(db, A, 'teams', id('teams', A))).resolves.toBeUndefined();
  });

  it('refuse un ID d’un autre tenant', async () => {
    await expectTenantRefusal(assertTenantIds(db, A, 'teams', id('teams', B)));
  });

  it('refuse une liste mixte (un seul ID étranger suffit)', async () => {
    await expectTenantRefusal(assertTenantIds(db, A, 'technicians', [id('technicians', A), id('technicians', B)]));
  });

  it('refuse un ID inexistant', async () => {
    await expect400(assertTenantIds(db, A, 'zones', '0a990000-0000-4000-8000-000000000099'));
  });

  it('refuse un ID mal formé sans interroger la base', async () => {
    await expect400(assertTenantIds(db, A, 'zones', 'pas-un-uuid'));
    expect(db.query).not.toHaveBeenCalled();
  });

  it('ignore null / undefined / vide sans interroger la base', async () => {
    await assertTenantIds(db, A, 'zones', null);
    await assertTenantIds(db, A, 'zones', undefined);
    await assertTenantIds(db, A, 'zones', [null, undefined, '']);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('dédoublonne : le même ID deux fois reste valide', async () => {
    await expect(assertTenantIds(db, A, 'teams', [id('teams', A), id('teams', A)])).resolves.toBeUndefined();
  });

  it('refuse une table hors liste blanche', async () => {
    await expect(assertTenantIds(db, A, 'users' as any, id('teams', A))).rejects.toThrow('Table non autorisée');
  });
});

describe('Modules L0–L7 : ID d’un autre tenant refusé, rien n’est écrit', () => {
  it('payroll — chef d’un autre tenant', async () => {
    const repo = fakeRepo();
    const svc = new PayrollService(repo);
    await expectTenantRefusal(svc.upsert(A, { teamId: id('teams', A), period: '2026-10', revenue: 100_000, chefId: id('technicians', B) }));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('payroll — binôme d’un autre tenant', async () => {
    const repo = fakeRepo();
    const svc = new PayrollService(repo);
    await expectTenantRefusal(svc.upsert(A, { teamId: id('teams', A), period: '2026-10', revenue: 100_000, binomeId: id('technicians', B) }));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('payroll — chef et binôme du tenant → enregistré avec 65/35', async () => {
    const repo = fakeRepo();
    const svc = new PayrollService(repo);
    const saved: any = await svc.upsert(A, {
      teamId: id('teams', A),
      period: '2026-10',
      revenue: 100_000,
      chefId: id('technicians', A),
      binomeId: id('technicians', A),
    });
    expect(saved.chefShare).toBe('65000');
    expect(saved.binomeShare).toBe('35000');
  });

  it('payroll — la liste filtre les techniciens joints par company_id', async () => {
    const repo = fakeRepo({ query: jest.fn(async () => []) });
    await new PayrollService(repo).list(A, '2026-10');
    const sql: string = repo.query.mock.calls[0][0].replace(/\s+/g, ' ');
    expect(sql).toContain('technicians c ON c.id = p.chef_id AND c.company_id = t.company_id');
    expect(sql).toContain('technicians b ON b.id = p.binome_id AND b.company_id = t.company_id');
  });

  it('permanence — rotation avec une équipe d’un autre tenant', async () => {
    const slotRepo = fakeRepo({ find: jest.fn(async () => [{ id: 's1', teamId: null }]) });
    const svc = new PermanenceService(slotRepo, fakeRepo());
    await expectTenantRefusal(svc.assignRotation(A, 'SAV', [id('teams', A), id('teams', B)]));
    expect(slotRepo.save).not.toHaveBeenCalled();
  });

  it('permanence — rotation avec les équipes du tenant', async () => {
    const slotRepo = fakeRepo({ find: jest.fn(async () => [{ id: 's1', teamId: null }, { id: 's2', teamId: null }]) });
    const svc = new PermanenceService(slotRepo, fakeRepo());
    await expect(svc.assignRotation(A, 'SAV', [id('teams', A)])).resolves.toMatchObject({ assigned: 2, teamCount: 1 });
  });

  it('frais de mission — équipe d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(new ExpensesService(repo).create(A, { teamId: id('teams', B), expenseType: 'carburant', amount: 5000 } as any, 'u1'));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('frais de mission — mission d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(new ExpensesService(repo).create(A, { missionId: id('missions', B), expenseType: 'repas', amount: 2000 } as any, 'u1'));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('frais de mission — modification vers une équipe d’un autre tenant', async () => {
    const repo = fakeRepo({ findOne: jest.fn(async () => ({ id: 'e1', companyId: A })) });
    await expectTenantRefusal(new ExpensesService(repo).update(A, 'e1', { teamId: id('teams', B) } as any));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('renfort — zone d’arrivée d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(
      new RenfortsService(repo).create(A, {
        teamId: id('teams', A),
        fromZoneId: id('zones', A),
        toZoneId: id('zones', B),
        startDate: '2026-11-10',
        endDate: '2026-11-12',
      } as any),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('achat SONATEL — article de stock d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(
      new PurchasesService(repo).create(A, { stockItemId: id('stock_items', B), designation: 'Câble', quantity: 1, unitCost: 100 } as any, 'u1'),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('cascade tarifaire — partenaire aval d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(
      new PricingService(repo).create(A, {
        parentPartnerId: id('partners', A),
        childPartnerId: id('partners', B),
        percentage: '65',
      } as any),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('cascade tarifaire — item d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(
      new PricingService(repo).create(A, {
        parentPartnerId: id('partners', A),
        childPartnerId: id('partners', A),
        itemId: id('items', B),
        percentage: '80',
      } as any),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('simulation de cascade — partenaire final d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(new PricingService(repo).simulate(A, { fromPartnerId: id('partners', A), toPartnerId: id('partners', B), basePrice: 27_000 }));
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('simulation de cascade — item d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(new PricingService(repo).simulate(A, { fromPartnerId: id('partners', A), itemId: id('items', B), basePrice: 27_000 }));
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('pilote — partenaire d’un autre tenant', async () => {
    const repo = fakeRepo();
    await expectTenantRefusal(new PilotesController(repo).create(A, { name: 'Awa Sonko', type: 'SOUS_TRAITANT', partnerId: id('partners', B) } as any));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['zoneId', 'zones'],
    ['pilotId', 'pilotes'],
    ['itemId', 'items'],
  ] as const)('équipe — création avec %s d’un autre tenant', async (field, table) => {
    const teamRepo = fakeRepo();
    const svc = new TeamsService(teamRepo, fakeRepo());
    await expectTenantRefusal(svc.create(A, { name: 'Équipe test', type: 'PROD', [field]: id(table, B) } as any));
    expect(teamRepo.save).not.toHaveBeenCalled();
  });

  it('équipe — modification avec une zone d’un autre tenant', async () => {
    const teamRepo = fakeRepo({ findOne: jest.fn(async () => ({ id: id('teams', A), companyId: A, name: 'Équipe A' })) });
    const svc = new TeamsService(teamRepo, fakeRepo());
    await expectTenantRefusal(svc.update(A, id('teams', A), { zoneId: id('zones', B) } as any));
    expect(teamRepo.save).not.toHaveBeenCalled();
  });
});
