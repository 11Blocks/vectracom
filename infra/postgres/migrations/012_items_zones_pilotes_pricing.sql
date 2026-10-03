-- =============================================================
-- VECTRACOM — Migration 012 : Lot L0 (fondations transverses)
-- Item (6 domaines) + Zone + Pilote + Partenaire multi-niveaux
-- + Cascade tarifaire (rémunération par %).
-- Idempotente (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================

-- 1) Items : les 6 domaines métier (FTTH, INFRA, PP&GC, EXT/DENSIF, DEPLOIEMENT, BTS)
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  mission_types jsonb NOT NULL DEFAULT '[]',
  team_composition jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

-- 2) Zones : rattachement territorial des équipes (Mbour, Thiès, Tivaouane…)
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

-- 3) Pilotes : superviseurs (SONATEL ou sous-traitant) qui gèrent un groupe d'équipes
CREATE TABLE IF NOT EXISTS pilotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'SONATEL', -- SONATEL | SOUS_TRAITANT
  partner_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) pricing_rules : cascade tarifaire multi-niveaux
--    parent → child, pourcentage du tarif amont reversé à l'aval (par item).
--    item_id NULL = règle par défaut pour tous les items.
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  parent_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  child_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  item_id uuid,
  percentage numeric(6,2) NOT NULL,
  effective_from date,
  effective_to date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, parent_partner_id, child_partner_id, item_id)
);

-- 5) Colonnes supplémentaires (enrichissement, pas de suppression)
ALTER TABLE teams        ADD COLUMN IF NOT EXISTS zone_id uuid;
ALTER TABLE teams        ADD COLUMN IF NOT EXISTS pilot_id uuid;
ALTER TABLE teams        ADD COLUMN IF NOT EXISTS item_id uuid;

ALTER TABLE technicians  ADD COLUMN IF NOT EXISTS fonction text;
ALTER TABLE technicians  ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE technicians  ADD COLUMN IF NOT EXISTS zone_id uuid;

ALTER TABLE missions     ADD COLUMN IF NOT EXISTS item_id uuid;

ALTER TABLE mission_type_templates ADD COLUMN IF NOT EXISTS item_id uuid;

ALTER TABLE partners     ADD COLUMN IF NOT EXISTS level integer;
ALTER TABLE partners     ADD COLUMN IF NOT EXISTS parent_partner_id uuid;
ALTER TABLE partners     ADD COLUMN IF NOT EXISTS contract_file text;
ALTER TABLE partners     ADD COLUMN IF NOT EXISTS bordereau_file text;
