-- 006 — Compte tenant : motif de rejet mission, description/clôture incident,
-- rattrapage du schéma caisse (table créée jusqu'ici par synchronize uniquement).
-- Idempotent.

ALTER TABLE missions ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE TABLE IF NOT EXISTS cash_box_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  period text NOT NULL,
  type text NOT NULL,
  rubrique text NOT NULL,
  amount numeric(12,2) NOT NULL,
  beneficiary text,
  team_id uuid,
  vehicle_id uuid,
  expense_id uuid,
  note text,
  repaid_amount numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cash_box_entries_company_period ON cash_box_entries(company_id, period);

ALTER TABLE price_items ADD COLUMN IF NOT EXISTS price_grid text NOT NULL DEFAULT 'BORDEREAU_3STB';
