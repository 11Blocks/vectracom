/**
 * ITM-1 (11/11/2026) — validations d'un Item (domaine métier), fonctions pures.
 *
 *  - missionTypes : liste fermée MISSION_TYPES, sans doublon, et un type ne peut
 *    appartenir qu'à UN item du tenant (la navigation par item doit être univoque) ;
 *  - teamComposition : rôles de la liste fermée EQUIPE_ROLES, un rôle au plus une fois,
 *    effectif entier de 1 à MAX_ROLE_COUNT.
 */
import { MISSION_TYPES } from '../missions/entities/mission-type-template.entity';
import { EQUIPE_ROLES, TeamRoleComposition } from './entities/item.entity';

export const MAX_ROLE_COUNT = 50;

const KNOWN_TYPES = new Set<string>(MISSION_TYPES);
const KNOWN_ROLES = new Set<string>(EQUIPE_ROLES);

export interface ItemLike {
  id: string;
  code: string;
  missionTypes: string[];
}

/** Problèmes de la liste de types d'un item, face aux autres items du tenant. */
export function findMissionTypeProblems(missionTypes: unknown, selfId: string | null, others: ItemLike[]): string[] {
  if (!Array.isArray(missionTypes)) return ['missionTypes doit être une liste'];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const t of missionTypes) {
    if (typeof t !== 'string' || !KNOWN_TYPES.has(t)) {
      problems.push(`Type de mission inconnu : ${String(t)}`);
      continue;
    }
    if (seen.has(t)) problems.push(`Type de mission en double : ${t}`);
    seen.add(t);
    const owner = others.find((o) => o.id !== selfId && (o.missionTypes ?? []).includes(t));
    if (owner) problems.push(`Le type ${t} appartient déjà à l'item ${owner.code}`);
  }
  return problems;
}

/** Problèmes d'une composition d'équipe. */
export function findCompositionProblems(teamComposition: unknown): string[] {
  if (!Array.isArray(teamComposition)) return ['teamComposition doit être une liste'];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of teamComposition as Array<Partial<TeamRoleComposition>>) {
    const role = row?.role;
    if (typeof role !== 'string' || !KNOWN_ROLES.has(role)) {
      problems.push(`Rôle inconnu : ${String(role)}`);
      continue;
    }
    if (seen.has(role)) problems.push(`Rôle en double : ${role}`);
    seen.add(role);
    const n = row.count;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_ROLE_COUNT) {
      problems.push(`Effectif invalide pour ${role} (entier de 1 à ${MAX_ROLE_COUNT})`);
    }
  }
  return problems;
}

/** Ne garde que { role, count } (supprime tout champ inattendu). */
export function normalizeComposition(teamComposition: TeamRoleComposition[]): TeamRoleComposition[] {
  return teamComposition.map(({ role, count }) => ({ role, count }));
}
