import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { SiteChecklistTemplate } from '../src/modules/site-checklist/entities/site-checklist-template.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Fiches de chantier numériques — inspirées des fiches Excel ONECOMIT
 * (Fiche de chantier joj Mbour, FICHE CHANTIER 3STB, SURVEY OSM).
 * Les items reliés au bordereau portent priceItem (n° d'item 3STB 2025).
 */
const TEMPLATES: Array<Partial<SiteChecklistTemplate> & { templateType: string }> = [
  {
    templateType: 'OSM',
    label: 'Fiche de chantier OSM — liaison spécialisée',
    description: 'Travaux OSM : tirage transport, raccordement BHS, recette',
    sections: [
      {
        section: 'Identification',
        items: [
          { id: 'olt', label: 'OLT', type: 'text' },
          { id: 'demande', label: 'Demande / Dossier', type: 'text' },
          { id: 'client', label: 'Client', type: 'text' },
          { id: 'nd', label: 'ND', type: 'text' },
          { id: 'dateDebut', label: 'Date début', type: 'date' },
          { id: 'dateFin', label: 'Date fin', type: 'date' },
        ],
      },
      {
        section: 'Travaux réalisés',
        items: [
          { id: 'tirageSouterrain', label: 'Tirage transport souterrain', type: 'number', unit: 'm', priceItem: 42 },
          { id: 'tirage6fo', label: 'Tirage câble 6FO', type: 'number', unit: 'm', priceItem: 43 },
          { id: 'tirage12fo', label: 'Tirage câble 12FO', type: 'number', unit: 'm', priceItem: 44 },
          { id: 'raccordementOsm', label: 'Raccordement liaison OSM', type: 'number', unit: 'u', priceItem: 41 },
          { id: 'soudure', label: 'Soudure fibre', type: 'number', unit: 'brin', priceItem: 30 },
        ],
      },
      {
        section: 'Recette',
        items: [
          { id: 'mesureFibre', label: 'Dossier de mesure fibre (attestation)', type: 'text' },
          { id: 'recetteSurface', label: 'Recette en surface', type: 'boolean' },
          { id: 'reserves', label: 'Réserves émises', type: 'text' },
        ],
      },
    ],
    requiredPhotos: [
      { type: 'depart', label: 'Photo départ', count: 1 },
      { type: 'arrivee', label: "Photo arrivée", count: 1 },
      { type: 'travaux', label: 'Photos travaux', count: 3 },
    ],
  },
  {
    templateType: 'GC',
    label: 'Fiche de chantier GC — génie civil',
    description: 'Tranchées, conduites, réfection, chambres BPE',
    sections: [
      {
        section: 'Identification',
        items: [
          { id: 'zone', label: 'Zone', type: 'text' },
          { id: 'demande', label: 'Demande', type: 'text' },
          { id: 'equipe', label: 'Équipe', type: 'text' },
        ],
      },
      {
        section: 'Travaux',
        items: [
          { id: 'conduiteEnrobee', label: 'Conduite enrobée posée', type: 'number', unit: 'm', priceItem: 10 },
          { id: 'sondage', label: 'Sondage mécanisé', type: 'number', unit: 'm', priceItem: 11 },
          { id: 'fouilleEnrobe', label: 'Ouverture fouille (enrobé)', type: 'number', unit: 'm', priceItem: 12 },
          { id: 'fouilleTerre', label: 'Ouverture fouille (terre)', type: 'number', unit: 'm', priceItem: 13 },
          { id: 'refectionEnrobe', label: 'Réfection enrobé', type: 'number', unit: 'm', priceItem: 14 },
          { id: 'chambreL2t', label: 'Chambre BPE L2T', type: 'number', unit: 'u', priceItem: 16 },
          { id: 'coiffeL2t', label: 'Coiffe L2T', type: 'number', unit: 'u', priceItem: 19 },
          { id: 'guardLine', label: 'Guard-line', type: 'number', unit: 'm', priceItem: 47 },
          { id: 'nettoyageChambre', label: 'Nettoyage chambre', type: 'number', unit: 'u', priceItem: 49 },
        ],
      },
    ],
    requiredPhotos: [
      { type: 'avant', label: 'Avant travaux', count: 1 },
      { type: 'pendant', label: 'Pendant travaux', count: 1 },
      { type: 'apres', label: 'Après travaux', count: 1 },
    ],
  },
  {
    templateType: 'DENSIF',
    label: 'Fiche de densification FTTH',
    description: 'Ajout de points de branchement en zone saturée',
    sections: [
      {
        section: 'Identification',
        items: [
          { id: 'olt', label: 'OLT', type: 'text' },
          { id: 'coper', label: 'COPER', type: 'text' },
          { id: 'nd', label: 'ND', type: 'text' },
          { id: 'client', label: 'Client', type: 'text' },
        ],
      },
      {
        section: 'Travaux',
        items: [
          { id: 'ajoutPointBranchement', label: 'Ajout point de branchement', type: 'number', unit: 'u', priceItem: 50 },
          { id: 'posePboSup', label: 'Pose PBO supplémentaire', type: 'number', unit: 'u', priceItem: 51 },
          { id: 'raccordementPbo', label: 'Raccordement PBO (port client)', type: 'number', unit: 'port', priceItem: 29 },
        ],
      },
    ],
    requiredPhotos: [{ type: 'site', label: 'Photo site', count: 1 }, { type: 'pbo', label: 'Photos nouveaux PBO', count: 2 }],
  },
  {
    templateType: 'SURVEY_OSM',
    label: 'Fiche de survey OSM',
    description: 'Survey tracé : Central, PEP, PEZ/PMZ, plaque, BPE par zone',
    sections: [
      {
        section: 'Tracé',
        items: [
          { id: 'gpsDepart', label: 'GPS départ', type: 'text' },
          { id: 'gpsArrivee', label: "GPS arrivée", type: 'text' },
          { id: 'longueur', label: 'Longueur tracé', type: 'number', unit: 'm' },
        ],
      },
      {
        section: 'Infrastructures par zone',
        items: [
          { id: 'central', label: 'Central', type: 'text' },
          { id: 'pep', label: 'PEP', type: 'text' },
          { id: 'pezPmz', label: 'PEZ/PMZ', type: 'text' },
          { id: 'plaque', label: 'Plaque', type: 'text' },
          { id: 'bpe', label: 'BPE', type: 'text' },
          { id: 'etatGcAerien', label: 'État GC aérien', type: 'select', options: ['bon', 'moyen', 'mauvais'] },
          { id: 'etatGcSouterrain', label: 'État GC souterrain', type: 'select', options: ['bon', 'moyen', 'mauvais'] },
        ],
      },
      {
        section: 'Matériel nécessaire',
        items: [
          { id: 'cable6fo', label: 'Câble 6FO', type: 'number', unit: 'm' },
          { id: 'cable12fo', label: 'Câble 12FO', type: 'number', unit: 'm' },
          { id: 'chambres', label: 'Chambres BPE', type: 'number', unit: 'u' },
        ],
      },
    ],
    requiredPhotos: [{ type: 'tracé', label: 'Tracé GPS', count: 1 }, { type: 'infrastructures', label: 'Infrastructures', count: 1 }],
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

  const repo = dataSource.getRepository(SiteChecklistTemplate);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const t of TEMPLATES) {
      const existing = await repo.findOne({
        where: { companyId: company.id, templateType: t.templateType as never },
      });
      if (existing) continue;
      await repo.insert({ ...t, companyId: company.id } as never);
      created++;
    }
  }
  console.log(`Fiches de chantier : ${created} template(s) créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
