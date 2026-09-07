-- ============================================================================
-- VECTRACOM — Migration 001 : socle auth & multi-tenant (Phase 1)
-- Tables : companies, users, audit_logs
-- Les migrations suivantes (002→010) ajoutent les modules métier.
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sonatel_subcontractor_name text,
  -- SaaS
  subscription_status text NOT NULL DEFAULT 'trial', -- trial, active, retard_j1, retard_j15, retard_j20, suspendu, resilie
  subscription_start_date date,
  subscription_end_date date,
  trial_end_date date,
  onboarding_paid boolean DEFAULT false,
  platform_fee_paid boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL, -- super_admin, finance_admin, support_admin, admin, direction, chef_equipe, magasinier
  active boolean NOT NULL DEFAULT true,
  -- SaaS
  license_type text, -- mobile, web, rag, geolocation
  license_active boolean DEFAULT true,
  last_login_at timestamptz,
  password_reset_token text,
  password_reset_expires timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Le super_admin Green-T n'appartient à aucun tenant : email unique global,
-- l'isolation est assurée par le guard (company_id NULL = accès console).

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ===== Phase 2 : Planning + Import SONATEL =====

CREATE TABLE IF NOT EXISTS sonatel_column_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sheet_type text NOT NULL, -- planning | affect
  source_column_name text NOT NULL,
  target_field text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid,                          -- FK teams ajoutée en Phase 4
  technician_ids uuid[] DEFAULT '{}',
  vehicle_id uuid,
  client_site text NOT NULL,
  type_tache text NOT NULL,
  zone text,
  date_mission timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planifiee', -- planifiee, en_cours, terminee, validee, rejetee, a_completer
  sonatel_dossier_number text,
  sonatel_produit text,
  sonatel_olt text,
  client_generated_id text UNIQUE,
  import_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, sonatel_dossier_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_column_mapping
  ON sonatel_column_mappings(company_id, sheet_type, source_column_name);
CREATE INDEX IF NOT EXISTS idx_missions_company ON missions(company_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(date_mission);
CREATE INDEX IF NOT EXISTS idx_missions_team ON missions(team_id);

-- ===== Phase 3 : Missions & formulaire dynamique =====

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS heure_depart_reelle timestamptz,
  ADD COLUMN IF NOT EXISTS heure_arrivee timestamptz,
  ADD COLUMN IF NOT EXISTS taches_effectuees text,
  ADD COLUMN IF NOT EXISTS materiel_utilise jsonb,
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS commentaire_vocal_url text,
  ADD COLUMN IF NOT EXISTS rapport_genere_par_ia text;

CREATE TABLE IF NOT EXISTS mission_type_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type_name text NOT NULL, -- INSTALLATION, SURVEY, SAV, INFRA, OSM, GC, PLANTATION, DEVOIEMENT, DEPLOIEMENT, DENSIFICATION, SURVEY_OSM
  label text NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]',
  required_photos jsonb DEFAULT '[]',
  checklist_template jsonb DEFAULT '[]',
  workflow jsonb DEFAULT '{"statuses":["planifiee","en_cours","terminee","validee","rejetee"]}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, type_name)
);

