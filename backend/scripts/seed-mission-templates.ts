import 'reflect-metadata';
import { DataSource, In } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { MissionTypeTemplate } from '../src/modules/missions/entities/mission-type-template.entity';
import { DEFAULT_MISSION_TEMPLATES } from '../src/modules/missions/mission-templates.service';
import { Company } from '../src/modules/auth/entities/company.entity';
import { MISSION_TYPES } from '../src/modules/missions/entities/mission-type-template.entity';

dotenv.config();

/**
 * Matérialise les 11 templates par défaut pour chaque tenant existant
 * (les tenants créés ensuite y accèdent via le repli getEffective — ce seed
 * n'est donc nécessaire que pour éditer/inspecter les templates en base).
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: process.env.NODE_ENV !== 'production',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const companies = await dataSource.getRepository(Company).find({ select: ['id', 'name'] });
  if (companies.length === 0) {
    console.log('Aucun tenant — rien à seeder (les défauts servent de repli).');
    await dataSource.destroy();
    return;
  }

  const repo = dataSource.getRepository(MissionTypeTemplate);
  let created = 0;
  for (const company of companies) {
    const existing = await repo.find({
      where: { companyId: company.id, typeName: In([...MISSION_TYPES]) },
      select: ['typeName'],
    });
    const existingTypes = new Set(existing.map((t) => t.typeName));

    for (const def of DEFAULT_MISSION_TEMPLATES) {
      if (existingTypes.has(def.typeName)) continue;
      await repo.insert({
        companyId: company.id,
        typeName: def.typeName,
        label: def.label,
        description: def.description,
        steps: def.steps,
        requiredPhotos: def.requiredPhotos,
        checklistTemplate: def.checklistTemplate,
        workflow: def.workflow,
        isActive: true,
      });
      created++;
    }
  }

  console.log(`Templates seedés : ${created} insérés pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
