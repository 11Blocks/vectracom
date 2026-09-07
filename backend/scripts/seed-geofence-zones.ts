import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { GeofenceZone } from '../src/modules/geolocation/entities/geofence-zone.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Zones géofence démo (Dakar / Mbour) — idempotent par (companyId, name). */
const ZONES = [
  {
    name: 'Dakar Plateau',
    type: 'zone_travail' as const,
    centerLatitude: '14.6928000',
    centerLongitude: '-17.4467000',
    radiusM: 2500,
    note: 'Zone de travail démo Dakar',
  },
  {
    name: 'Mbour Centre',
    type: 'zone_travail' as const,
    centerLatitude: '14.4197000',
    centerLongitude: '-16.9667000',
    radiusM: 3000,
    note: 'Zone de travail démo Mbour',
  },
  {
    name: 'Dépôt Dakar',
    type: 'depot' as const,
    centerLatitude: '14.7167000',
    centerLongitude: '-17.4677000',
    radiusM: 400,
    note: 'Entrepôt / départ équipes',
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

  const zoneRepo = dataSource.getRepository(GeofenceZone);
  const companies = await dataSource.getRepository(Company).find({ select: ['id', 'name'] });

  let created = 0;
  for (const company of companies) {
    for (const z of ZONES) {
      const existing = await zoneRepo.findOne({ where: { companyId: company.id, name: z.name } });
      if (existing) continue;
      await zoneRepo.save(
        zoneRepo.create({
          companyId: company.id,
          name: z.name,
          type: z.type,
          centerLatitude: z.centerLatitude,
          centerLongitude: z.centerLongitude,
          radiusM: z.radiusM,
          note: z.note,
          active: true,
        }),
      );
      created++;
    }
  }

  console.log(`Zones géofence : ${created} créée(s) sur ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