CREATE TABLE IF NOT EXISTS mission_field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
  mission_type text,
  -- Étape 1 : SST
  sst_checklist jsonb,
  sst_photo_url text,
  sst_validated_at timestamptz,
  -- Étape 2 : Identification
  intervention_type text,
  equipment_code text,
  gps_latitude numeric(10,7),
  gps_longitude numeric(10,7),
  identification_at timestamptz,
  -- Étape 3 : Technique
  initial_equipment_state text,
  action_realized text,
  dbm_measurement numeric(6,2),
  dbm_out_of_norm boolean DEFAULT false,
  technique_at timestamptz,
  -- Étape 4 : Photos
  photo_site_url text,
  photo_pbo_interior_url text,
  photo_pbo_closed_url text,
  photo_pto_modem_url text,
  photo_audit_results jsonb,
  photos_at timestamptz,
  -- Étape 5 : Matériel
  materials_consumed jsonb,
  exchange_old_serial_id uuid,
  exchange_new_serial_id uuid,
  materiel_at timestamptz,
  -- Étape 6 : Clôture
  field_status text, -- succes | echec
  failure_reason text,
  observations text,
  signature_technician_url text,
  signature_client_url text,
  quality_score numeric(5,2),
  internal_validation_status text DEFAULT 'en_attente',
  sonatel_approval_status text DEFAULT 'en_attente',
  pv_recette_pdf_url text,
  -- Dynamique
  data jsonb DEFAULT '{}',
  price_items_used jsonb DEFAULT '[]',
  recette_status text DEFAULT 'en_attente',
  recette_documents jsonb DEFAULT '[]',
  duree_minutes integer,
  montant_total numeric(15,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_company ON mission_type_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_company ON mission_field_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_mission ON mission_field_reports(mission_id);

-- ===== Phase 4 : Équipes & Techniciens =====

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- PROD, SAV, INFRA, EXTENSION
  zone text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  habilitation_sst_expiration date,
  habilitation_conduite_expiration date,
  is_team_leader boolean DEFAULT false,
  team_leader_id uuid REFERENCES technicians(id) ON DELETE SET NULL,
  experience_years integer,
  contract_type text, -- CDD, CDI, PRESTATAIRE
  competences jsonb DEFAULT '[]', -- ['DEPLOIEMENT','DENSIF','EXTENSION','OSM',...]
  documents jsonb DEFAULT '[]', -- [{ type, fileUrl, expirationDate }]
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE missions
  DROP CONSTRAINT IF EXISTS fk_mission_team,
  ADD CONSTRAINT fk_mission_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_company ON teams(company_id);
CREATE INDEX IF NOT EXISTS idx_technicians_company ON technicians(company_id);
CREATE INDEX IF NOT EXISTS idx_technicians_team ON technicians(team_id);
CREATE INDEX IF NOT EXISTS idx_technicians_leader ON technicians(team_leader_id);

-- ===== Phase 5 : Stock & Bordereau =====

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL, -- CENTRAL, VEHICLE, SITE
  name text NOT NULL,
  zone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference text NOT NULL,
  designation text NOT NULL,
  category text NOT NULL, -- CONSUMABLE, ASSET
  family text NOT NULL,   -- FIBRE, CUIVRE
  unit text,
  threshold_alert integer DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS item_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  status text DEFAULT 'disponible', -- disponible, en_cours, defectueux, perdu
  current_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial_number)
);

CREATE TABLE IF NOT EXISTS item_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  quantity integer NOT NULL,
  sonatel_delivery_date date,
  received_at date DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, stock_item_id, batch_number)
);

CREATE TABLE IF NOT EXISTS stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stock_item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
  item_serial_id uuid REFERENCES item_serials(id) ON DELETE SET NULL,
  type text NOT NULL, -- entree, transfert, consommation, echange_sav, ajustement, retour
  quantity integer NOT NULL,
  from_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_number integer NOT NULL,
  designation text NOT NULL,
  unit text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  category text,
  sub_category text,
  version text DEFAULT '2025',
  effective_from date DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, item_number, version)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_company ON warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_company ON stock_items(company_id);
CREATE INDEX IF NOT EXISTS idx_serials_item ON item_serials(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_levels_item ON stock_levels(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_company ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_movements_mission ON stock_movements(mission_id);
CREATE INDEX IF NOT EXISTS idx_price_items_company ON price_items(company_id);
CREATE INDEX IF NOT EXISTS idx_price_items_version ON price_items(company_id, version);

-- ===== Phase 6 : Véhicules (fusion stock mobile) =====

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL UNIQUE REFERENCES warehouses(id) ON DELETE RESTRICT,
  immatriculation text NOT NULL,
  modele text,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL,
  kilometrage integer DEFAULT 0,
  insurance_expiration date,
  technical_inspection_expiration date,
  next_maintenance_km integer,
  monthly_cost numeric(12,2),
  status text DEFAULT 'disponible', -- disponible, en_mission, en_reparation
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, immatriculation)
);

