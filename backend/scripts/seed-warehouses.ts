import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Warehouse } from '../src/modules/stock/entities/warehouse.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Dépôts ONECOMIT : Dakar (siège), Mbour, Kaolack. */
const DEPOTS = [
  { name: 'Dépôt Central Dakar', type: 'CENTRAL' as const, zone: 'Dakar' },
  { name: 'Dépôt Mbour', type: 'CENTRAL' as const, zone: 'Mbour' },
  { name: 'Dépôt Kaolack', type: 'CENTRAL' as const, zone: 'Kaolack' },
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

  const repo = dataSource.getRepository(Warehouse);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const d of DEPOTS) {
      const existing = await repo.findOne({ where: { companyId: company.id, name: d.name } });
      if (existing) continue;
      await repo.insert({ companyId: company.id, ...d });
      created++;
    }
  }
  console.log(`Entrepôts seedés : ${created} créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
