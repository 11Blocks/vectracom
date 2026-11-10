/**
 * Cascade tarifaire multi-niveaux — fonctions pures (aucun accès base).
 *
 * Règles métier (décisions Moussa, 10/11/2026) :
 *  - chaque maillon parent → enfant reverse `percentage` % du montant reçu ;
 *  - arrondi AU FRANC à chaque étape (comme les factures) :
 *      27 000 × 65 % = 17 550 ; 17 550 × 80 % = 14 040 ; 17 550 × 87 % = 15 268,5 → 15 269 ;
 *  - la règle la plus précise l'emporte : prestation + item > prestation > item > défaut ;
 *  - une règle ne compte que si elle est active et que la date est dans [effectiveFrom, effectiveTo] ;
 *  - quand un partenaire a plusieurs sous-traitants, le partenaire final doit être choisi.
 */
import { isKnownPrestation } from './prestations';

export interface CascadeRule {
  id: string;
  parentPartnerId: string;
  childPartnerId: string;
  itemId: string | null;
  prestationKey: string | null;
  /** En %, ex. 65 ou 87.5 (2 décimales au plus). */
  percentage: number;
  /** YYYY-MM-DD, inclus. */
  effectiveFrom: string | null;
  /** YYYY-MM-DD, inclus. */
  effectiveTo: string | null;
  active: boolean;
}

export interface CascadeQuery {
  fromPartnerId: string;
  /** Obligatoire dès qu'un maillon a plusieurs sous-traitants possibles. */
  toPartnerId?: string | null;
  itemId?: string | null;
  prestationKey?: string | null;
  /** Montant de départ en FCFA (entier ≥ 0). */
  basePrice: number;
  /** Date de référence YYYY-MM-DD. */
  date: string;
}

export type RuleScope = 'prestation_item' | 'prestation' | 'item' | 'defaut';

export interface CascadeStep {
  parentPartnerId: string;
  childPartnerId: string;
  ruleId: string;
  percentage: number;
  scope: RuleScope;
  amountIn: number;
  amountOut: number;
}

export interface CascadeResult {
  basePrice: number;
  finalPartnerId: string;
  finalAmount: number;
  steps: CascadeStep[];
}

export type CascadeErrorCode = 'ENTREE_INVALIDE' | 'CYCLE' | 'MAILLON_MANQUANT' | 'EMBRANCHEMENT' | 'CONFLIT';

export class CascadeError extends Error {
  constructor(
    public readonly code: CascadeErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CascadeError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STEPS = 50;

export function isEffective(rule: CascadeRule, date: string): boolean {
  if (!rule.active) return false;
  if (rule.effectiveFrom && rule.effectiveFrom > date) return false;
  if (rule.effectiveTo && rule.effectiveTo < date) return false;
  return true;
}

/** La règle s'applique-t-elle à la prestation / l'item demandés ? */
function matchesScope(rule: CascadeRule, q: Pick<CascadeQuery, 'itemId' | 'prestationKey'>): boolean {
  if (rule.prestationKey !== null && rule.prestationKey !== (q.prestationKey ?? null)) return false;
  if (rule.itemId !== null && rule.itemId !== (q.itemId ?? null)) return false;
  return true;
}

export function ruleScope(rule: Pick<CascadeRule, 'itemId' | 'prestationKey'>): RuleScope {
  if (rule.prestationKey && rule.itemId) return 'prestation_item';
  if (rule.prestationKey) return 'prestation';
  if (rule.itemId) return 'item';
  return 'defaut';
}

const SPECIFICITY: Record<RuleScope, number> = { prestation_item: 3, prestation: 2, item: 1, defaut: 0 };

/**
 * Pour un parent, la règle retenue vers chaque enfant possible
 * (règles effectives à la date et applicables à la prestation/item).
 */
function edgesFrom(rules: CascadeRule[], parentId: string, q: CascadeQuery): Map<string, CascadeRule> {
  const byChild = new Map<string, CascadeRule[]>();
  for (const r of rules) {
    if (r.parentPartnerId !== parentId || !isEffective(r, q.date) || !matchesScope(r, q)) continue;
    const list = byChild.get(r.childPartnerId) ?? [];
    list.push(r);
    byChild.set(r.childPartnerId, list);
  }
  const edges = new Map<string, CascadeRule>();
  for (const [child, list] of byChild) {
    const best = Math.max(...list.map((r) => SPECIFICITY[ruleScope(r)]));
    const top = list.filter((r) => SPECIFICITY[ruleScope(r)] === best);
    if (top.length > 1) {
      throw new CascadeError(
        'CONFLIT',
        'Plusieurs règles de même précision s’appliquent au même maillon',
        { parentPartnerId: parentId, childPartnerId: child, ruleIds: top.map((r) => r.id) },
      );
    }
    edges.set(child, top[0]);
  }
  return edges;
}

/** `target` est-il atteignable depuis `start` (chemin d'au moins 0 maillon) ? */
function canReach(rules: CascadeRule[], start: string, target: string, q: CascadeQuery): boolean {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === target) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const child of edgesFrom(rules, node, q).keys()) stack.push(child);
  }
  return false;
}

/** Montant reversé, arrondi au franc (arithmétique entière : pourcentage à 2 décimales). */
export function applyPercentage(amount: number, percentage: number): number {
  const pctCents = Math.round(percentage * 100);
  return Math.round((amount * pctCents) / 10_000);
}