CREATE TABLE IF NOT EXISTS vehicle_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  huile boolean DEFAULT true,
  eau boolean DEFAULT true,
  freins boolean DEFAULT true,
  pneus boolean DEFAULT true,
  batterie boolean DEFAULT true,
  eclairage boolean DEFAULT true,
  observations text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- carte_grise, assurance, visite_technique
  file_url text NOT NULL,
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_team ON vehicles(team_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_vehicle ON vehicle_checks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_day ON vehicle_checks(company_id, vehicle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_vehicle ON vehicle_documents(vehicle_id);

-- ===== Phase 7 : Conformité & Fiches de chantier =====

CREATE TABLE IF NOT EXISTS compliance_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mission_type text NOT NULL,
  items jsonb NOT NULL, -- [{ label, required }]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, mission_type)
);

CREATE TABLE IF NOT EXISTS compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  status text DEFAULT 'incomplet', -- incomplet, en_attente, valide, rejete, a_corriger
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, team_id)
);

CREATE TABLE IF NOT EXISTS company_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- code_conduite, charte_sst, dechets_d3e
  signed boolean DEFAULT false,
  signed_at date,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type text NOT NULL, -- OSM, GC, DENSIF, SURVEY_OSM
  label text NOT NULL,
  description text,
  sections jsonb NOT NULL, -- [{ section, items: [{ id, label, type, unit, priceItem? }] }]
  required_photos jsonb DEFAULT '[]',
  extra_fields jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_compliance_checklists_company ON compliance_checklist_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_company ON compliance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_company ON company_compliance_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_site_templates_company ON site_checklist_templates(company_id);

-- ===== Phase 8 : RH & Comptabilité =====

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  job_title text,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  matricule text,
  status text DEFAULT 'actif', -- actif, en_conge
  habilitation_expiration date,
  documents jsonb DEFAULT '[]', -- [{ type, fileUrl, expirationDate? }]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'en_attente', -- en_attente, approuve, refuse
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  week_start date NOT NULL, -- lundi de la semaine
  monday boolean DEFAULT false,
  tuesday boolean DEFAULT false,
  wednesday boolean DEFAULT false,
  thursday boolean DEFAULT false,
  friday boolean DEFAULT false,
  saturday boolean DEFAULT false,
  sunday boolean DEFAULT false,
  comments text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, technician_id, week_start)
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category text NOT NULL, -- main_oeuvre, materiel, transport, divers
  amount numeric(12,2) NOT NULL,
  receipt_photo_url text,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  description text,
  ai_extracted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_week ON attendance(company_id, week_start);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(company_id, created_at);

-- ===== Phase 9 : Facturation client (ONECOMIT → SONATEL) =====

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'brouillon', -- brouillon, en_correction, finalisee, envoyee
  total_ht numeric(15,2) DEFAULT 0,
  total_tva numeric(15,2) DEFAULT 0,
  total_ttc numeric(15,2) DEFAULT 0,
  penalties_total numeric(15,2) DEFAULT 0,
  corrections jsonb DEFAULT '[]',
  notes text,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  pdf_url text,
  excel_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  category text NOT NULL, -- PRODUCTION, SAV, TS
  item_type text NOT NULL,
  quantity integer DEFAULT 0,
  unit_price numeric(12,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  is_corrected boolean DEFAULT false,
  original_quantity integer,
  original_unit_price numeric(12,2),
  correction_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  target numeric(5,2) NOT NULL,
  actual numeric(5,2) NOT NULL,
  penalty_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(company_id, period_start);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_penalties_invoice ON invoice_penalties(invoice_id);

-- ===== Phase 10 : KPI SONATEL =====

CREATE TABLE IF NOT EXISTS sonatel_kpi_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  target numeric(5,2) NOT NULL,
  actual numeric(5,2) NOT NULL,
  status text NOT NULL, -- atteint, non_atteint
  penalty_amount numeric(12,2) DEFAULT 0,
  evaluation_date date NOT NULL, -- premier jour du mois évalué
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, kpi_name, evaluation_date)
);

