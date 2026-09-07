import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Vehicle } from '../src/modules/vehicles/entities/vehicle.entity';
import { Warehouse } from '../src/modules/stock/entities/warehouse.entity';
import { Team } from '../src/modules/teams/entities/team.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

function dateIn(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Véhicules de démonstration ONECOMIT — échéances variées pour les 3 badges. */
const VEHICULES = [
  { immatriculation: 'DK-4521-AB', modele: 'Toyota Hilux', zone: 'Dakar', team: 'Alpha', kilometrage: 84500, insurance: 45, inspection: 20, maintenance: 100000 },
  { immatriculation: 'DK-8832-CD', modele: 'Renault Kangoo', zone: 'Mbour', team: 'Beta', kilometrage: 128300, insurance: 5, inspection: 90, maintenance: 130000 },
  { immatriculation: 'TH-1107-EF', modele: 'Peugeot Partner', zone: 'Thies', team: 'Gamma', kilometrage: 67150, insurance: 200, inspection: 3, maintenance: 80000 },
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

  const vehicleRepo = dataSource.getRepository(Vehicle);
  const warehouseRepo = dataSource.getRepository(Warehouse);
  const teamRepo = dataSource.getRepository(Team);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const v of VEHICULES) {
      const existing = await vehicleRepo.findOne({
        where: { companyId: company.id, immatriculation: v.immatriculation },
      });
      if (existing) continue;

      const team = await teamRepo.findOne({ where: { companyId: company.id, name: v.team } });
      await dataSource.transaction(async (em) => {
        const warehouse = await em.save(Warehouse, {
          companyId: company.id,
          type: 'VEHICLE',
          name: v.immatriculation,
          zone: v.zone,
        });
        await em.save(Vehicle, {
          companyId: company.id,
          warehouseId: warehouse.id,
          immatriculation: v.immatriculation,
          modele: v.modele,
          teamId: team?.id ?? null,
          technicianId: null,
          kilometrage: v.kilometrage,
          insuranceExpiration: dateIn(v.insurance),
          technicalInspectionExpiration: dateIn(v.inspection),
          nextMaintenanceKm: v.maintenance,
          monthlyCost: '180000',
          status: 'disponible',
        });
      });
      created++;
    }
  }
  console.log(`Véhicules seedés : ${created} créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
