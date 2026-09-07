import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity';
import { Team } from '../teams/entities/team.entity';
import { Technician } from '../technicians/entities/technician.entity';

/**
 * Agent Planning : PROPOSE une affectation (équipe/techniciens) — jamais
 * d'affectation automatique. Score = zone matching + charge + compétences.
 */
@Injectable()
export class AgentPlanningService {
  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
  ) {}

  async suggestAssignment(companyId: string, missionId: string) {
    const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');

    const [teams, technicians] = await Promise.all([
      this.teamRepository.find({ where: { companyId, active: true } }),
      this.technicianRepository.find({ where: { companyId, active: true } }),
    ]);
    const missionCounts = await this.missionRepository
      .createQueryBuilder('m')
      .select('m.team_id', 'teamId')
      .addSelect('COUNT(*)', 'count')
      .where('m.company_id = :companyId AND m.team_id IS NOT NULL AND m.status IN (:...st)', {
        companyId,
        st: ['planifiee', 'en_cours'],
      })
      .groupBy('m.team_id')
      .getRawMany();
    const loadByTeam = new Map(missionCounts.map((r) => [r.teamId, Number(r.count)]));

    const scored = teams
      .map((team) => {
        let score = 0;
        const reasons: string[] = [];
        if (mission.zone && team.zone && mission.zone.toLowerCase() === team.zone.toLowerCase()) {
          score += 5;
          reasons.push(`zone identique (${team.zone})`);
        }
        const typeMap: Record<string, string> = {
          INSTALLATION: 'PROD', DEPLOIEMENT: 'PROD', DENSIFICATION: 'PROD',
          SAV: 'SAV', INFRA: 'INFRA', EXTENSION: 'EXTENSION',
        };
        if (typeMap[mission.typeTache] === team.type) {
          score += 4;
          reasons.push(`type d'équipe adapté (${team.type})`);
        }
        const leader = technicians.find((t) => t.teamId === team.id && t.isTeamLeader);
        if (leader?.competences?.includes(mission.typeTache)) {
          score += 3;
          reasons.push(`chef d'équipe compétent (${leader.fullName})`);
        }
        const load = loadByTeam.get(team.id) ?? 0;
        score -= load;
        reasons.push(`charge courante : ${load} mission(s)`);
        return { team, score, reasons };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const binome = technicians
      .filter((t) => t.teamId === best?.team.id && t.active)
      .sort((a, b) => Number(b.isTeamLeader) - Number(a.isTeamLeader))
      .slice(0, 2);

    return {
      missionId: mission.id,
      proposal: best
        ? {
            teamId: best.team.id,
            teamName: best.team.name,
            technicians: binome.map((t) => ({ id: t.id, fullName: t.fullName, isTeamLeader: t.isTeamLeader })),
            confidence: Math.min(95, 55 + best.score * 5),
            reasons: best.reasons,
          }
        : null,
      alternatives: scored.slice(1, 3).map((s) => ({ teamName: s.team.name, score: s.score })),
      autoExecute: false,
      note: 'Proposition IA — affectation réelle après validation du planificateur',
    };
  }

  async suggestAll(companyId: string) {
    const unassigned = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :companyId AND m.team_id IS NULL AND m.status = :st', { companyId, st: 'planifiee' })
      .getMany();
    const proposals = [];
    for (const mission of unassigned) {
      proposals.push(await this.suggestAssignment(companyId, mission.id));
    }
    return { count: proposals.length, proposals, autoExecute: false };
  }
}
