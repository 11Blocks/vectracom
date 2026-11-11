-- =============================================================
-- VECTRACOM — Migration 021 : tables sans migration (MIG-2).
--
-- Ces 13 tables avaient été créées par TypeORM `synchronize` en
-- développement, puis copiées en prod par restauration de dump : aucune
-- migration ne les créait, une base neuve était donc incomplète.
-- (La 14e, recruitment_candidates, est créée en tête de 011, qui en dépend.)
--
-- Structure reprise À L'IDENTIQUE de la prod (pg_dump --schema-only du
-- 11/11/2026, identique à la base de dev) : colonnes, défauts, noms des clés
-- primaires / étrangères / contraintes et des index (TypeORM s'appuie sur
-- ces noms). Ordre : tables référencées d'abord (chat_rooms, rag_documents).
--
-- Idempotente et sans effet sur les bases où les tables existent déjà
-- (dev, prod). À appliquer avec : psql -1 -v ON_ERROR_STOP=1
-- =============================================================

-- chat_rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  kind text NOT NULL,
  title character varying NOT NULL,
  alias text NOT NULL,
  team_id uuid,
  mission_id uuid,
  matrix_room_id text,
  last_message_at timestamp with time zone,
  last_message_preview text,
  CONSTRAINT "PK_c69082bd83bffeb71b0f455bd59" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_1e4616024037831d22120d74a8" ON public.chat_rooms USING btree (company_id, kind, team_id);
