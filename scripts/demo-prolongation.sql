-- VECTRACOM — prolongation des données de démonstration jusqu'à aujourd'hui (tenant ONECOMIT).
-- Clone des journées réelles en décalant les dates ; rejouable sans doublon (marqueurs prolongedFrom).
--   Missions  : 06→27 juin (+91 j = 13 semaines, même jour de semaine) → 05→26 sept., rapports terrain inclus
--   Incidents : 24 août→09 sept. (+17 j) → 10→26 sept., numéros INC-AAAA-NNNN à la suite du maximum
--   Pointage journaliers (+21 j) et présences hebdomadaires (+7/+14 j)
-- Rien n'est modifié ni supprimé dans l'existant. Seules les dates ≤ aujourd'hui sont créées.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _cid ON COMMIT DROP AS
  SELECT company_id AS id FROM users WHERE email = 'admin@onecomit.sn' AND company_id IS NOT NULL;

-- ───────── Missions ─────────
CREATE TEMP TABLE _m ON COMMIT DROP AS
SELECT m.* FROM missions m
WHERE m.company_id IN (SELECT id FROM _cid)
  AND m.date_mission >= timestamptz '2026-06-06' AND m.date_mission < timestamptz '2026-06-28'
  AND (m.date_mission + interval '91 days')::date <= current_date
  AND COALESCE(m.import_source, '') <> 'demo_prolongation'
  AND NOT EXISTS (SELECT 1 FROM missions c WHERE c.import_meta->>'prolongedFrom' = m.id::text);

UPDATE _m SET
  import_meta = COALESCE(import_meta, '{}'::jsonb) || jsonb_build_object('prolongedFrom', id::text),
  id = gen_random_uuid(),
  date_mission = date_mission + interval '91 days',
  heure_depart_reelle = heure_depart_reelle + interval '91 days',
  heure_arrivee = heure_arrivee + interval '91 days',
  rejected_at = rejected_at + interval '91 days',
  cancelled_at = cancelled_at + interval '91 days',
  sonatel_dossier_number = CASE WHEN sonatel_dossier_number IS NULL THEN NULL ELSE sonatel_dossier_number || '-P' END,
  client_generated_id = NULL,
  invoice_id = NULL,
  import_source = 'demo_prolongation',
  created_at = LEAST(now(), date_mission + interval '91 days')::timestamp,
  updated_at = now();

-- Journée en cours : missions encore ouvertes.
UPDATE _m SET status = CASE WHEN random() < 0.5 THEN 'en_cours' ELSE 'planifiee' END,
              heure_arrivee = NULL, rejected_at = NULL, rejection_reason = NULL
WHERE date_mission::date = current_date;

INSERT INTO missions SELECT * FROM _m;

-- Rapports terrain des missions clonées déjà exécutées.
CREATE TEMP TABLE _fr ON COMMIT DROP AS
SELECT r.*, c.id AS new_mission_id FROM mission_field_reports r
JOIN missions c ON c.import_meta->>'prolongedFrom' = r.mission_id::text AND c.import_source = 'demo_prolongation'
WHERE c.status NOT IN ('planifiee', 'en_cours')
  AND NOT EXISTS (SELECT 1 FROM mission_field_reports x WHERE x.mission_id = c.id);

UPDATE _fr SET
  id = gen_random_uuid(),
  mission_id = new_mission_id,
  sst_validated_at = sst_validated_at + interval '91 days',
  identification_at = identification_at + interval '91 days',
  technique_at = technique_at + interval '91 days',
  photos_at = photos_at + interval '91 days',
  materiel_at = materiel_at + interval '91 days',
  exchange_old_serial_id = NULL,
  exchange_new_serial_id = NULL,
  created_at = LEAST(now()::timestamp, created_at + interval '91 days'),
  updated_at = now();
ALTER TABLE _fr DROP COLUMN new_mission_id;
INSERT INTO mission_field_reports SELECT * FROM _fr;

-- ───────── Incidents ─────────
CREATE TEMP TABLE _i ON COMMIT DROP AS
SELECT i.* FROM incidents i
WHERE i.company_id IN (SELECT id FROM _cid)
  AND i.reported_at >= timestamptz '2026-08-24' AND i.reported_at < timestamptz '2026-09-10'
  AND i.reported_at + interval '17 days' <= now()
  AND i.annotation_parse->>'prolongedFrom' IS NULL
  AND NOT EXISTS (SELECT 1 FROM incidents c WHERE c.annotation_parse->>'prolongedFrom' = i.id::text);

