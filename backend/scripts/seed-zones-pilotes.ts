import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Zone } from '../src/modules/territory/entities/zone.entity';
import { Pilote } from '../src/modules/territory/entities/pilote.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Seed des Zones (zones OLT réelles + dispositif) et Pilotes (superviseurs),
 * à partir du fichier DISPOSITIF du 27/09/2026 et de la présentation Direction.
 */
const ZONES = [
  'Mbour',
  'Thiaroye',
  'Kaolack',
  'Touba',
  'Kaffrine',
  'Fatick',
  'Popenguine',
  'Koungheul',
  'Sokone',
  'Nioro',
  'Fimela',
  'Porokhane',
  'Mbodjene',
  'Thiès',
  'Tivaouane',
  'Mékhé',
  'Pire',
  'Thiénaba',
];

const PILOTES: Array<{ name: string; type: 'SONATEL' | 'SOUS_TRAITANT' }> = [
  { name: 'ABOUBAKRY', type: 'SONATEL' },
  { name: 'AWA SONKO', type: 'SONATEL' },
  { name: 'MARIÈME DIALLO', type: 'SONATEL' },
  { name: 'ASSANE NDIAYE', type: 'SONATEL' },
  { name: 'NDEYE BOURY DIOP', type: 'SONATEL' },
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

  const zoneRepo = dataSource.getRepository(Zone);
  const piloteRepo = dataSource.getRepository(Pilote);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let zonesCreated = 0;
  let pilotesCreated = 0;
  for (const company of companies) {
    for (const name of ZONES) {
      if (await zoneRepo.findOne({ where: { companyId: company.id, name } })) continue;
      await zoneRepo.insert({ companyId: company.id, name, code: null });
      zonesCreated++;
    }
    for (const p of PILOTES) {
      if (await piloteRepo.findOne({ where: { companyId: company.id, name: p.name } })) continue;
      await piloteRepo.insert({ companyId: company.id, name: p.name, type: p.type, partnerId: null });
      pilotesCreated++;
    }
  }

  console.log(`Zones : ${zonesCreated} · Pilotes : ${pilotesCreated} (${companies.length} tenant(s)).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed zones/pilotes échoué :', err);
  process.exit(1);
});
