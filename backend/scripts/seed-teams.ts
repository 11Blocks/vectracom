import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Team } from '../src/modules/teams/entities/team.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Équipes ONECOMIT (Alpha, Beta, Gamma, Delta — un type par zone). */
const TEAMS = [
  { name: 'Alpha', type: 'PROD' as const, zone: 'Mbour' },
  { name: 'Beta', type: 'SAV' as const, zone: 'Saly' },
  { name: 'Gamma', type: 'INFRA' as const, zone: 'Thies' },
  { name: 'Delta', type: 'EXTENSION' as const, zone: 'Dakar' },
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

  const repo = dataSource.getRepository(Team);
  const companies = await dataSource.getRepository(Company).find({ select: ['id', 'name'] });

  let created = 0;
  for (const company of companies) {
    for (const t of TEAMS) {
      const existing = await repo.findOne({ where: { companyId: company.id, name: t.name } });
      if (existing) continue;
      await repo.insert({ companyId: company.id, name: t.name, type: t.type, zone: t.zone });
      created++;
    }
  }
  console.log(`Équipes seedées : ${created} créée(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
