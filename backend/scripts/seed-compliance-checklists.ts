import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { ComplianceChecklistTemplate } from '../src/modules/compliance/entities/checklist-template.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

const item = (label: string, required = true) => ({ label, required });

/** Checklists opérationnelles par type de mission — 100 % paramétrables. */
const CHECKLISTS: Array<{ missionType: string; items: Array<{ label: string; required: boolean }> }> = [
  {
    missionType: 'INSTALLATION',
    items: [
      item('EPI complets portés (casque, gants, gilet, chaussures)'),
      item('Balisage de la zone de travail'),
      item('Photos avant/pendant/après prises'),
      item('Mesure dBm enregistrée'),
      item('Signature client collectée'),
      item('Déchets emportés (D3E)'),
      item('Propreté du site restitution'),
    ],
  },
  {
    missionType: 'SAV',
    items: [
      item('EPI complets portés'),
      item('Diagnostic documenté avant intervention'),
      item('Ancien matériel récupéré et tracé (échange SAV)'),
      item('Test de service validé avec le client'),
      item('Signature client collectée'),
    ],
  },
  {
    missionType: 'OSM',
    items: [
      item('EPI complets portés'),
      item('Autorisation de travaux validée'),
      item('Dossier de mesure fibre (réflectométrie)'),
      item('Recette en surface effectuée'),
      item('Photos départ/arrivée/travaux'),
      item('Défauts GC signalés'),
    ],
  },
  {
    missionType: 'GC',
    items: [
      item('EPI complets portés'),
      item('Signalisation routière posée'),
      item('Tranchées protégées/guard-line'),
      item('Réfection conforme'),
      item('Photos avant/pendant/après'),
      item('Déchets de chantier évacués (D3E)'),
    ],
  },
  {
    missionType: 'DENSIFICATION',
    items: [
      item('EPI complets portés'),
      item('Points de branchement créés conformes au plan'),
      item('Photos des nouveaux PBO'),
      item('Signature client collectée'),
    ],
  },
  {
    missionType: 'SURVEY',
    items: [
      item('EPI complets portés'),
      item('Tracé GPS enregistré'),
      item('Infrastructures identifiées'),
      item('Photos du site'),
    ],
  },
  {
    missionType: 'SURVEY_OSM',
    items: [
      item('EPI complets portés'),
      item('Zones Central/PEP/PEZ-PMZ/plaque/BPE renseignées'),
      item('État GC aéro/souterrain relevé'),
      item('Tracé GPS complet'),
    ],
  },
  {
    missionType: 'INFRA',
    items: [
      item('EPI complets portés'),
      item('Consignation/signalisation'),
      item('Photos avant/pendant/après'),
      item('Test de continuité effectué'),
    ],
  },
  {
    missionType: 'PLANTATION',
    items: [
      item('EPI complets portés'),
      item('Repérage réseaux enterrés effectué'),
      item('Poteau planté conforme (verticalité, profondeur)'),
      item('Photo du poteau planté'),
    ],
  },
  {
    missionType: 'DEVOIEMENT',
    items: [
      item('EPI complets portés'),
      item('Nouveau tracé validé'),
      item('Photos avant/pendant/après'),
      item('Continuité de service vérifiée'),
    ],
  },
  {
    missionType: 'DEPLOIEMENT',
    items: [
      item('EPI complets portés'),
      item('Plan de la nouvelle zone suivi'),
      item('Tirage/pose PBO conformes'),
      item('Photos avant/pendant/après'),
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

  const repo = dataSource.getRepository(ComplianceChecklistTemplate);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const c of CHECKLISTS) {
      const existing = await repo.findOne({ where: { companyId: company.id, missionType: c.missionType } });
      if (existing) continue;
      await repo.insert({ companyId: company.id, missionType: c.missionType, items: c.items });
      created++;
    }
  }
  console.log(`Checklists de conformité : ${created} créée(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
