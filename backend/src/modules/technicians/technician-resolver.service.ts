import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Technician } from './entities/technician.entity';
import { Team } from '../teams/entities/team.entity';

export interface ResolveResult {
  teamId: string | null;
  technicianIds: string[];
  createdTeam: boolean;
  createdTechnicians: string[];
}

/**
 * Résolution des libellés issus de l'import SONATEL (Phase 2) :
 * « Alpha » + « Ndiaye M., Sow A. » → teamId + technicianIds réels.
 * Find-or-create : l'équipe inconnue est créée (type PROD par défaut),
 * les techniciens inconnus sont créés et rattachés.
 */
@Injectable()
export class TechnicianResolverService {
  private readonly logger = new Logger(TechnicianResolverService.name);

  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  /** Normalisation insensible à la casse/accents/espaces multiples. */
  static normalize(label: string): string {
    return label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  async resolve(
    companyId: string,
    teamLabel: string | null | undefined,
    technicianLabels: string[],
  ): Promise<ResolveResult> {
    let teamId: string | null = null;
    let createdTeam = false;

    if (teamLabel && teamLabel.trim()) {
      const team = await this.findOrCreateTeam(companyId, teamLabel.trim());
      teamId = team.id;
      createdTeam = team.created;
    }

    const technicianIds: string[] = [];
    const createdTechnicians: string[] = [];

    for (const label of technicianLabels.filter((l) => l && l.trim())) {
      const tech = await this.findOrCreateTechnician(companyId, teamId, label.trim());
      technicianIds.push(tech.id);
      if (tech.created) createdTechnicians.push(tech.id);
    }

    if (createdTeam || createdTechnicians.length > 0) {
      this.logger.log(
        `Résolution import : équipe ${teamLabel}${createdTeam ? ' (créée)' : ''}, ` +
          `${createdTechnicians.length} technicien(s) créé(s) sur ${technicianIds.length}`,
      );
    }

    return { teamId, technicianIds, createdTeam, createdTechnicians };
  }

  private async findOrCreateTeam(companyId: string, label: string): Promise<{ id: string; created: boolean }> {
    const all = await this.teamRepository.find({ where: { companyId }, select: ['id', 'name'] });
    const normalized = TechnicianResolverService.normalize(label);
    const match = all.find((t) => TechnicianResolverService.normalize(t.name) === normalized);
    if (match) return { id: match.id, created: false };

    const team = await this.teamRepository.save(
      this.teamRepository.create({
        companyId,
        name: label,
        type: 'PROD',
        zone: null,
      }),
    );
    return { id: team.id, created: true };
  }

  private async findOrCreateTechnician(
    companyId: string,
    teamId: string | null,
    label: string,
  ): Promise<{ id: string; created: boolean }> {
    const normalized = TechnicianResolverService.normalize(label);

    // Recherche par préfixe : « Ndiaye M. » ≈ « Ndiaye Moussa » (prénom abrégé
    // fréquent dans les fichiers SONATEL), à équipe identique si connue.
    const qb = this.technicianRepository
      .createQueryBuilder('tech')
      .where('tech.company_id = :companyId', { companyId })
      .andWhere(`translate(lower(tech.full_name), 'áàâäéèêëíìîïóòôöúùûü', 'aaaaeeeeiiiioooouuuu') LIKE :prefix || '%'`, { prefix: `${normalized.split(' ')[0]}%` });
    if (teamId) qb.andWhere('tech.team_id = :teamId', { teamId: teamId });
    const candidate = await qb.getOne();
    if (candidate) return { id: candidate.id, created: false };

    if (!teamId) {
      // Technicien sans équipe connue : rattaché à une équipe « (hors équipe) ».
      const fallback = await this.findOrCreateTeam(companyId, '(hors équipe)');
      const tech = await this.technicianRepository.save(
        this.technicianRepository.create({ companyId, teamId: fallback.id, fullName: label }),
      );
      return { id: tech.id, created: true };
    }

    const tech = await this.technicianRepository.save(
      this.technicianRepository.create({ companyId, teamId, fullName: label }),
    );
    return { id: tech.id, created: true };
  }
}
