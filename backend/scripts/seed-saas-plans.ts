import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { SaasPlan } from '../src/modules/saas/entities/saas-plan.entity';
import { PLAN_PRICES, SAAS_PLAN_CODES } from '../src/modules/saas/saas-pricing';

dotenv.config();

/** Catalogue des 4 plans tarifaires (catalogue global, sans tenant). */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: process.env.NODE_ENV !== 'production',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const repo = dataSource.getRepository(SaasPlan);
  let created = 0;
  for (const code of SAAS_PLAN_CODES) {
    const def = PLAN_PRICES[code];
    const existing = await repo.findOne({ where: { code } });
    if (existing) continue;
    await repo.insert({
      companyId: null,
      name: def.name,
      code,
      description: def.description,
      priceMonthly: String(def.monthly),
      priceAnnual: String(def.annual),
      features: {},
      isActive: true,
    } as never);
    created++;
  }
  console.log(`Plans SaaS : ${created} créé(s) (MOBILE, WEB, RAG, GEOLOCATION).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
