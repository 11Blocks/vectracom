-- =============================================================
-- VECTRACOM — Migration 016 : Renforts zone→zone + frais de mission (L3).
--   - renforts          : équipe déplacée de sa zone d'origine vers une zone
--                         de renfort, avec supplément perdiem/jour/membre.
--   - mission_expenses  : frais opérationnels (carburant, repas, logement,
--                         perdiem, autre) rattachés à une équipe/mission.
-- =============================================================

CREATE TABLE IF NOT EXISTS renforts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  from_zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  to_zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  perdiem_per_day numeric(14,2) NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'actif', -- actif | termine | annule
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renforts_company_team ON renforts (company_id, team_id);

CREATE TABLE IF NOT EXISTS mission_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  expense_type text NOT NULL, -- carburant | repas | logement | perdiem | autre
  amount numeric(14,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_expenses_company_date ON mission_expenses (company_id, expense_date);
