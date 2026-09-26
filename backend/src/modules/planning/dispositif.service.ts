import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DispositifEntry } from './entities/dispositif-entry.entity';
import { Team } from '../teams/entities/team.entity';
import { Mission } from '../missions/entities/mission.entity';
import { SettingsService } from '../settings/settings.service';

/**
 * Lot P6 — Service du dispositif quotidien :
 * - grille « qui travaille où » (zones × équipes × axes) ;
 * - répartition automatique ÉQUITABLE des missions non affectées (l'IA
 *   propose, l'humain valide : jamais d'application automatique) ;
 * - export au format de la feuille DISPOSITIF du fichier SONATEL.
 */
@Injectable()
export class DispositifService {
  private readonly logger = new Logger(DispositifService.name);

  constructor(
    @InjectRepository(DispositifEntry)
    private readonly entryRepository: Repository<DispositifEntry>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    private readonly settings: SettingsService,
  ) {}

  /** Grille du jour (ou d'une date donnée). */
  async grid(companyId: string, day?: string) {
    const d = (day ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const entries = await this.entryRepository.find({
      where: { companyId, day: d },
      order: { zoneName: 'ASC' },
    });
    const byZone = new Map<string, DispositifEntry[]>();
    for (const e of entries) {
      byZone.set(e.zoneName, [...(byZone.get(e.zoneName) ?? []), e]);
    }
    return {
      day: d,
      zones: [...byZone.entries()].map(([zone, rows]) => ({
        zone,
        instances: rows.reduce((s, r) => s + r.instances, 0),
        teams: rows,
      })),
    };
  }

  /** Ajoute une affectation à la grille (idempotent par zone+équipe). */
  async upsertEntry(
    companyId: string,
    dto: { day: string; zoneName: string; teamName: string; axis?: string; teamId?: string; pilot?: string; instances?: number },
  ) {
    const day = dto.day.slice(0, 10);
    if (dto.teamId && !(await this.teamRepository.findOne({ where: { companyId, id: dto.teamId } }))) {
      throw new BadRequestException('Équipe introuvable pour ce tenant');
    }
    let entry = await this.entryRepository.findOne({
      where: { companyId, day, zoneName: dto.zoneName, teamName: dto.teamName },
    });
    if (!entry) {
      entry = this.entryRepository.create({ companyId, day, zoneName: dto.zoneName, teamName: dto.teamName });
    }
    entry.axis = dto.axis ?? entry.axis ?? null;
    entry.teamId = dto.teamId ?? entry.teamId ?? null;
    entry.pilot = dto.pilot ?? entry.pilot ?? null;
    entry.instances = dto.instances ?? entry.instances ?? 1;
    return this.entryRepository.save(entry);
  }

  async removeEntry(companyId: string, id: string) {
    const entry = await this.entryRepository.findOne({ where: { companyId, id } });
    if (!entry) throw new BadRequestException('Entrée de dispositif introuvable');
    await this.entryRepository.remove(entry);
    return { deleted: true };
  }

  /**
   * Répartition automatique ÉQUITABLE des missions non affectées du jour
   * (document ERP : « répartition uniforme, anti-répétition, contraintes »).
   * PROPOSITION SEULEMENT : renvoie affectations proposées, n'écrit rien.
   */
  async proposeAssignment(companyId: string, day?: string, options?: { typeFilter?: string[] }) {
    const d = (day ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

    // Missions du jour ouvertes et sans équipe (SURCH en priorité).
    const missions = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :cid', { cid: companyId })
      .andWhere("m.status IN ('planifiee','a_completer')")
      .andWhere('m.date_mission::date = :d', { d })
      .andWhere('m.team_id IS NULL')
      .orderBy('m.surcharge', 'DESC')
      .addOrderBy('m.age_days', 'DESC')
      .getMany();
    const pool = options?.typeFilter?.length
      ? missions.filter((m) => options.typeFilter!.includes(m.typeTache))
      : missions;

    // Équipes actives du jour : capacité = zones du dispositif, charge = missions déjà affectées.
    const teams = await this.teamRepository.find({ where: { companyId, active: true } });
    const dispositif = await this.entryRepository.find({ where: { companyId, day: d } });
    const assigned = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :cid', { cid: companyId })
      .andWhere("m.status IN ('planifiee','en_cours','a_completer')")
      .andWhere('m.date_mission::date = :d', { d })
      .andWhere('m.team_id IS NOT NULL')
      .getMany();
    const loadByTeam = new Map<string, number>();
    for (const m of assigned) loadByTeam.set(m.teamId!, (loadByTeam.get(m.teamId!) ?? 0) + 1);

    // Anti-répétition : historique 7 jours — une équipe surchargée hier est dépriorisée.
    const weekAgo = new Date(new Date(d).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const history = await this.missionRepository
      .createQueryBuilder('m')
      .where('m.company_id = :cid', { cid: companyId })
      .andWhere('m.date_mission::date BETWEEN :from AND :to', { from: weekAgo, to: d })
      .andWhere('m.team_id IS NOT NULL')
      .getMany();
    const weekLoad = new Map<string, number>();
    for (const m of history) weekLoad.set(m.teamId!, (weekLoad.get(m.teamId!) ?? 0) + 1);

    // Score = charge du jour ×2 + charge semaine — la moins chargée d'abord.
    const proposals: Array<{ missionId: string; dossier: string | null; client: string; zone: string | null; surcharge: boolean; suggestedTeamId: string; suggestedTeamName: string; reason: string }> = [];
    const taken = new Set<string>();

    for (const mission of pool) {
      // Zones du dispositif d'abord : équipe déjà positionnée sur la zone de la mission.
      const zoneTeams = dispositif
        .filter((e) => mission.zone && e.zoneName.toUpperCase().includes(mission.zone.toUpperCase()))
        .map((e) => e.teamId)
        .filter((t): t is string => !!t);
      const candidates = teams
        .map((t) => ({
          team: t,
          score: (loadByTeam.get(t.id) ?? 0) * 2 + (weekLoad.get(t.id) ?? 0) - (zoneTeams.includes(t.id) ? 3 : 0),
        }))
        .filter((c) => !taken.has(c.team.id) || teams.length === 1)
        .sort((a, b) => a.score - b.score);
      if (candidates.length === 0) continue;
      const best = candidates[0];
      proposals.push({
        missionId: mission.id,
        dossier: mission.sonatelDossierNumber,
        client: mission.clientSite,
        zone: mission.zone,
        surcharge: mission.surcharge,
        suggestedTeamId: best.team.id,
        suggestedTeamName: best.team.name,
        reason: zoneTeams.includes(best.team.id)
          ? `Équipe positionnée sur la zone ${mission.zone} au dispositif du jour`
          : `Équipe la moins chargée (jour ${(loadByTeam.get(best.team.id) ?? 0)} / semaine ${(weekLoad.get(best.team.id) ?? 0)})`,
      });
      loadByTeam.set(best.team.id, (loadByTeam.get(best.team.id) ?? 0) + 1);
    }

    return {
      day: d,
      unassignedCount: pool.length,
      teamsCount: teams.length,
      proposals,
      disclaimer: 'Proposition automatique — aucune mission n\'est affectée sans validation humaine.',
    };
  }

  /**
   * Application des propositions validées (l'humain a coché).
   * Règle de sécurité : équipe active requise, pas de double affectation
   * d'une même équipe sur un même créneau jour (réutilise la règle P1).
   */
  async applyAssignment(
    companyId: string,
    assignments: Array<{ missionId: string; teamId: string }>,
    userId: string | null,
  ) {
    let applied = 0;
    const skipped: string[] = [];
    const teamIds = [...new Set(assignments.map((a) => a.teamId))];
    const teams = teamIds.length > 0 ? await this.teamRepository.find({ where: { companyId, id: In(teamIds) } }) : [];
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const capacity = await this.settings.getTeamDailyCapacity(companyId);

    for (const { missionId, teamId } of assignments) {
      const mission = await this.missionRepository.findOne({ where: { companyId, id: missionId } });
      if (!mission || mission.teamId) {
        skipped.push(missionId);
        continue;
      }
      const team = teamById.get(teamId);
      if (!team || !team.active) {
        skipped.push(missionId);
        continue;
      }
      // Capacité journalière de l'équipe (Paramètres → Missions, 0 = illimité).
      const load = await this.missionRepository
        .createQueryBuilder('m')
        .where('m.company_id = :cid AND m.team_id = :tid AND m.id != :mid', { cid: companyId, tid: teamId, mid: missionId })
        .andWhere("m.status IN ('planifiee','en_cours','a_completer')")
        .andWhere('m.date_mission::date = :d', { d: new Date(mission.dateMission).toISOString().slice(0, 10) })
        .getCount();
      if (capacity > 0 && load >= capacity) {
        skipped.push(missionId);
        continue;
      }
      mission.teamId = teamId;
      mission.importMeta = {
        ...mission.importMeta,
        teamLabel: team.name,
        teamAssignedBy: 'auto',
        sourceFile: `repartition-auto:${new Date().toISOString().slice(0, 10)}:${userId ?? 'système'}`,
      };
      await this.missionRepository.save(mission);
      applied++;
    }
    this.logger.log(`Répartition appliquée : ${applied} affectée(s), ${skipped.length} ignorée(s)`);
    return { applied, skipped };
  }
}
