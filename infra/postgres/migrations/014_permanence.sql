-- =============================================================
-- VECTRACOM — Migration 014 : Permanence (rotation SAV/PROD).
-- Créneaux de permanence week-ends + jours fériés, assignés
-- aux équipes par rotation (tournante, équitable).
-- =============================================================

CREATE TABLE IF NOT EXISTS permanence_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL, -- SAV | PRODUCTION
  team_id uuid,
  day date NOT NULL,
  zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, type, day)
);
