-- 011 — RH : trace de l'embauche d'un candidat (fiche employé / technicien créées).
-- Idempotent.

-- MIG-2 (11/11/2026) : recruitment_candidates avait été créée par TypeORM
-- synchronize, sans migration — une base neuve échouait ici. Structure reprise
-- à l'identique de la prod (pg_dump --schema-only), noms de clés et d'index
-- compris. Sans effet sur les bases où la table existe déjà.
CREATE TABLE IF NOT EXISTS public.recruitment_candidates (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  full_name text NOT NULL,
  "position" text NOT NULL,
  phone text,
  email text,
  source text DEFAULT 'candidature_spontanee'::text NOT NULL,
  status text DEFAULT 'nouveau'::text NOT NULL,
  notes text,
  documents jsonb DEFAULT '[]'::jsonb NOT NULL,
  interview_date date,
  test_score integer,
  hired_at timestamp with time zone,
  hired_employee_id uuid,
  hired_technician_id uuid,
  CONSTRAINT "PK_10ba3ccf9094cb97591f9a82a6a" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_1c8efeb8e56e8970db7c239767" ON public.recruitment_candidates USING btree (company_id, status);
CREATE INDEX IF NOT EXISTS "IDX_8b048d588cf1e79f02f65309ed" ON public.recruitment_candidates USING btree (company_id);

ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_at timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_employee_id uuid;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_technician_id uuid;

-- Statut « en congé » dérivé des congés approuvés du jour (plus d'état figé).
UPDATE employees e SET status = 'actif'
 WHERE e.status = 'en_conge'
   AND NOT EXISTS (
     SELECT 1 FROM leave_requests l
      WHERE l.employee_id = e.id AND l.status = 'approuve'
        AND CURRENT_DATE BETWEEN l.start_date AND l.end_date);