export function computeCascade(rules: CascadeRule[], q: CascadeQuery): CascadeResult {
  if (!Number.isInteger(q.basePrice) || q.basePrice < 0) {
    throw new CascadeError('ENTREE_INVALIDE', 'Le montant de départ doit être un entier ≥ 0 (FCFA)');
  }
  if (!DATE_RE.test(q.date)) {
    throw new CascadeError('ENTREE_INVALIDE', 'Date invalide (attendu YYYY-MM-DD)');
  }
  if (q.prestationKey && !isKnownPrestation(q.prestationKey)) {
    throw new CascadeError('ENTREE_INVALIDE', `Prestation inconnue : ${q.prestationKey}`);
  }

  const target = q.toPartnerId ?? null;
  const steps: CascadeStep[] = [];
  const visited = new Set<string>([q.fromPartnerId]);
  let current = q.fromPartnerId;
  let amount = q.basePrice;

  while (target === null || current !== target) {
    if (steps.length >= MAX_STEPS) {
      throw new CascadeError('CYCLE', 'Chaîne trop longue : cycle probable', { partnerId: current });
    }
    const edges = edgesFrom(rules, current, q);
    let next: string;

    if (target !== null) {
      const candidates = [...edges.keys()].filter((c) => c === target || canReach(rules, c, target, q));
      if (candidates.length === 0) {
        throw new CascadeError('MAILLON_MANQUANT', 'Aucune règle applicable ne mène au partenaire final', {
          partnerId: current,
          toPartnerId: target,
        });
      }
      if (candidates.length > 1) {
        throw new CascadeError('EMBRANCHEMENT', 'Plusieurs chemins mènent au partenaire final', {
          partnerId: current,
          childPartnerIds: candidates,
        });
      }
      next = candidates[0];
    } else {
      if (edges.size === 0) break; // fin de chaîne
      if (edges.size > 1) {
        throw new CascadeError('EMBRANCHEMENT', 'Plusieurs sous-traitants possibles : choisir le partenaire final', {
          partnerId: current,
          childPartnerIds: [...edges.keys()],
        });
      }
      next = [...edges.keys()][0];
    }

    if (visited.has(next)) {
      throw new CascadeError('CYCLE', 'Cycle dans la chaîne de sous-traitance', { partnerId: next });
    }
    const rule = edges.get(next)!;
    const amountOut = applyPercentage(amount, rule.percentage);
    steps.push({
      parentPartnerId: current,
      childPartnerId: next,
      ruleId: rule.id,
      percentage: rule.percentage,
      scope: ruleScope(rule),
      amountIn: amount,
      amountOut,
    });
    amount = amountOut;
    visited.add(next);
    current = next;
  }

  return { basePrice: q.basePrice, finalPartnerId: current, finalAmount: amount, steps };
}

// ---------------------------------------------------------------------------
// Validations d'une règle (création ET modification)
// ---------------------------------------------------------------------------

function periodsOverlap(a: CascadeRule, b: CascadeRule): boolean {
  const aFrom = a.effectiveFrom ?? '0000-01-01';
  const aTo = a.effectiveTo ?? '9999-12-31';
  const bFrom = b.effectiveFrom ?? '0000-01-01';
  const bTo = b.effectiveTo ?? '9999-12-31';
  return aFrom <= bTo && bFrom <= aTo;
}

/** Y a-t-il un chemin `from` → … → `to` dans le graphe (règles actives, toutes dates) ? */
function structuralPath(rules: CascadeRule[], from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === to) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const r of rules) if (r.active && r.parentPartnerId === node) stack.push(r.childPartnerId);
  }
  return false;
}

/**
 * Problèmes d'une règle candidate face aux règles existantes du tenant.
 * `candidate.id` est exclu des comparaisons (cas de la modification).
 * Liste vide = règle valide.
 */
export function findRuleProblems(existing: CascadeRule[], candidate: CascadeRule): string[] {
  const problems: string[] = [];
  const p = candidate.percentage;
  if (!Number.isFinite(p) || p <= 0 || p > 100) problems.push('Pourcentage invalide (doit être > 0 et ≤ 100)');
  if (Number.isFinite(p) && Math.abs(Math.round(p * 100) - p * 100) > 1e-6) problems.push('Pourcentage : 2 décimales au plus');
  if (candidate.parentPartnerId === candidate.childPartnerId) problems.push('Le partenaire amont et le partenaire aval doivent être différents');
  for (const [label, d] of [['début', candidate.effectiveFrom], ['fin', candidate.effectiveTo]] as const) {
    if (d !== null && !DATE_RE.test(d)) problems.push(`Date de ${label} invalide (attendu YYYY-MM-DD)`);
  }
  if (candidate.effectiveFrom && candidate.effectiveTo && candidate.effectiveFrom > candidate.effectiveTo) {
    problems.push('La date de début doit être antérieure ou égale à la date de fin');
  }
  if (candidate.prestationKey !== null && !isKnownPrestation(candidate.prestationKey)) {
    problems.push(`Prestation inconnue : ${candidate.prestationKey}`);
  }

  const others = existing.filter((r) => r.id !== candidate.id);
  if (candidate.active) {
    const overlap = others.find(
      (r) =>
        r.active &&
        r.parentPartnerId === candidate.parentPartnerId &&
        r.childPartnerId === candidate.childPartnerId &&
        r.itemId === candidate.itemId &&
        r.prestationKey === candidate.prestationKey &&
        periodsOverlap(r, candidate),
    );
    if (overlap) problems.push('Une règle identique existe déjà sur une période qui se chevauche');

    if (candidate.parentPartnerId !== candidate.childPartnerId && structuralPath(others, candidate.childPartnerId, candidate.parentPartnerId)) {
      problems.push('Cette règle créerait un cycle dans la chaîne de sous-traitance');
    }
  }
  return problems;
}
