import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { StockItem } from '../src/modules/stock/entities/stock-item.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Articles de base ONECOMIT — mix FIBRE/CUIVRE et CONSUMABLE/ASSET. */
const ITEMS = [
  { reference: 'FO-CAB-246', designation: 'Câble FO distribution 246m', category: 'CONSUMABLE' as const, family: 'FIBRE' as const, unit: 'm', thresholdAlert: 500 },
  { reference: 'FO-CAB-24', designation: 'Câble FO distribution 24FO', category: 'CONSUMABLE' as const, family: 'FIBRE' as const, unit: 'm', thresholdAlert: 300 },
  { reference: 'FO-GAINE', designation: 'Gaine micro-duct 5mm', category: 'CONSUMABLE' as const, family: 'FIBRE' as const, unit: 'm', thresholdAlert: 200 },
  { reference: 'FO-COLSON', designation: 'Colson (sachet 100)', category: 'CONSUMABLE' as const, family: 'FIBRE' as const, unit: 'sachet', thresholdAlert: 20 },
  { reference: 'CU-CAB-14P', designation: 'Câble cuivre 14 paires', category: 'CONSUMABLE' as const, family: 'CUIVRE' as const, unit: 'm', thresholdAlert: 200 },
  { reference: 'CU-CAB-599', designation: 'Câble cuivre 5/99', category: 'CONSUMABLE' as const, family: 'CUIVRE' as const, unit: 'm', thresholdAlert: 150 },
  { reference: 'FO-PTO', designation: 'PTE/PTO fibre', category: 'ASSET' as const, family: 'FIBRE' as const, unit: 'u', thresholdAlert: 50 },
  { reference: 'FO-PBO', designation: 'PBO 144 ports', category: 'ASSET' as const, family: 'FIBRE' as const, unit: 'u', thresholdAlert: 5 },
  { reference: 'FO-ONT', designation: 'ONT/modem fibre', category: 'ASSET' as const, family: 'FIBRE' as const, unit: 'u', thresholdAlert: 10 },
  { reference: 'CU-MODEM', designation: 'Modem cuivre', category: 'ASSET' as const, family: 'CUIVRE' as const, unit: 'u', thresholdAlert: 10 },
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

  const repo = dataSource.getRepository(StockItem);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const item of ITEMS) {
      const existing = await repo.findOne({ where: { companyId: company.id, reference: item.reference } });
      if (existing) continue;
      await repo.insert({ companyId: company.id, ...item });
      created++;
    }
  }
  console.log(`Articles seedés : ${created} créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
