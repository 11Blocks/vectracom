import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { DENSIF_TEMPLATE, SURVEY_OSM_TEMPLATE } from '../src/modules/site-checklist/templates/real-templates';

dotenv.config();

/**
 * Lot P2 — remplace les templates de fiches de chantier DENSIF et SURVEY_OSM
 * par les versions réelles 3STB/SONATEL (bande métrique, mesures 1310/1550 nm,
 * pré-recette, double signature ; infrastructures, état GC, besoins).
 */
async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    entities: [__dirname + '/../src/modules/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();
  const repo = dataSource.getRepository('SiteChecklistTemplate');

  const companies = await dataSource.query('SELECT id, name FROM companies WHERE id IS NOT NULL');
  for (const company of companies) {
    for (const template of [DENSIF_TEMPLATE, SURVEY_OSM_TEMPLATE]) {
      const existing = await repo.findOne({
        where: { companyId: company.id, templateType: template.templateType },
      });
      if (existing) {
        existing.label = template.label;
        existing.description = template.description;
        existing.sections = template.sections as never;
        await repo.save(existing);
        console.log(`  ${company.name}: ${template.templateType} mis à jour (${template.sections.length} sections)`);
      } else {
        await repo.save(
          repo.create({
            companyId: company.id,
            templateType: template.templateType,
            label: template.label,
            description: template.description,
            sections: template.sections as never,
            requiredPhotos: [],
          }),
        );
        console.log(`  ${company.name}: ${template.templateType} créé`);
      }
    }
  }
  console.log('=== Templates réels P2 seedés ===');
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('seed-real-templates échoué :', err);
  process.exit(1);
});