UPDATE _i SET
  annotation_parse = COALESCE(annotation_parse, '{}'::jsonb) || jsonb_build_object('prolongedFrom', id::text),
  id = gen_random_uuid(),
  reported_at = reported_at + interval '17 days',
  assigned_at = assigned_at + interval '17 days',
  resolved_at = resolved_at + interval '17 days',
  closed_at = closed_at + interval '17 days',
  report_generated_at = NULL,
  report_pdf_url = NULL,
  related_mission_ids = '{}',
  created_at = LEAST(now(), reported_at + interval '17 days')::timestamp,
  updated_at = now();

WITH base AS (
  SELECT COALESCE(max(NULLIF(regexp_replace(incident_number, '^INC-\d{4}-', ''), '')::int), 0) AS mx
  FROM incidents
  WHERE company_id IN (SELECT id FROM _cid) AND incident_number ~ ('^INC-' || to_char(now(), 'YYYY') || '-\d+$')
), numbered AS (
  SELECT id, row_number() OVER (ORDER BY reported_at, id) AS rn FROM _i
)
UPDATE _i SET incident_number = 'INC-' || to_char(now(), 'YYYY') || '-' || lpad((base.mx + numbered.rn)::text, 4, '0')
FROM base, numbered WHERE numbered.id = _i.id;

INSERT INTO incidents SELECT * FROM _i;

-- ───────── Pointage journaliers ─────────
INSERT INTO daily_attendances (id, company_id, created_at, updated_at, daily_worker_id, mission_id, day, days_worked, note)
SELECT uuid_generate_v4(), a.company_id, (a.day + 21)::timestamp, now(), a.daily_worker_id, NULL, a.day + 21, a.days_worked, a.note
FROM daily_attendances a
JOIN daily_workers w ON w.id = a.daily_worker_id AND w.active
WHERE a.company_id IN (SELECT id FROM _cid)
  AND a.day BETWEEN date '2026-08-20' AND date '2026-09-05'
  AND a.day + 21 <= current_date
  AND NOT EXISTS (SELECT 1 FROM daily_attendances x WHERE x.daily_worker_id = a.daily_worker_id AND x.day = a.day + 21);

-- ───────── Présences hebdomadaires ─────────
INSERT INTO attendance (id, company_id, technician_id, week_start, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
                        comments, validated_by, validated_at, created_at, updated_at)
SELECT gen_random_uuid(), a.company_id, a.technician_id, a.week_start + s.shift, a.monday, a.tuesday, a.wednesday, a.thursday, a.friday,
       CASE WHEN a.week_start + s.shift + 5 <= current_date THEN a.saturday ELSE false END,
       CASE WHEN a.week_start + s.shift + 6 <= current_date THEN a.sunday ELSE false END,
       a.comments,
       CASE WHEN a.week_start + s.shift + 6 < current_date THEN a.validated_by END,
       CASE WHEN a.week_start + s.shift + 6 < current_date THEN a.validated_at + make_interval(days => s.shift) END,
       now(), now()
FROM attendance a
CROSS JOIN (VALUES (7), (14)) AS s(shift)
WHERE a.company_id IN (SELECT id FROM _cid)
  AND a.week_start = date '2026-09-07'
  AND a.week_start + s.shift <= current_date
ON CONFLICT (company_id, technician_id, week_start) DO NOTHING;

SELECT 'missions' AS objet, count(*) FILTER (WHERE import_source = 'demo_prolongation') AS prolongees, max(date_mission)::date AS derniere
FROM missions WHERE company_id IN (SELECT id FROM _cid)
UNION ALL
SELECT 'incidents', count(*) FILTER (WHERE annotation_parse->>'prolongedFrom' IS NOT NULL), max(reported_at)::date
FROM incidents WHERE company_id IN (SELECT id FROM _cid)
UNION ALL
SELECT 'pointages', count(*), max(day) FROM daily_attendances WHERE company_id IN (SELECT id FROM _cid)
UNION ALL
SELECT 'presences', count(*), max(week_start) FROM attendance WHERE company_id IN (SELECT id FROM _cid);

COMMIT;
