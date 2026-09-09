-- Align demo/runtime data between local and VPS for ONECOMIT.
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Runtime/schema fix for compliance documents on VPS.
ALTER TABLE IF EXISTS company_compliance_documents
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Geolocation runtime table may be absent on VPS.
CREATE TABLE IF NOT EXISTS geopositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  technician_id uuid NOT NULL,
  mission_id uuid NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  accuracy_m integer NULL,
  speed_kmh numeric(6,2) NULL,
  battery_pct integer NULL,
  recorded_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'mobile'
);

CREATE INDEX IF NOT EXISTS idx_geopositions_company_tech_recorded
  ON geopositions (company_id, technician_id, recorded_at);

-- ONECOMIT working set.
WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
)
INSERT INTO company_settings (id, company_id, created_at, updated_at, data)
SELECT gen_random_uuid(), c.id, now(), now(), '{}'::jsonb
FROM company c
WHERE NOT EXISTS (SELECT 1 FROM company_settings s WHERE s.company_id = c.id);

WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
)
INSERT INTO partners (id, company_id, created_at, updated_at, code, name, description, price_grid, exclusive_zone, active)
SELECT gen_random_uuid(), c.id, now(), now(), v.code, v.name, v.description, v.price_grid, v.exclusive_zone, true
FROM company c
CROSS JOIN (
  VALUES
    ('3STB', '3STB', 'Partenaire principal national', 'BORDEREAU_3STB', NULL),
    ('SOFATELCOM', 'SOFATELCOM', 'Partenaire Mbour / prestations spécifiques', 'GRID_SOFATELCOM', 'Mbour')
) AS v(code, name, description, price_grid, exclusive_zone)
WHERE NOT EXISTS (
  SELECT 1 FROM partners p WHERE p.company_id = c.id AND lower(p.code) = lower(v.code)
);

WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
),
admin_user AS (
  SELECT u.id, u.company_id
  FROM users u
  JOIN company c ON c.id = u.company_id
  WHERE lower(u.email) = 'admin@onecomit.sn'
  LIMIT 1
)
INSERT INTO company_subscriptions (
  id, company_id, user_id, created_at, updated_at,
  plan_code, status, start_date, end_date, billing_cycle, amount
)
SELECT gen_random_uuid(), a.company_id, a.id, now(), now(),
       'GEOLOCATION', 'active', CURRENT_DATE, NULL, 'monthly', '5000'
FROM admin_user a
WHERE NOT EXISTS (
  SELECT 1 FROM company_subscriptions s
  WHERE s.company_id = a.company_id AND s.plan_code = 'GEOLOCATION' AND s.status = 'active'
);

UPDATE companies
SET subscription_status = 'active',
    subscription_start_date = COALESCE(subscription_start_date, CURRENT_DATE),
    updated_at = now()
WHERE lower(name) = 'onecomit';

WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
)
INSERT INTO compliance_records (
  id, company_id, created_at, updated_at,
  team_id, status, observations, habilitation_domains, validation_step
)
SELECT gen_random_uuid(), t.company_id, now(), now(),
       t.id, 'en_attente', 'Dossier demo initialisé pour alignement local/VPS', ARRAY[]::text[], 'documentaire'
FROM teams t
JOIN company c ON c.id = t.company_id
WHERE NOT EXISTS (
  SELECT 1 FROM compliance_records r WHERE r.company_id = t.company_id AND r.team_id = t.id
);

WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
)
INSERT INTO company_compliance_documents (
  id, company_id, created_at, updated_at,
  doc_type, signed, signed_at, file_url
)
SELECT gen_random_uuid(), c.id, now(), now(), v.doc_type, false, NULL, v.file_url
FROM company c
CROSS JOIN (
  VALUES
    ('code_conduite', '/uploads/demo/compliance/code-conduite.pdf'),
    ('charte_sst', '/uploads/demo/compliance/charte-sst.pdf'),
    ('dechets_d3e', '/uploads/demo/compliance/dechets-d3e.pdf')
) AS v(doc_type, file_url)
WHERE NOT EXISTS (
  SELECT 1 FROM company_compliance_documents d
  WHERE d.company_id = c.id AND d.doc_type = v.doc_type
);

-- Demo GPS points so the live map is not empty.
WITH company AS (
  SELECT id FROM companies WHERE lower(name) = 'onecomit' LIMIT 1
),
leaders AS (
  SELECT t.id AS technician_id, t.company_id, row_number() OVER (ORDER BY t.created_at, t.id) AS rn
  FROM technicians t
  JOIN company c ON c.id = t.company_id
  WHERE t.active = true
),
points AS (
  SELECT * FROM (
    VALUES
      (1, 14.6928000::numeric, -17.4467000::numeric, 92, 8.5::numeric, 'mobile', interval '5 minutes'),
      (2, 14.4197000::numeric, -16.9667000::numeric, 61, 21.3::numeric, 'mobile', interval '9 minutes'),
      (3, 14.7167000::numeric, -17.4677000::numeric, 47, 0.0::numeric, 'mission_check', interval '14 minutes')
  ) AS p(rn, lat, lon, battery_pct, speed_kmh, source, age)
)
INSERT INTO geopositions (
  id, company_id, created_at, updated_at,
  technician_id, mission_id, latitude, longitude,
  accuracy_m, speed_kmh, battery_pct, recorded_at, source
)
SELECT gen_random_uuid(), l.company_id, now(), now(),
       l.technician_id, NULL, p.lat, p.lon,
       15, p.speed_kmh, p.battery_pct, now() - p.age, p.source
FROM leaders l
JOIN points p ON p.rn = l.rn
WHERE NOT EXISTS (
  SELECT 1 FROM geopositions g WHERE g.company_id = l.company_id
);