CREATE INDEX IF NOT EXISTS "IDX_ad10450652cd148f84f7311234" ON public.chat_rooms USING btree (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fcdf63b7dbc80503ce792e3acc" ON public.chat_rooms USING btree (company_id, alias);

-- chat_memberships
CREATE TABLE IF NOT EXISTS public.chat_memberships (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT "PK_ac1bbb1543acbd19243c69845c7" PRIMARY KEY (id),
  CONSTRAINT "FK_b973b1314b2384652c8ff3c2156" FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_ff8feca8233baa944cbfad7671" ON public.chat_memberships USING btree (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_2804590631f1023c5a4ded0290" ON public.chat_memberships USING btree (company_id, room_id, user_id);

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  room_id uuid NOT NULL,
  sender_id uuid,
  sender_display_name text,
  source text DEFAULT 'app'::text NOT NULL,
  body text NOT NULL,
  photo_url text,
  matrix_event_id text,
  CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY (id),
  CONSTRAINT "FK_7f52e11d11d4e8cc41224352869" FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_338adeb7507f3ecfdf53581bfd" ON public.chat_messages USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_a25bea0e4c8c0e92a379aa56c7" ON public.chat_messages USING btree (company_id, room_id, created_at);

-- rag_documents
CREATE TABLE IF NOT EXISTS public.rag_documents (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  file_name text,
  chunk_count integer DEFAULT 0 NOT NULL,
  size_chars integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'ready'::text NOT NULL,
  uploaded_by uuid,
  CONSTRAINT "PK_0c27c0f160af990a817ba71c32a" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_688b72c1ad9ad765c3349a7d76" ON public.rag_documents USING btree (company_id, category);
CREATE INDEX IF NOT EXISTS "IDX_77c5140abe28f2567a2e2635a7" ON public.rag_documents USING btree (company_id);

-- rag_chunks
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  document_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  CONSTRAINT "PK_5775a2e48c4774fbb9203b22fcd" PRIMARY KEY (id),
  CONSTRAINT "FK_44209ba9d30face3080d69eb4e2" FOREIGN KEY (document_id) REFERENCES public.rag_documents(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_ded346ee7a4ca152622fa3b92e" ON public.rag_chunks USING btree (company_id, document_id);
CREATE INDEX IF NOT EXISTS "IDX_ecc6f5ac7f32cd804ab8372491" ON public.rag_chunks USING btree (company_id);

-- daily_workers
CREATE TABLE IF NOT EXISTS public.daily_workers (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  full_name text NOT NULL,
  team_id uuid NOT NULL,
  phone text,
  daily_rate numeric(10,2) DEFAULT '0'::numeric NOT NULL,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT "PK_d7d19fc97535a4b56752931af64" PRIMARY KEY (id),
  CONSTRAINT "FK_172d3bf61e93f689aa839ab51d8" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_225b592b205b6956af6374cd8f" ON public.daily_workers USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_a7134a13561432adcd4ed29c4d" ON public.daily_workers USING btree (company_id, team_id);

-- daily_attendances
CREATE TABLE IF NOT EXISTS public.daily_attendances (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  daily_worker_id uuid NOT NULL,
  mission_id uuid,
  day date NOT NULL,
  days_worked numeric(5,2) DEFAULT '1'::numeric NOT NULL,
  note text,
  CONSTRAINT "PK_32756f404a472f0cbbd978c7ae5" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_091c6c6f146e3e26df51ea1356" ON public.daily_attendances USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_7ec537036340ca7361eb79c410" ON public.daily_attendances USING btree (company_id, mission_id, day);

-- dispositif_entries
CREATE TABLE IF NOT EXISTS public.dispositif_entries (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  day date NOT NULL,
  zone_name text NOT NULL,
  team_name text NOT NULL,
  axis text,
  team_id uuid,
  pilot text,
  instances integer DEFAULT 1 NOT NULL,
  note text,
  CONSTRAINT "PK_ab68cbb4d774048f473d3e969da" PRIMARY KEY (id),
  CONSTRAINT uq_dispositif_day_zone_team UNIQUE (company_id, day, zone_name, team_name)
);
CREATE INDEX IF NOT EXISTS "IDX_03cfc0c10f9efc635d2cf6e5db" ON public.dispositif_entries USING btree (company_id, day);
CREATE INDEX IF NOT EXISTS "IDX_4dc969c4bb8fc98e99046c6551" ON public.dispositif_entries USING btree (company_id);

-- geofence_zones
CREATE TABLE IF NOT EXISTS public.geofence_zones (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  center_latitude numeric(10,7) NOT NULL,
  center_longitude numeric(10,7) NOT NULL,
  radius_m integer DEFAULT 500 NOT NULL,
  note text,
  active boolean DEFAULT true NOT NULL,
  CONSTRAINT "PK_ea4a1d9e1ff81eee336b4e8d071" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_5987387ef8845d566b409d8c8d" ON public.geofence_zones USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_9d7669f5a7cabc5a06bdedafcd" ON public.geofence_zones USING btree (company_id, active);

-- geopositions
CREATE TABLE IF NOT EXISTS public.geopositions (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  technician_id uuid NOT NULL,
  mission_id uuid,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  accuracy_m integer,
  speed_kmh numeric(6,2),
  battery_pct integer,
  recorded_at timestamp with time zone NOT NULL,
  source text DEFAULT 'mobile'::text NOT NULL,
  CONSTRAINT "PK_5430f5ea1c5264f4603aadd6665" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_d0ac0faac252c659db83a8b590" ON public.geopositions USING btree (company_id, technician_id, recorded_at);
CREATE INDEX IF NOT EXISTS "IDX_d6090cfafcf8fe700f85dea2ee" ON public.geopositions USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_geopositions_company_tech_recorded ON public.geopositions USING btree (company_id, technician_id, recorded_at);

-- settings_change_logs
CREATE TABLE IF NOT EXISTS public.settings_change_logs (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  user_id uuid,
  user_email text,
  section text NOT NULL,
  parameter text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  CONSTRAINT "PK_673d94d8ab7b828a574f7bfa98a" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_2ab7762cc4e6177e240da28e57" ON public.settings_change_logs USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_60faf1a6e01bace23c06624d0c" ON public.settings_change_logs USING btree (company_id, created_at);

-- vehicle_events
CREATE TABLE IF NOT EXISTS public.vehicle_events (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  vehicle_id uuid NOT NULL,
  type text NOT NULL,
  event_date date NOT NULL,
  odometer_km integer,
  cost numeric(12,2) DEFAULT '0'::numeric NOT NULL,
  liters numeric(8,2),
  provider text,
  description text,
  parts jsonb DEFAULT '[]'::jsonb NOT NULL,
  status text DEFAULT 'terminee'::text NOT NULL,
  mission_id uuid,
  CONSTRAINT "PK_49b6940551020a9a5cdcec28673" PRIMARY KEY (id),
  CONSTRAINT "FK_6fea664e4f14f4c3b79d5ff3801" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_61cbd4ccbb85558e0149825678" ON public.vehicle_events USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_78555e23d0c076dd2e0477a157" ON public.vehicle_events USING btree (company_id, vehicle_id, type);

-- vision_uploads
CREATE TABLE IF NOT EXISTS public.vision_uploads (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  company_id uuid,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  original_name text NOT NULL,
  image_url text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  width integer,
  height integer,
  verdict text NOT NULL,
  score integer NOT NULL,
  flags jsonb DEFAULT '[]'::jsonb NOT NULL,
  note text,
  mission_id uuid,
  uploaded_by uuid,
  CONSTRAINT "PK_965b6702ad6694e38df24aeb8f4" PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS "IDX_3ea449f56809c2381ff2964de2" ON public.vision_uploads USING btree (company_id);
CREATE INDEX IF NOT EXISTS "IDX_b08a0191ad70063a9a9517700e" ON public.vision_uploads USING btree (company_id, created_at);

