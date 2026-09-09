-- VECTRACOM schema drift fix (VPS / production)
-- Aligns DB with TypeORM entities: KPI family columns + partners / settings / TCO / mastery plans.
-- Idempotent.

-- 1) sonatel_kpi_logs: columns used by Optimax penalty engine
ALTER TABLE sonatel_kpi_logs ADD COLUMN IF NOT EXISTS family text NOT NULL DEFAULT 'production';
ALTER TABLE sonatel_kpi_logs ADD COLUMN IF NOT EXISTS penalty_mode text NOT NULL DEFAULT 'TCO';
ALTER TABLE sonatel_kpi_logs ADD COLUMN IF NOT EXISTS unit_count numeric(12,2) NOT NULL DEFAULT 0;

-- 2) sonatel_kpi_alerts: BaseEntity.updatedAt
ALTER TABLE sonatel_kpi_alerts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) partners
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  price_grid text NOT NULL,
  exclusive_zone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_code ON partners (company_id, code);
CREATE INDEX IF NOT EXISTS "IDX_partners_company_id_active" ON partners (company_id, active);

-- 4) company_settings
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_settings_company ON company_settings (company_id);

-- 5) kpi_tco_inputs
CREATE TABLE IF NOT EXISTS kpi_tco_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  period text NOT NULL,
  segment text NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tco_period_segment ON kpi_tco_inputs (company_id, period, segment);
CREATE INDEX IF NOT EXISTS "IDX_kpi_tco_inputs_company_id_period" ON kpi_tco_inputs (company_id, period);

-- 6) kpi_mastery_plans
CREATE TABLE IF NOT EXISTS kpi_mastery_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  kpi_name text NOT NULL,
  period text NOT NULL,
  analysis text NOT NULL DEFAULT '',
  actions text NOT NULL DEFAULT '',
  responsible text,
  due_date date,
  status text NOT NULL DEFAULT 'ouvert',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mastery_kpi_period ON kpi_mastery_plans (company_id, kpi_name, period);
CREATE INDEX IF NOT EXISTS "IDX_kpi_mastery_plans_company_id_period" ON kpi_mastery_plans (company_id, period);
