import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { PriceItem } from '../src/modules/stock/entities/price-item.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Bordereau de prix 3STB 2025 — 52 prestations facturables à SONATEL
 * (numéros 1-52, plus l'item 105 « Redressement poteau » cité dans les
 * exemples ONECOMIT). Items 10/45/105 repris des montants constatés ;
 * les autres suivent la nomenclature des rubriques (Survey, Installation,
 * SAV, TS, INFRA, GC, OSM, Densification). À recaler sur le fichier Excel
 * officiel le cas échéant.
 */
const BORDEREAU: Array<[number, string, string, number, string, string]> = [
  [1, 'Survey installation FTTH', 'u', 3500, 'SURVEY', 'FTTH'],
  [2, 'Survey SAV', 'u', 2500, 'SURVEY', 'SAV'],
  [3, 'Survey OSM', 'u', 15000, 'SURVEY', 'OSM'],
  [4, 'Raccordement client FTTH (EM)', 'u', 18000, 'INSTALLATION', 'FTTH'],
  [5, 'Raccordement client FTTH (HM/MM)', 'u', 16000, 'INSTALLATION', 'FTTH'],
  [6, 'Raccordement client B2B', 'u', 25000, 'INSTALLATION', 'FTTH'],
  [7, 'Installation PTO', 'u', 4000, 'INSTALLATION', 'FTTH'],
  [8, 'Tirage câble immeuble', 'm', 850, 'INSTALLATION', 'FTTH'],
  [9, 'Pose gaine FTTH', 'm', 600, 'INSTALLATION', 'FTTH'],
  [10, 'Conduite enrobée', 'm', 990, 'INFRA', 'GC'],
  [11, 'Sondage mécanisé', 'm', 1200, 'INFRA', 'GC'],
  [12, 'Ouverture de fouille (enrobé)', 'm', 5500, 'INFRA', 'GC'],
  [13, 'Ouverture de fouille (terre)', 'm', 2500, 'INFRA', 'GC'],
  [14, 'Réfection enrobé', 'm', 9500, 'INFRA', 'GC'],
  [15, 'Réfection terre/béton', 'm', 4500, 'INFRA', 'GC'],
  [16, 'Poser chambre BPE L2T', 'u', 45000, 'INFRA', 'GC'],
  [17, 'Poser chambre BPE L3T', 'u', 60000, 'INFRA', 'GC'],
  [18, 'Poser chambre BPE L5T', 'u', 85000, 'INFRA', 'GC'],
  [19, 'Poser coiffe L2T', 'u', 6000, 'INFRA', 'GC'],
  [20, 'Poser coiffe L3T', 'u', 7500, 'INFRA', 'GC'],
  [21, 'Tirage câble FO transport souterrain', 'm', 350, 'INFRA', 'FIBRE'],
  [22, 'Tirage câble FO aérien', 'm', 300, 'INFRA', 'FIBRE'],
  [23, 'Tirage câble distribution 24FO', 'm', 400, 'INFRA', 'FIBRE'],
  [24, 'Tirage câble cuivre 14p', 'm', 280, 'INFRA', 'CUIVRE'],
  [25, 'Tirage câble cuivre 5/99', 'm', 320, 'INFRA', 'CUIVRE'],
  [26, 'Pose PBO mural', 'u', 12000, 'INFRA', 'FIBRE'],
  [27, 'Pose PBO façade', 'u', 15000, 'INFRA', 'FIBRE'],
  [28, 'Pose PBO poteau', 'u', 18000, 'INFRA', 'FIBRE'],
  [29, 'Raccordement PBO (port client)', 'port', 3500, 'INFRA', 'FIBRE'],
  [30, 'Soudure fibre (par brin)', 'brin', 2500, 'INFRA', 'FIBRE'],
  [31, 'Épissure cuivre (par paire)', 'paire', 1200, 'INFRA', 'CUIVRE'],
  [32, 'Dépannage SAV (EM)', 'u', 9000, 'SAV', 'FTTH'],
  [33, 'Dépannage SAV (HM/MM)', 'u', 8000, 'SAV', 'FTTH'],
  [34, 'Dépannage SAV (B2B)', 'u', 14000, 'SAV', 'FTTH'],
  [35, 'Relève SAV sous 4h (B2B)', 'u', 12000, 'SAV', 'SLA'],
  [36, 'Relève SAV sous 4h (B2C)', 'u', 10000, 'SAV', 'SLA'],
  [37, 'Échange modem SAV', 'u', 7500, 'SAV', 'MATERIEL'],
  [38, 'Échange ONT SAV', 'u', 9500, 'SAV', 'MATERIEL'],
  [39, 'Échange PTO défectueuse', 'u', 6500, 'SAV', 'MATERIEL'],
  [40, 'Test et mesure optique (réflectométrie)', 'u', 5500, 'SAV', 'MESURE'],
  [41, 'Raccordement liaison spécialisée OSM', 'u', 45000, 'OSM', 'ENTREPRISE'],
  [42, 'Tirage transport souterrain OSM', 'm', 950, 'OSM', 'ENTREPRISE'],
  [43, 'Tirage câble OSM 6FO', 'm', 500, 'OSM', 'ENTREPRISE'],
  [44, 'Tirage câble OSM 12FO', 'm', 650, 'OSM', 'ENTREPRISE'],
  [45, 'Plantation poteau', 'u', 4000, 'INFRA', 'GC'],
  [47, 'Pose guard-line', 'm', 450, 'INFRA', 'GC'],
  [48, 'Reprise soudure (par brin)', 'brin', 3000, 'INFRA', 'FIBRE'],
  [49, 'Nettoyage chambre', 'u', 3500, 'INFRA', 'GC'],
  [50, 'Densification : ajout point branchement', 'u', 11000, 'DENSIFICATION', 'FTTH'],
  [51, 'Densification : pose PBO supplémentaire', 'u', 16500, 'DENSIFICATION', 'FTTH'],
  [52, 'Dévoiement câble aérien', 'm', 700, 'INFRA', 'GC'],
  [105, 'Redressement poteau', 'u', 1500, 'INFRA', 'GC'],
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

  const repo = dataSource.getRepository(PriceItem);
  const companies = await dataSource.getRepository(Company).find({ select: ['id', 'name'] });

  let created = 0;
  for (const company of companies) {
    for (const [itemNumber, designation, unit, unitPrice, category, subCategory] of BORDEREAU) {
      const existing = await repo.findOne({
        where: { companyId: company.id, itemNumber, version: '2025' },
      });
      if (existing) continue;
      await repo.insert({
        companyId: company.id,
        itemNumber,
        designation,
        unit,
        unitPrice: String(unitPrice),
        category,
        subCategory,
        version: '2025',
        effectiveFrom: '2025-01-01',
        isActive: true,
      });
      created++;
    }
  }

  console.log(`Bordereau 3STB : ${created} item(s) inséré(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
