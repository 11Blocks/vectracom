import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Item } from '../src/modules/items/entities/item.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Seed des 6 Items (domaines métier) — confirmés par la réunion directeur.
 * Chaque Item porte la composition type d'équipe et les missionType couverts.
 */
const ITEMS: Array<{
  code: Item['code'];
  label: string;
  missionTypes: string[];
  composition: Array<{ role: string; count: number }>;
}> = [
  {
    code: 'FTTH',
    label: 'FTTH (installation, SAV, survey fibre/ADSL/5G/VSAT)',
    missionTypes: ['INSTALLATION', 'SURVEY', 'SAV', 'SURVEY_OSM'],
    composition: [
      { role: 'CHEF', count: 1 },
      { role: 'BINOME', count: 1 },
      { role: 'STAGIAIRE', count: 1 },
    ],
  },
  {
    code: 'INFRA',
    label: 'INFRA (dérangements centrales ↔ PBO)',
    missionTypes: ['INFRA'],
    composition: [
      { role: 'CHEF', count: 1 },
      { role: 'BINOME', count: 1 },
      { role: 'STAGIAIRE', count: 1 },
    ],
  },
  {
    code: 'PP_GC',
    label: 'Plantation poteau & Génie Civil',
    missionTypes: ['PLANTATION', 'GC', 'DEVOIEMENT'],
    composition: [
      { role: 'CHEF', count: 1 },
      { role: 'BINOME', count: 1 },
      { role: 'JOURNALIER', count: 2 },
    ],
  },
  {
    code: 'EXT_DENSIF',
    label: 'Extension & Densification',
    missionTypes: ['DENSIFICATION', 'OSM'],
    composition: [
      { role: 'CHEF_TIREUR', count: 2 },
      { role: 'CHEF_RACCORDEUR', count: 1 },
      { role: 'JOURNALIER', count: 4 },
    ],
  },
  {
    code: 'DEPLOIEMENT',
    label: 'Déploiement (zone non fibrée)',
    missionTypes: ['DEPLOIEMENT'],
    composition: [
      { role: 'CHEF_TIREUR', count: 2 },
      { role: 'CHEF_RACCORDEUR', count: 1 },
      { role: 'JOURNALIER', count: 4 },
    ],
  },
  {
    code: 'BTS',
    label: 'BTS (antennes mobiles 4G/5G)',
    missionTypes: ['BTS'],
    composition: [
      { role: 'CHEF', count: 1 },
      { role: 'BINOME', count: 1 },
      { role: 'STAGIAIRE', count: 1 },
    ],
  },
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

  const repo = dataSource.getRepository(Item);
  const companies = await dataSource.getRepository(Company).find({ select: ['id', 'name'] });

  let created = 0;
  for (const company of companies) {
    for (const it of ITEMS) {
      const existing = await repo.findOne({ where: { companyId: company.id, code: it.code } });
      if (existing) continue;
      await repo.insert({
        companyId: company.id,
        code: it.code,
        label: it.label,
        missionTypes: it.missionTypes,
        teamComposition: it.composition,
      });
      created++;
    }
  }

  console.log(`Items : ${created} item(s) inséré(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed items échoué :', err);
  process.exit(1);
});
