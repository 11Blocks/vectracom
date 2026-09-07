import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { Technician } from '../src/modules/technicians/entities/technician.entity';
import { Team } from '../src/modules/teams/entities/team.entity';
import { Company } from '../src/modules/auth/entities/company.entity';

dotenv.config();

/**
 * Binômes ONECOMIT : un chef d'équipe (isTeamLeader, responsable de la saisie
 * terrain) + son binôme (teamLeaderId pointe vers le chef).
 */
const BINOMES = [
  { team: 'Alpha', leader: 'Ndiaye Moussa', binome: 'Sow Abdallahi', competences: ['DEPLOIEMENT', 'DENSIF'], contract: 'CDI' as const, sst: '2027-03-15', conduite: '2026-12-01' },
  { team: 'Beta', leader: 'Diop Ibrahima', binome: 'Kane Ousmane', competences: ['SAV'], contract: 'CDD' as const, sst: '2026-10-20', conduite: '2027-01-10' },
  { team: 'Gamma', leader: 'Fall Serge', binome: 'Ba Omar', competences: ['EXTENSION', 'GC'], contract: 'PRESTATAIRE' as const, sst: '2027-06-01', conduite: '2026-11-15' },
  { team: 'Delta', leader: 'Sarr Fatou', binome: 'Gueye Malick', competences: ['OSM', 'DEVOIEMENT'], contract: 'CDI' as const, sst: '2027-02-28', conduite: '2027-04-05' },
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

  const techRepo = dataSource.getRepository(Technician);
  const teamRepo = dataSource.getRepository(Team);
  const companies = await dataSource.getRepository(Company).find({ select: ['id'] });

  let created = 0;
  for (const company of companies) {
    for (const b of BINOMES) {
      const team = await teamRepo.findOne({ where: { companyId: company.id, name: b.team } });
      if (!team) continue;

      const existingLeader = await techRepo.findOne({ where: { companyId: company.id, fullName: b.leader } });
      if (existingLeader) continue;

      const leader = await techRepo.save(
        techRepo.create({
          companyId: company.id,
          teamId: team.id,
          fullName: b.leader,
          isTeamLeader: true,
          habilitationSstExpiration: b.sst,
          habilitationConduiteExpiration: b.conduite,
          contractType: b.contract,
          experienceYears: 5,
          competences: b.competences,
          documents: [],
        }),
      );
      await techRepo.save(
        techRepo.create({
          companyId: company.id,
          teamId: team.id,
          fullName: b.binome,
          isTeamLeader: false,
          teamLeaderId: leader.id,
          habilitationSstExpiration: b.sst,
          habilitationConduiteExpiration: b.conduite,
          contractType: b.contract,
          experienceYears: 3,
          competences: b.competences,
          documents: [],
        }),
      );
      created += 2;
    }
  }
  console.log(`Techniciens seedés : ${created} créé(s) pour ${companies.length} tenant(s).`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed échoué :', err);
  process.exit(1);
});
