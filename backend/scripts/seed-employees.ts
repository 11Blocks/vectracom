import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Employee } from '../src/modules/hr/entities/employee.entity';
import { Team } from '../src/modules/teams/entities/team.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/** Employés de démonstration (staff + terrain). */
const EMPLOYES = [
  { fullName: 'Aminata Diop', jobTitle: 'Responsable administrative', matricule: 'ONE-ADM-001', team: null as string | null, status: 'actif' as const, docs: ['CNI', 'CONTRAT', 'CV'] },
  { fullName: 'Moussa Ndiaye', jobTitle: 'Chef d\'équipe FTTH', matricule: 'ONE-TER-014', team: 'Alpha', status: 'actif' as const, docs: ['CNI', 'CONTRAT', 'DIPLOME', 'PERMIS'] },
  { fullName: 'Abdallahi Sow', jobTitle: 'Technicien FTTH', matricule: 'ONE-TER-015', team: 'Alpha', status: 'actif' as const, docs: ['CNI', 'CONTRAT', 'ATTESTATION'] },
  { fullName: 'Ibrahima Diop', jobTitle: 'Chef d\'équipe SAV', matricule: 'ONE-TER-021', team: 'Beta', status: 'actif' as const, docs: ['CNI', 'CONTRAT', 'DIPLOME'] },
  { fullName: 'Fatou Sarr', jobTitle: 'Chef d\'quipe EXTENSION', matricule: 'ONE-TER-032', team: 'Delta', status: 'actif' as const, docs: ['CNI', 'CONTRAT', 'CERTIFICAT'] },
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

  const employeeRepo = dataSource.getRepository(Employee);
  const teamRepo = dataSource.getRepository(Team);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const e of EMPLOYES) {
      const existing = await employeeRepo.findOne({
        where: { companyId: company.id, matricule: e.matricule },
      });
      if (existing) continue;
      const team = e.team
        ? await teamRepo.findOne({ where: { companyId: company.id, name: e.team } })
        : null;
      await employeeRepo.insert({
        companyId: company.id,
        fullName: e.fullName,
        jobTitle: e.jobTitle,
        teamId: team?.id ?? null,
        vehicleId: null,
        matricule: e.matricule,
        status: e.status,
        habilitationExpiration: '2027-03-15',
        documents: e.docs.map((type) => ({ type, fileUrl: `https://cdn/docs/${e.matricule}-${type.toLowerCase()}.pdf` })),
      } as never);
      created++;
    }
  }
  console.log(`Employés seedés : ${created} créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