CREATE TABLE IF NOT EXISTS sonatel_kpi_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kpi_name text NOT NULL,
  current_value numeric(5,2) NOT NULL,
  target numeric(5,2) NOT NULL,
  gap numeric(5,2) NOT NULL,
  severity text NOT NULL DEFAULT 'warning', -- warning, critical
  alert_date timestamptz NOT NULL DEFAULT now(),
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_logs_company ON sonatel_kpi_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_kpi_logs_eval ON sonatel_kpi_logs(company_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_kpi_alerts_company ON sonatel_kpi_alerts(company_id, kpi_name, is_resolved);

-- ===== Phase 12 : Incidents & IA Vision =====

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_number text NOT NULL,
  source text DEFAULT 'WHATSAPP',
  whatsapp_group text DEFAULT 'REMONTEE',
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  rubrique text NOT NULL, -- PBO, PIO, CHAMBRE
  zone text NOT NULL,
  olt text,
  gps_latitude numeric(10,7),
  gps_longitude numeric(10,7),
  address text,
  pbo_reference text, pbo_defaut text, pbo_annee integer, pbo_semaine text, pbo_plaque text, pbo_constitutions text, pbo_equipe_assignee text,
  pio_type text, pio_etat text, pio_nb_cables integer, pio_cable_type text, pio_accessoires jsonb,
  chambre_type text, chambre_etat text,
  clients_impacted integer DEFAULT 0,
  nd_list text[] DEFAULT '{}',
  annotation_originale text, annotation_parse jsonb,
  photos jsonb DEFAULT '[]',
  status text DEFAULT 'signalement', -- signalement, en_cours, en_attente, corrige, cloture
  severity text DEFAULT 'MINEUR',    -- CRITICAL, MAJEUR, MINEUR, INFORMATION
  assigned_team_id uuid, assigned_technician_ids uuid[] DEFAULT '{}', assigned_at timestamptz, validation_notes text,
  action_taken text, resolution_details jsonb, resolved_at timestamptz, resolved_by uuid,
  report_pdf_url text, report_generated_at timestamptz,
  related_mission_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, incident_number)
);

CREATE TABLE IF NOT EXISTS incident_ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  rubrique_detected text, pbo_reference_detected text, pbo_defaut_detected text,
  pio_type_detected text, pio_etat_detected text,
  chambre_type_detected text, chambre_etat_detected text,
  annotation_extracted text, annotation_parsed jsonb, gps_extracted jsonb,
  confidence_rubrique numeric(5,2), confidence_pbo numeric(5,2), confidence_pio numeric(5,2), confidence_chambre numeric(5,2),
  matched_incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL, matching_confidence numeric(5,2),
  suggested_mission_type text, suggested_severity text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL, validated_at timestamptz, validation_status text,
  is_corrected boolean DEFAULT false, correction_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES incident_ai_analysis(id) ON DELETE CASCADE,
  ai_detected_rubrique text, ai_detected_defaut text, ai_detected_reference text, ai_confidence numeric(5,2),
  human_correction_rubrique text, human_correction_defaut text, human_correction_reference text,
  human_validation boolean DEFAULT true,
  correction_reason text,
  corrected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  is_processed_for_training boolean DEFAULT false, processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(company_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_rubrique ON incidents(company_id, rubrique);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_incident ON incident_ai_analysis(incident_id);
CREATE INDEX IF NOT EXISTS idx_feedback_company ON incident_feedback(company_id, is_processed_for_training);

-- ===== Phase 13 : SaaS (abonnements, limites, facturation) =====

CREATE TABLE IF NOT EXISTS saas_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE, -- MOBILE, WEB, RAG, GEOLOCATION
  description text,
  price_monthly numeric(12,2) NOT NULL,
  price_annual numeric(12,2) NOT NULL,
  features jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saas_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  addon_type text NOT NULL, -- ia_vision, pre_audit, agent_planning, voice
  is_active boolean DEFAULT false,
  price_monthly numeric(12,2) NOT NULL,
  activated_at timestamptz,
  expires_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, addon_type)
);

