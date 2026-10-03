-- =============================================================
-- VECTRACOM — Migration 018 : Rémunération équipe 65/35 (L6).
-- Chaque équipe répartit son chiffre entre chef et binôme
-- (65/35 par défaut, flexible). Feuille de paie par équipe/période.
-- =============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS repartition_chef_pct numeric(5,2) NOT NULL DEFAULT 65;

CREATE TABLE IF NOT EXISTS team_payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  period text NOT NULL, -- YYYY-MM
  revenue numeric(15,2) NOT NULL DEFAULT 0,
  chef_share numeric(15,2) NOT NULL DEFAULT 0,
  binome_share numeric(15,2) NOT NULL DEFAULT 0,
  chef_id uuid,
  binome_id uuid,
  status text NOT NULL DEFAULT 'brouillon', -- brouillon | validee
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, team_id, period)
);

CREATE INDEX IF NOT EXISTS idx_team_payrolls_company_period ON team_payrolls (company_id, period);
