import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Lot P1 — Grilles tarifaires duales, depuis les fichiers réels :
 * - « Borderau de prix OK 3STB VALIDE 2025.xlsx » (79 items, numérotation officielle 1→101)
 * - « ATTACHEMENT ONCOMIT JUIN VF.xlsx » (grille prestations SOFATELCOM, feuille de synthèse)
 * Les items priceGrid=BORDEREAU_3STB déjà seedés (52, version '2025') sont complétés :
 * les numéros absents sont ajoutés, les prix existants sont MIS À JOUR sur les montants réels.
 */
const BORDEREAU_3STB_2025: Array<[number, string, string, number]> = [
  [1, "Aiguillage et tirage câble FO en conduite (1, 6, 12, 24, 36, 48)", 'm', 130],
  [2, 'Aiguillage simple en conduite (sans tirage)', 'm', 50],
  [3, "Armement d'un appui SENELEC (en bois)", 'u', 600],
  [4, 'Clouage de câble FO en façade', 'm', 90],
  [5, 'Clouage de câble FO en immeuble (indoor)', 'm', 110],
  [6, 'Conduite allegée 2 diam 50', 'm', 700],
  [7, 'Conduite allegée 3 diam 50', 'm', 700],
  [8, 'Conduite allegée 5 diam 40 en PEHD non fendu', 'm', 900],
  [9, 'Conduite allegée 5 diam 50', 'm', 900],
  [10, 'Conduite enrobé en PEHD non fendu', 'm', 990],
  [11, 'Conduite enrobée 2 diam 50', 'm', 880],
  [12, 'Conduite enrobée 3 diam 50', 'm', 975],
  [13, 'Conduite enrobée 5 diam 50', 'm', 1050],
  [14, 'Construction de Chambre chaussée découvrable type K2C', 'u', 135350],
  [15, 'Construction de Chambre chaussée mixte type M1C', 'u', 185955],
  [16, 'Construction de Chambre chaussée plafonnée type P1C', 'u', 450450],
  [17, 'Construction de Chambre chaussée plafonnée type P2C', 'u', 450450],
  [18, "Construction d'ouvrage en béton", 'm', 15000],
  [19, "Construction d'ouvrage en maçonnerie", 'm3', 13800],
  [21, 'Epissurage de câble de distribution (raccordement par fibre de 12 à 48 FO)', 'fibre', 1100],
  [22, 'Epissurage de câble de distribution (raccordement par fibre de 72 à 144 FO)', 'fibre', 1100],
  [23, 'Epissurage de câble de transport (raccordement par fibre de 12 à 48 FO)', 'fibre', 1500],
  [24, 'Epissurage de câble de transport (raccordement par fibre de 288 à 576 FO)', 'fibre', 1100],
  [25, 'Epissurage de câble de transport (raccordement par fibre de 72 à 144 FO)', 'fibre', 1150],
  [27, 'Fixation de BPE dans Chambre', 'u', 1000],
  [28, 'Fixation de BPE sur poteau', 'u', 1000],
  [29, 'Pose de coiffe sur poteau existant', 'u', 175],
  [31, 'L2T : Chambre trottoir découvrable type L2T', 'u', 70000],
  [32, 'L3T : Chambre trottoir découvrable type L3T', 'u', 89500],
  [33, 'L3T : Transformation de chambre existante en L3T', 'u', 90000],
  [34, 'L4T : Chambre trottoir découvrable type L4T', 'u', 110000],
  [35, 'L5T : Chambre trottoir découvrable type L5T', 'u', 175000],
  [36, 'L5T : Transformation de chambre existante en L5T', 'u', 160000],
  [37, 'L6T : Chambre trottoir découvrable type L6T', 'u', 235000],
  [38, 'Mobilisation équipe — chantier hors zone entre 50 et 250 km de Dakar', 'NRO', 50000],
  [39, 'Mobilisation équipe — chantier hors zone à plus de 250 km de Dakar', 'NRO', 80000],
  [41, 'Nettoyage chambre', 'u', 3500],
  [42, 'Pénétration chambre existante', 'u', 2000],
  [43, 'Pénétration niche existante', 'u', 2000],
  [44, 'Plantation appui moisé 8 m', 'u', 7000],
  [45, 'Plantation et armement de poteau bois 7 à 10 m', 'u', 4000],
  [46, 'Plus-value pour sur-profondeur par dm indivisible', 'u', 500],
  [48, "Pose d'armoire de rue (y compris le socle)", 'u', 6000],
  [49, 'Pose 3 tuyaux PVC diam 75/84 et 2 tuyaux PVC diam 42/50 dans fourreau acier', 'm', 295],
  [50, 'Tirage câble FO en aérien (1, 6, 12, 24, 36 FO)', 'm', 105],
  [52, 'Pose de Réhausse sur Poteau existant', 'u', 500],
  [53, "Armement d'un appui SENELEC (en béton)", 'u', 500],
  [54, 'Pose Armement sur Poteau existant SONATEL', 'u', 500],
  [55, 'Pose de tête de câble FO 144 fibres (TEQ) (hors soudure splitters 2:2)', 'u', 7500],
  [56, 'Pose de tête de câble FO 144 fibres précablée (TBL) (hors soudure)', 'u', 8750],
  [57, "Pose d'une gaine de protection 3,00 m", 'u', 500],
  [59, 'Pose et epissurage coupleur 1:4', 'u', 1850],
  [60, 'Pose et epissurage coupleur 1:8', 'u', 6200],
  [65, 'Pose et raccordement MEB 144', 'u', 110000],
  [66, 'Pose et raccordement MEC 128 (+4 coupleurs 1:32, préconnectorisé côté sortie)', 'u', 10500],
  [67, 'Pose et raccordement (soudure) PBO en colonne montante PBO IMM 6 ou 8 FO', 'u', 6000],
  [68, 'Pose et raccordement (soudure) PBO en colonne montante PBO IMM 12 FO', 'u', 6000],
  [69, 'Pose et raccordement (soudure) PBO de 6 ou 8 FO en façade', 'u', 2400],
  [70, 'Pose et raccordement (soudure) PBO de 6 ou 8 sur poteau', 'u', 3500],
  [71, 'Pose et raccordement (soudure) PBO de 12 FO sur poteau', 'u', 3500],
  [72, 'Pose et raccordement tête de câble FO 144 fibres', 'u', 125000],
  [75, 'Pose ferme optiques', 'u', 8500],
  [76, 'Pose ferrure', 'u', 900],
  [77, 'Pose et raccordement de PBO sans soudure (par plug in)', 'u', 3000],
  [78, 'Pose et raccordement de BPI', 'u', 7000],
  [88, 'Réfection chaussée', 'm2', 5000],
  [89, 'Réfection de masque', 'u', 3100],
  [90, 'Réfection route en pavé', 'm2', 3300],
  [91, 'Réfection surface gazonnée', 'm2', 2650],
  [92, 'Réfection trottoir bitumé', 'm2', 10000],
  [93, 'Réfection trottoir carrelé', 'm2', 4500],
  [94, 'Réfection trottoir cimenté', 'm2', 2000],
  [95, 'Réfection trottoir dallé', 'm2', 5500],
  [96, 'Réparation de conduite allégée (bloc)', 'm', 1650],
  [97, 'Réparation de conduite enrobée (bloc)', 'm', 3000],
  [99, 'Treillis soudé 0,4 m pour conduite enrobé ou type C de chambre', 'u', 5000],
  [101, 'Vidange de chambre avec citerne', 'u', 11500],
];

