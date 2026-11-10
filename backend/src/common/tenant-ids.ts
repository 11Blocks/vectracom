import { BadRequestException } from '@nestjs/common';

/**
 * Vérification d'appartenance au tenant des IDs reçus du client.
 *
 * Règle VECTRACOM : tout ID entrant (équipe, zone, pilote, partenaire,
 * technicien, mission, item) doit appartenir au `company_id` du JWT.
 * Un ID inconnu ou appartenant à un autre tenant → 400, sans révéler lequel.
 */

/** Tout objet capable d'exécuter du SQL brut (Repository, EntityManager, DataSource). */
export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<any[]> };

/** Tables autorisées (liste blanche : le nom est injecté dans le SQL). */
const TENANT_TABLES = {
  teams: 'Équipe',
  zones: 'Zone',
  pilotes: 'Pilote',
  items: 'Item',
  partners: 'Partenaire',
  technicians: 'Technicien',
  missions: 'Mission',
  stock_items: 'Article de stock',
} as const;

export type TenantTable = keyof typeof TENANT_TABLES;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lève une 400 si l'un des IDs n'appartient pas au tenant.
 * Les valeurs null/undefined/vides sont ignorées (champ facultatif ou « détacher »).
 */
export async function assertTenantIds(
  db: Queryable,
  companyId: string,
  table: TenantTable,
  ids: string | null | undefined | Array<string | null | undefined>,
): Promise<void> {
  if (!(table in TENANT_TABLES)) throw new Error(`Table non autorisée : ${table}`);
  const label = TENANT_TABLES[table];
  const list = [
    ...new Set(
      (Array.isArray(ids) ? ids : [ids]).filter((x): x is string => typeof x === 'string' && x.length > 0),
    ),
  ];
  if (list.length === 0) return;
  if (list.some((id) => !UUID_RE.test(id))) {
    throw new BadRequestException(`${label} : identifiant invalide`);
  }
  const rows = await db.query(
    `SELECT id FROM ${table} WHERE company_id = $1 AND id = ANY($2::uuid[])`,
    [companyId, list],
  );
  if (rows.length !== list.length) {
    throw new BadRequestException(`${label} introuvable pour ce tenant`);
  }
}