CREATE TABLE IF NOT EXISTS saas_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan_type text DEFAULT 'base', -- base, premium
  max_photos_per_month integer DEFAULT 10000,
  max_ia_requests_per_month integer DEFAULT 100,
  max_storage_gb integer DEFAULT 10,
  max_api_requests_per_day integer DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code text NOT NULL, -- MOBILE, WEB, RAG, GEOLOCATION
  status text DEFAULT 'active', -- active, suspended, cancelled, expired
  start_date date NOT NULL,
  end_date date,
  billing_cycle text NOT NULL, -- monthly, annual
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saas_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month date NOT NULL,
  photos_count integer DEFAULT 0,
  ia_requests integer DEFAULT 0,
  storage_used_mb integer DEFAULT 0,
  api_requests integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month)
);

CREATE TABLE IF NOT EXISTS invoices_saas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_ht numeric(15,2) DEFAULT 0,
  total_tva numeric(15,2) DEFAULT 0,
  total_ttc numeric(15,2) DEFAULT 0,
  status text DEFAULT 'pending', -- pending, paid, overdue, cancelled
  payment_date date,
  payment_method text, -- bank_transfer, mobile_money, card
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS saas_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices_saas(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL, -- subscription, onboarding, annual_fee, overage
  description text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saas_overage_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices_saas(id) ON DELETE SET NULL,
  type text NOT NULL, -- photos, ia, storage, api
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  total numeric(15,2) NOT NULL,
  month date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saas_addons_company ON saas_addons(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_usage_month ON saas_usage_tracking(company_id, month);
CREATE INDEX IF NOT EXISTS idx_invoices_saas_company ON invoices_saas(company_id);
CREATE INDEX IF NOT EXISTS idx_saas_transactions_invoice ON saas_transactions(invoice_id);

-- ===== Phase 14 : Business & Platform Monitoring =====

CREATE TABLE IF NOT EXISTS platform_monitoring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE, -- null : métrique plateforme
  metric_type text NOT NULL, -- cpu, ram, storage, ia_latency, api_latency, api_500_errors
  value numeric(12,2) NOT NULL,
  threshold numeric(12,2),
  status text NOT NULL, -- ok, warning, critical
  details jsonb DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_metric ON platform_monitoring_logs(metric_type, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_open_alerts ON platform_monitoring_logs(status, resolved_at);

-- ===== Phase 15 : Notifications & IA =====

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL, -- mission_urgente, echeance, stock, incident, paiement, test
  channel text NOT NULL, -- push, whatsapp, email, in_app, telegram
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  status text DEFAULT 'simulated', -- sent, simulated, failed
  read_at timestamptz,
  recipient text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  push_enabled boolean DEFAULT true,
  whatsapp_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  in_app_enabled boolean DEFAULT true,
  telegram_enabled boolean DEFAULT false,
  mission_urgent_enabled boolean DEFAULT true,
  echeance_enabled boolean DEFAULT true,
  stock_alert_enabled boolean DEFAULT true,
  incident_alert_enabled boolean DEFAULT true,
  payment_alert_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL, -- ios, android, web
  device_id text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, token)
);

CREATE TABLE IF NOT EXISTS rag_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  conversation_id uuid NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
  role text NOT NULL, -- user, assistant
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(company_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(company_id, user_id, active);
CREATE INDEX IF NOT EXISTS idx_rag_conversations_user ON rag_conversations(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rag_messages_conversation ON rag_messages(conversation_id, created_at);