/** Grille SOFATELCOM — prestation, catégorie, prix (attachement ONECOMIT JUIN, zone Mbour). */
const GRID_SOFATELCOM: Array<[number, string, string, number, string]> = [
  [1, 'Survey', 'PRODUCTION', 3250, 'u'],
  [2, 'Etude', 'PRODUCTION', 3250, 'u'],
  [3, 'Survey + Installation', 'PRODUCTION', 17550, 'u'],
  [4, 'Déplacement avec remontée de blocage (Production)', 'PRODUCTION', 1950, 'u'],
  [5, "Installation d'un nouvel accès", 'PRODUCTION', 14950, 'u'],
  [6, 'Configuration modem client / Upgrade ou downgrade / Migration bas débit vers haut débit', 'PRODUCTION', 3250, 'u'],
  [7, "Modification installation intérieure client", 'PRODUCTION', 4550, 'u'],
  [8, 'Diagnostic de dérangement (sans relève) + REOR', 'SAV', 2500, 'u'],
  [9, 'Relevé dérangement', 'SAV', 5000, 'u'],
  [10, 'Déplacement SAV', 'SAV', 1500, 'u'],
  [11, 'Changement PBO', 'TS', 6500, 'u'],
  [12, 'Plantation poteau', 'TS', 6500, 'u'],
];

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    entities: [__dirname + '/../src/modules/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();
  const repo = dataSource.getRepository('PriceItem');
  const companies = await dataSource.query('SELECT id, name FROM companies WHERE id IS NOT NULL');
  console.log(`Grilles tarifaires duales pour ${companies.length} tenant(s)`);

  for (const company of companies) {
    // 1. Bordereau 3STB réel — upsert par (company, itemNumber, version, grid)
    let added = 0;
    let updated = 0;
    for (const [itemNumber, designation, unit, unitPrice] of BORDEREAU_3STB_2025) {
      const existing = await repo.findOne({
        where: { companyId: company.id, itemNumber, version: '2025', priceGrid: 'BORDEREAU_3STB' },
      });
      if (existing) {
        if (Number(existing.unitPrice) !== unitPrice || existing.designation !== designation) {
          existing.designation = designation;
          existing.unit = unit;
          existing.unitPrice = String(unitPrice);
          await repo.save(existing);
          updated++;
        }
      } else {
        await repo.save(
          repo.create({
            companyId: company.id,
            itemNumber,
            designation,
            unit,
            unitPrice: String(unitPrice),
            category: 'TS',
            version: '2025',
            priceGrid: 'BORDEREAU_3STB',
            isActive: true,
          }),
        );
        added++;
      }
    }

    // 2. Grille prestations SOFATELCOM
    let sofAdded = 0;
    for (const [itemNumber, designation, category, unitPrice, unit] of GRID_SOFATELCOM) {
      const existing = await repo.findOne({
        where: { companyId: company.id, itemNumber, version: '2025', priceGrid: 'GRID_SOFATELCOM' },
      });
      if (!existing) {
        await repo.save(
          repo.create({
            companyId: company.id,
            itemNumber,
            designation,
            unit,
            unitPrice: String(unitPrice),
            category,
            version: '2025',
            priceGrid: 'GRID_SOFATELCOM',
            isActive: true,
          }),
        );
        sofAdded++;
      }
    }
    console.log(`  ${company.name}: bordereau +${added} ~${updated} màj → ${BORDEREAU_3STB_2025.length} items | SOFATELCOM +${sofAdded}/12`);

    // 3. Partenaires par défaut
    const partnerRepo = dataSource.getRepository('Partner');
    for (const [code, name, grid, zone, desc] of [
      ['SOFATELCOM', 'SOFATELCOM', 'GRID_SOFATELCOM', 'Mbour', 'Exclusivité zone Mbour : maintenance et installation FTTH, INFRA, plantation, génie civil'],
      ['3STB', '3STB', 'BORDEREAU_3STB', null, 'National : travaux d\'extension et de déploiement'],
    ] as const) {
      const existing = await partnerRepo.findOne({ where: { companyId: company.id, code } });
      if (!existing) {
        await partnerRepo.save(
          partnerRepo.create({ companyId: company.id, code, name, priceGrid: grid as never, exclusiveZone: zone as string | null, description: desc }),
        );
      }
    }
  }
  console.log('=== Seed grilles duales terminé ===');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('seed-price-grids échoué :', err);
  process.exit(1);
});
