-- =============================================================
-- VECTRACOM — Migration 019 : Satisfaction client (L7).
-- Le client note le travail et le comportement de l'équipe
-- (propreté, tenue, respect) — alimente le classement équipes.
-- =============================================================

CREATE TABLE IF NOT EXISTS client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  rating integer NOT NULL,          -- 1..5 satisfaction globale
  cleanliness integer,              -- 1..5 propreté du chantier
  behavior integer,                 -- 1..5 comportement technicien
  comment text,
  client_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_company_team ON client_feedback (company_id, team_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_company_mission ON client_feedback (company_id, mission_id);

-- BaseEntity attend created_at + updated_at ; ajout idempotent.
ALTER TABLE client_feedback ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
