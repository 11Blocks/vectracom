import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Attendance } from '../src/modules/hr/entities/attendance.entity';
import { Technician } from '../src/modules/technicians/entities/technician.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Lundi de la semaine courante (UTC). */
function currentMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: process.env.NODE_ENV !== 'production',
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await dataSource.initialize();

  const attendanceRepo = dataSource.getRepository(Attendance);
  const techRepo = dataSource.getRepository(Technician);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  const weekStart = currentMonday();
  let created = 0;
  for (const company of companies) {
    const technicians = await techRepo.find({ where: { companyId: company.id } });
    for (const tech of technicians) {
      const existing = await attendanceRepo.findOne({
        where: { companyId: company.id, technicianId: tech.id, weekStart },
      });
      if (existing) continue;
      await attendanceRepo.insert({
        companyId: company.id,
        technicianId: tech.id,
        weekStart,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: tech.isTeamLeader, // les chefs travaillent le samedi
        sunday: false,
        comments: null,
      } as never);
      created++;
    }
  }
  console.log(`Présence seedée : ${created} feuille(s) (${weekStart}) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
