-- VECTRACOM schema drift fix #3 — KPI recalculate blockers
-- stock_levels / stock_movements / compliance_records vs TypeORM entities.
-- Idempotent.

ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS threshold_alert integer;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS threshold_critical integer;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS last_inventory_at timestamptz;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS habilitation_domains text[] NOT NULL DEFAULT '{}';
ALTER TABLE compliance_records ADD COLUMN IF NOT EXISTS validation_step text NOT NULL DEFAULT 'documentaire';
