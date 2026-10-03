import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Partner } from '../src/modules/partners/entities/partner.entity';
import { PricingRule } from '../src/modules/pricing/entities/pricing-rule.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Seed de la chaîne de sous-traitance + cascade tarifaire (réunion directeur).
 * Chaîne : SONATEL (racine) → SOFATELCOM (niv1) → ONECOMIT (niv2, tenant) → ABC SARL (niv3).
 * Cascade (pourcentage du tarif amont reversé à l'aval) :
 *   SONATEL → SOFATELCOM : 100 %
 *   SOFATELCOM → ONECOMIT : 65 %   (ex. Survey+Installation 27 000 → 17 550)
 *   ONECOMIT → ABC SARL    : 80 %   (ex. 17 550 → 14 000)
 * item_id NULL = règle par défaut (tous items) ; les % varient par item → ajouter
 * des règles avec item_id pour les cas particuliers (PASSAGE 87 %, Survey 93 %…).
 */

const CHAIN: Array<{ code: string; name: string; level: number; parentCode: string | null }> = [
  { code: 'SONATEL', name: "SONATEL (donneur d'ordre racine)", level: 0, parentCode: null },
  { code: 'SOFATELCOM', name: 'SOFATELCOM (sous-traitant niveau 1)', level: 1, parentCode: 'SONATEL' },
  { code: 'ONECOMIT', name: 'ONECOMIT (sous-traitant niveau 2)', level: 2, parentCode: 'SOFATELCOM' },
  { code: 'ABC_SARL', name: 'ABC SARL (sous-traitant niveau 3)', level: 3, parentCode: 'ONECOMIT' },
];

const RULES: Array<[string, string, number]> = [
  ['SONATEL', 'SOFATELCOM', 100],
  ['SOFATELCOM', 'ONECOMIT', 65],
  ['ONECOMIT', 'ABC_SARL', 80],
];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: process.env.NODE_ENV !== 'production',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const partnerRepo = dataSource.getRepository(Partner);
  const ruleRepo = dataSource.getRepository(PricingRule);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let partnersCreated = 0;
  let rulesCreated = 0;

  for (const company of companies) {
    const idByCode = new Map<string, string>();

    // Upsert des partenaires de la chaîne (level + lien parent).
    for (const c of CHAIN) {
      let p = await partnerRepo.findOne({ where: { companyId: company.id, code: c.code } });
      if (!p) {
        p = await partnerRepo.save(
          partnerRepo.create({
            companyId: company.id,
            code: c.code,
            name: c.name,
            priceGrid: 'GRID_SOFATELCOM',
            level: c.level,
          }),
        );
        partnersCreated++;
      } else if (p.level == null) {
        p.level = c.level;
        await partnerRepo.save(p);
      }
      idByCode.set(c.code, p.id);
    }

    // Lien parent (donneur d'ordre amont).
    for (const c of CHAIN) {
      if (!c.parentCode) continue;
      const parentId = idByCode.get(c.parentCode);
      if (!parentId) continue;
      const child = await partnerRepo.findOne({ where: { companyId: company.id, code: c.code } });
      if (child && child.parentPartnerId !== parentId) {
        child.parentPartnerId = parentId;
        await partnerRepo.save(child);
      }
    }

    // Règles de cascade (idempotentes par contrainte unique).
    for (const [parentCode, childCode, pct] of RULES) {
      const parentId = idByCode.get(parentCode);
      const childId = idByCode.get(childCode);
      if (!parentId || !childId) continue;
      const existing = await ruleRepo.findOne({
        where: { companyId: company.id, parentPartnerId: parentId, childPartnerId: childId, itemId: IsNull() },
      });
      if (existing) continue;
      await ruleRepo.insert({
        companyId: company.id,
        parentPartnerId: parentId,
        childPartnerId: childId,
        itemId: null,
        percentage: String(pct),
        active: true,
      });
      rulesCreated++;
    }
  }

  console.log(
    `Chaîne sous-traitance : ${partnersCreated} partenaire(s) créé(s) · ${rulesCreated} règle(s) de cascade (${companies.length} tenant(s)).`,
  );
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed partenaires/cascade échoué :', err);
  process.exit(1);
});
