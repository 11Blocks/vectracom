-- =============================================================
-- VECTRACOM — SCHÉMA DE RÉFÉRENCE (MIG-3, 11/11/2026)
--
-- Export de la structure de la PROD (pg_dump --schema-only --no-owner
-- --no-privileges), sans aucune donnée. Exécuté automatiquement par le
-- conteneur PostgreSQL au premier démarrage d'un volume vide.
--
-- Pourquoi : la prod a été façonnée en partie par TypeORM `synchronize`,
-- les migrations 001→021 seules ne reproduisent pas ses colonnes. Une base
-- neuve part donc de ce schéma ; les migrations s'appliquent ensuite
-- par-dessus et sont sans effet (idempotentes).
--
-- Version de la prod exportée : migrations 001→020 appliquées
-- (021 sans effet). À RÉGÉNÉRER après toute évolution du schéma de prod :
--   ssh … "docker exec vectracom-postgres pg_dump -U vectracom -d vectracom
--          --schema-only --no-owner --no-privileges" > 01-schema.sql
--   puis retirer les lignes \restrict / \unrestrict et remettre cet en-tête.
-- =============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 15.19
-- Dumped by pg_dump version 15.19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    technician_id uuid NOT NULL,
    week_start date NOT NULL,
    monday boolean DEFAULT false NOT NULL,
    tuesday boolean DEFAULT false NOT NULL,
    wednesday boolean DEFAULT false NOT NULL,
    thursday boolean DEFAULT false NOT NULL,
    friday boolean DEFAULT false NOT NULL,
    saturday boolean DEFAULT false NOT NULL,
    sunday boolean DEFAULT false NOT NULL,
    comments text,
    validated_by uuid,
    validated_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    payload jsonb,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cash_box_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_box_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    period text NOT NULL,
    type text NOT NULL,
    rubrique text NOT NULL,
    amount numeric(12,2) NOT NULL,
    beneficiary text,
    team_id uuid,
    vehicle_id uuid,
    expense_id uuid,
    note text,
    repaid_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by uuid,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    loan_entry_id uuid
);


--
-- Name: chat_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    room_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
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
    matrix_event_id text
);


--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rooms (
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
    last_message_preview text
);


--
-- Name: client_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    mission_id uuid,
    team_id uuid,
    rating integer NOT NULL,
    cleanliness integer,
    behavior integer,
    comment text,
    client_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    code text,
    ninea text,
    rccm text,
    address text,
    city text,
    contact_name text,
    email text,
    phone text,
    payment_terms_days integer,
    notes text,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sonatel_subcontractor_name text,
    subscription_status text DEFAULT 'trial'::text NOT NULL,
    subscription_start_date date,
    subscription_end_date date,
    trial_end_date date,
    onboarding_paid boolean DEFAULT false NOT NULL,
    platform_fee_paid boolean DEFAULT false NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL,
    contact_name text,
    contact_email text,
    contact_phone text,
    address text,
    city text,
    ninea text,
    rccm text,
    notes text,
    max_users integer,
    archived_at timestamp with time zone,
    bank_name text,
    bank_account text,
    logo_url text,
    invoice_footer text
);


--
-- Name: company_compliance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_compliance_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    doc_type text NOT NULL,
    signed boolean DEFAULT false NOT NULL,
    signed_at date,
    file_url text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: company_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    user_id uuid NOT NULL,
    plan_code text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    mission_type text NOT NULL,
    items jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid NOT NULL,
    status text DEFAULT 'incomplet'::text NOT NULL,
    observations text,
    habilitation_domains text[] DEFAULT '{}'::text[] NOT NULL,
    validation_step text DEFAULT 'documentaire'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_attendances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    daily_worker_id uuid NOT NULL,
    mission_id uuid,
    day date NOT NULL,
    days_worked numeric(5,2) DEFAULT '1'::numeric NOT NULL,
    note text
);


--
-- Name: daily_workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_workers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    full_name text NOT NULL,
    team_id uuid NOT NULL,
    phone text,
    daily_rate numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: dispositif_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositif_entries (
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
    note text
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    job_title text,
    team_id uuid,
    vehicle_id uuid,
    matricule text,
    status text DEFAULT 'actif'::text NOT NULL,
    habilitation_expiration date,
    documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    full_name character varying NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    receipt_photo_url text,
    vehicle_id uuid,
    technician_id uuid,
    mission_id uuid,
    description text,
    ai_extracted boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by uuid
);


--
-- Name: geofence_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geofence_zones (
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
    active boolean DEFAULT true NOT NULL
);


--
-- Name: geopositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geopositions (
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
    source text DEFAULT 'mobile'::text NOT NULL
);


--
-- Name: incident_ai_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_ai_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    incident_id uuid NOT NULL,
    rubrique_detected text,
    pbo_reference_detected text,
    pbo_defaut_detected text,
    pio_type_detected text,
    pio_etat_detected text,
    chambre_type_detected text,
    chambre_etat_detected text,
    annotation_extracted text,
    annotation_parsed jsonb,
    gps_extracted jsonb,
    confidence_rubrique numeric(5,2),
    confidence_pbo numeric(5,2),
    confidence_pio numeric(5,2),
    confidence_chambre numeric(5,2),
    matched_incident_id uuid,
    matching_confidence numeric(5,2),
    suggested_mission_type text,
    suggested_severity text,
    validated_by uuid,
    validated_at timestamp with time zone,
    validation_status text,
    is_corrected boolean DEFAULT false NOT NULL,
    correction_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: incident_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incident_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    incident_id uuid NOT NULL,
    analysis_id uuid NOT NULL,
    ai_detected_rubrique text,
    ai_detected_defaut text,
    ai_detected_reference text,
    ai_confidence numeric(5,2),
    human_correction_rubrique text,
    human_correction_defaut text,
    human_correction_reference text,
    human_validation boolean DEFAULT true NOT NULL,
    correction_reason text,
    corrected_by uuid,
    corrected_at timestamp with time zone DEFAULT now() NOT NULL,
    is_processed_for_training boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    source text DEFAULT 'WHATSAPP'::text NOT NULL,
    whatsapp_group text DEFAULT 'REMONTEE'::text NOT NULL,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    rubrique text NOT NULL,
    zone text NOT NULL,
    olt text,
    gps_latitude numeric(10,7),
    gps_longitude numeric(10,7),
    address text,
    pbo_reference text,
    pbo_defaut text,
    pbo_annee integer,
    pbo_semaine text,
    pbo_plaque text,
    pbo_constitutions text,
    pbo_equipe_assignee text,
    pio_type text,
    pio_etat text,
    pio_nb_cables integer,
    pio_cable_type text,
    pio_accessoires jsonb,
    chambre_type text,
    chambre_etat text,
    clients_impacted integer DEFAULT 0 NOT NULL,
    nd_list text[] DEFAULT '{}'::text[] NOT NULL,
    annotation_originale text,
    annotation_parse jsonb,
    photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'signalement'::text NOT NULL,
    severity text DEFAULT 'MINEUR'::text NOT NULL,
    assigned_team_id uuid,
    assigned_technician_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    assigned_at timestamp with time zone,
    validation_notes text,
    action_taken text,
    resolution_details jsonb,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    report_pdf_url text,
    report_generated_at timestamp with time zone,
    related_mission_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    incident_number character varying NOT NULL,
    description text,
    closed_at timestamp with time zone
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    invoice_id uuid NOT NULL,
    category text NOT NULL,
    item_type text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(15,2) DEFAULT 0 NOT NULL,
    is_corrected boolean DEFAULT false NOT NULL,
    original_quantity numeric(12,3),
    original_unit_price numeric(12,2),
    correction_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    unit text,
    "position" integer DEFAULT 0 NOT NULL
);


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    paid_at date NOT NULL,
    method text DEFAULT 'virement'::text NOT NULL,
    reference text,
    note text,
    recorded_by uuid
);


--
-- Name: invoice_penalties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_penalties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    invoice_id uuid NOT NULL,
    kpi_name text NOT NULL,
    target numeric(5,2) NOT NULL,
    actual numeric(5,2) NOT NULL,
    penalty_amount numeric(12,2) NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text DEFAULT 'brouillon'::text NOT NULL,
    total_ht numeric(15,2) DEFAULT 0 NOT NULL,
    total_tva numeric(15,2) DEFAULT 0 NOT NULL,
    total_ttc numeric(15,2) DEFAULT 0 NOT NULL,
    penalties_total numeric(15,2) DEFAULT 0 NOT NULL,
    corrections jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    generated_by uuid,
    validated_by uuid,
    validated_at timestamp with time zone,
    pdf_url text,
    excel_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    invoice_number character varying NOT NULL,
    kind text DEFAULT 'periodique'::text NOT NULL,
    client_id uuid,
    client_snapshot jsonb,
    title text,
    issue_date date,
    due_date date,
    tva_rate numeric(6,4),
    discount_amount numeric(15,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(15,2) DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    credited_invoice_id uuid,
    mission_count integer DEFAULT 0 NOT NULL
);


--
-- Name: invoices_saas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices_saas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_ht numeric(15,2) DEFAULT 0 NOT NULL,
    total_tva numeric(15,2) DEFAULT 0 NOT NULL,
    total_ttc numeric(15,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_date date,
    payment_method text,
    reference text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    invoice_number character varying NOT NULL
);


--
-- Name: item_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stock_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    sonatel_delivery_date date,
    received_at date,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    batch_number character varying NOT NULL
);


--
-- Name: item_serials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_serials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stock_item_id uuid NOT NULL,
    status text DEFAULT 'disponible'::text NOT NULL,
    current_warehouse_id uuid,
    carton_number text,
    delivered_to_team_id uuid,
    delivered_to_team_at date,
    installed_at_client_nd text,
    installed_at date,
    returned_to_sonatel_at date,
    feraillerie_amount_fcfa integer,
    feraillerie_sold_at date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    serial_number character varying NOT NULL
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    mission_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    team_composition jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kpi_mastery_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_mastery_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    kpi_name text NOT NULL,
    period text NOT NULL,
    analysis text DEFAULT ''::text NOT NULL,
    actions text DEFAULT ''::text NOT NULL,
    responsible text,
    due_date date,
    status text DEFAULT 'ouvert'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: kpi_tco_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_tco_inputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    period text NOT NULL,
    segment text NOT NULL,
    amount numeric(15,2) DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    employee_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'en_attente'::text NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid,
    mission_id uuid,
    expense_type text NOT NULL,
    amount numeric(14,2) NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_field_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_field_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    mission_id uuid NOT NULL,
    mission_type text,
    sst_checklist jsonb,
    sst_photo_url text,
    sst_validated_at timestamp with time zone,
    intervention_type text,
    equipment_code text,
    gps_latitude numeric(10,7),
    gps_longitude numeric(10,7),
    identification_at timestamp with time zone,
    initial_equipment_state text,
    action_realized text,
    dbm_measurement numeric(6,2),
    dbm_out_of_norm boolean DEFAULT false NOT NULL,
    technique_at timestamp with time zone,
    photo_site_url text,
    photo_pbo_interior_url text,
    photo_pbo_closed_url text,
    photo_pto_modem_url text,
    photo_audit_results jsonb,
    photos_at timestamp with time zone,
    materials_consumed jsonb,
    exchange_old_serial_id uuid,
    exchange_new_serial_id uuid,
    materiel_at timestamp with time zone,
    field_status text,
    failure_reason text,
    observations text,
    signature_technician_url text,
    signature_client_url text,
    quality_score numeric(5,2),
    internal_validation_status text DEFAULT 'en_attente'::text NOT NULL,
    sonatel_approval_status text DEFAULT 'en_attente'::text NOT NULL,
    pv_recette_pdf_url text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    price_items_used jsonb DEFAULT '[]'::jsonb NOT NULL,
    recette_status text DEFAULT 'en_attente'::text NOT NULL,
    recette_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    duree_minutes integer,
    montant_total numeric(15,2) DEFAULT 0 NOT NULL,
    sav_action text,
    sav_outcome text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_type_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_type_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    type_name text NOT NULL,
    description text,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    required_photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    checklist_template jsonb DEFAULT '[]'::jsonb NOT NULL,
    workflow jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    label character varying NOT NULL,
    item_id uuid
);


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid,
    technician_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    vehicle_id uuid,
    zone text,
    date_mission timestamp with time zone NOT NULL,
    status text DEFAULT 'planifiee'::text NOT NULL,
    sonatel_dossier_number text,
    sonatel_produit text,
    sonatel_olt text,
    client_generated_id text,
    import_meta jsonb,
    heure_depart_reelle timestamp with time zone,
    heure_arrivee timestamp with time zone,
    taches_effectuees text,
    materiel_utilise jsonb,
    photo_urls text[] DEFAULT '{}'::text[] NOT NULL,
    commentaire_vocal_url text,
    rapport_genere_par_ia text,
    partner_id uuid,
    segment text,
    sr_plaque text,
    coper text,
    commande_client text,
    type_logement text,
    client_avise text,
    contact_client text,
    heure text,
    age_days integer,
    gps_easy_work text,
    blocage_motif text,
    blocage_code text,
    code_operation text,
    va_cap text,
    pilote_sonatel text,
    nbsi integer DEFAULT 0 NOT NULL,
    surcharge boolean DEFAULT false NOT NULL,
    import_source text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    client_site character varying NOT NULL,
    type_tache character varying NOT NULL,
    rejection_reason text,
    rejected_at timestamp with time zone,
    invoice_id uuid,
    cancel_reason text,
    cancelled_at timestamp with time zone,
    item_id uuid,
    rajout boolean DEFAULT false NOT NULL,
    blocage_leve_at timestamp with time zone
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    push_enabled boolean DEFAULT true NOT NULL,
    whatsapp_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    telegram_enabled boolean DEFAULT false NOT NULL,
    mission_urgent_enabled boolean DEFAULT true NOT NULL,
    echeance_enabled boolean DEFAULT true NOT NULL,
    stock_alert_enabled boolean DEFAULT true NOT NULL,
    incident_alert_enabled boolean DEFAULT true NOT NULL,
    payment_alert_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    user_id uuid,
    type text NOT NULL,
    channel text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'simulated'::text NOT NULL,
    read_at timestamp with time zone,
    recipient text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    title character varying NOT NULL
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    price_grid text NOT NULL,
    exclusive_zone text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    level integer,
    parent_partner_id uuid,
    contract_file text,
    bordereau_file text
);


--
-- Name: permanence_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permanence_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    type text NOT NULL,
    team_id uuid,
    day date NOT NULL,
    zone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pilotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pilotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    name text NOT NULL,
    type text DEFAULT 'SONATEL'::text NOT NULL,
    partner_id uuid,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_monitoring_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_monitoring_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    metric_type text NOT NULL,
    value numeric(12,2) NOT NULL,
    threshold numeric(12,2),
    status text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved_at timestamp with time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: price_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    item_number integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    category text,
    sub_category text,
    version text DEFAULT '2025'::text NOT NULL,
    effective_from date,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    price_grid text DEFAULT 'BORDEREAU_3STB'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    designation character varying NOT NULL,
    unit character varying NOT NULL
);


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    parent_partner_id uuid NOT NULL,
    child_partner_id uuid NOT NULL,
    item_id uuid,
    percentage numeric(6,2) NOT NULL,
    effective_from date,
    effective_to date,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prestation_key text
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    device_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    token character varying NOT NULL
);


--
-- Name: rag_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_chunks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL
);


--
-- Name: rag_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    title character varying NOT NULL
);


--
-- Name: rag_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_documents (
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
    uploaded_by uuid
);


--
-- Name: rag_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rag_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recruitment_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_candidates (
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
    hired_technician_id uuid
);


--
-- Name: renforts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.renforts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid NOT NULL,
    from_zone_id uuid,
    to_zone_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    perdiem_per_day numeric(14,2) DEFAULT 1000 NOT NULL,
    status text DEFAULT 'actif'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_addons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_addons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    addon_type text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    price_monthly numeric(12,2) NOT NULL,
    activated_at timestamp with time zone,
    expires_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    plan_type text DEFAULT 'base'::text NOT NULL,
    max_photos_per_month integer DEFAULT 10000 NOT NULL,
    max_ia_requests_per_month integer DEFAULT 100 NOT NULL,
    max_storage_gb integer DEFAULT 10 NOT NULL,
    max_api_requests_per_day integer DEFAULT 500 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_overage_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_overage_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    invoice_id uuid,
    type text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    total numeric(15,2) NOT NULL,
    month date NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    price_monthly numeric(12,2) NOT NULL,
    price_annual numeric(12,2) NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    invoice_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    type text NOT NULL,
    description text,
    transaction_date timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: saas_usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saas_usage_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    month date NOT NULL,
    photos_count integer DEFAULT 0 NOT NULL,
    ia_requests integer DEFAULT 0 NOT NULL,
    storage_used_mb integer DEFAULT 0 NOT NULL,
    api_requests integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_change_logs (
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
    reason text
);


--
-- Name: site_checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    template_type text NOT NULL,
    description text,
    sections jsonb NOT NULL,
    required_photos jsonb DEFAULT '[]'::jsonb NOT NULL,
    extra_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    label character varying NOT NULL
);


--
-- Name: sonatel_column_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sonatel_column_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    sheet_type text NOT NULL,
    source_column_name text NOT NULL,
    target_field text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sonatel_kpi_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sonatel_kpi_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    kpi_name text NOT NULL,
    current_value numeric(5,2) NOT NULL,
    target numeric(5,2) NOT NULL,
    gap numeric(5,2) NOT NULL,
    severity text NOT NULL,
    alert_date timestamp with time zone DEFAULT now() NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sonatel_kpi_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sonatel_kpi_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    kpi_name text NOT NULL,
    target numeric(5,2) NOT NULL,
    actual numeric(5,2) NOT NULL,
    status text NOT NULL,
    penalty_amount numeric(12,2) DEFAULT 0 NOT NULL,
    evaluation_date date NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    family text DEFAULT 'production'::text NOT NULL,
    penalty_mode text DEFAULT 'TCO'::text NOT NULL,
    unit_count numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    category text NOT NULL,
    family text NOT NULL,
    unit text,
    threshold_alert integer DEFAULT 10 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    reference character varying NOT NULL,
    designation character varying NOT NULL
);


--
-- Name: stock_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stock_item_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    threshold_alert integer,
    threshold_critical integer,
    last_inventory_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stock_item_id uuid NOT NULL,
    item_serial_id uuid,
    type text NOT NULL,
    quantity integer NOT NULL,
    from_warehouse_id uuid,
    to_warehouse_id uuid,
    mission_id uuid,
    technician_id uuid,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    cancelled_by uuid,
    deltas jsonb
);


--
-- Name: stock_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    stock_item_id uuid,
    designation text NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(14,2) NOT NULL,
    reason text,
    status text DEFAULT 'en_attente'::text NOT NULL,
    sonatel_validated_at timestamp with time zone,
    invoice_id uuid,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_payrolls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_payrolls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid NOT NULL,
    period text NOT NULL,
    revenue numeric(15,2) DEFAULT 0 NOT NULL,
    chef_share numeric(15,2) DEFAULT 0 NOT NULL,
    binome_share numeric(15,2) DEFAULT 0 NOT NULL,
    chef_id uuid,
    binome_id uuid,
    status text DEFAULT 'brouillon'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    type text NOT NULL,
    zone text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL,
    zone_id uuid,
    pilot_id uuid,
    item_id uuid,
    repartition_chef_pct numeric(5,2) DEFAULT 65 NOT NULL
);


--
-- Name: technicians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technicians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    team_id uuid NOT NULL,
    user_id uuid,
    phone text,
    habilitation_sst_expiration date,
    habilitation_conduite_expiration date,
    is_team_leader boolean DEFAULT false NOT NULL,
    team_leader_id uuid,
    experience_years integer,
    contract_type text,
    competences jsonb DEFAULT '[]'::jsonb NOT NULL,
    documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    full_name character varying NOT NULL,
    fonction text,
    item_id uuid,
    zone_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    role text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    license_type text,
    license_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    password_reset_token text,
    password_reset_expires timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    full_name character varying NOT NULL,
    phone text,
    must_change_password boolean DEFAULT false NOT NULL,
    password_changed_at timestamp with time zone
);


--
-- Name: vehicle_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    vehicle_id uuid NOT NULL,
    mission_id uuid,
    huile boolean DEFAULT true NOT NULL,
    eau boolean DEFAULT true NOT NULL,
    freins boolean DEFAULT true NOT NULL,
    pneus boolean DEFAULT true NOT NULL,
    batterie boolean DEFAULT true NOT NULL,
    eclairage boolean DEFAULT true NOT NULL,
    observations text,
    photo_url text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicle_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    vehicle_id uuid NOT NULL,
    doc_type text NOT NULL,
    file_url text NOT NULL,
    expiration_date date,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicle_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_events (
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
    mission_id uuid
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    warehouse_id uuid NOT NULL,
    modele text,
    team_id uuid,
    technician_id uuid,
    kilometrage integer DEFAULT 0 NOT NULL,
    insurance_expiration date,
    technical_inspection_expiration date,
    next_maintenance_km integer,
    monthly_cost numeric(12,2),
    status text DEFAULT 'disponible'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    immatriculation character varying NOT NULL
);


--
-- Name: vision_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vision_uploads (
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
    uploaded_by uuid
);


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    type text NOT NULL,
    zone text,
    region text,
    sub_zone text,
    code text,
    parent_warehouse_id uuid,
    gps_latitude numeric(10,7),
    gps_longitude numeric(10,7),
    capacity_m3 integer,
    security_level text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name character varying NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    name text NOT NULL,
    code text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rag_documents PK_0c27c0f160af990a817ba71c32a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_documents
    ADD CONSTRAINT "PK_0c27c0f160af990a817ba71c32a" PRIMARY KEY (id);


--
-- Name: recruitment_candidates PK_10ba3ccf9094cb97591f9a82a6a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_candidates
    ADD CONSTRAINT "PK_10ba3ccf9094cb97591f9a82a6a" PRIMARY KEY (id);


--
-- Name: daily_attendances PK_32756f404a472f0cbbd978c7ae5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT "PK_32756f404a472f0cbbd978c7ae5" PRIMARY KEY (id);


--
-- Name: chat_messages PK_40c55ee0e571e268b0d3cd37d10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY (id);


--
-- Name: vehicle_events PK_49b6940551020a9a5cdcec28673; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_events
    ADD CONSTRAINT "PK_49b6940551020a9a5cdcec28673" PRIMARY KEY (id);


--
-- Name: geopositions PK_5430f5ea1c5264f4603aadd6665; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geopositions
    ADD CONSTRAINT "PK_5430f5ea1c5264f4603aadd6665" PRIMARY KEY (id);


--
-- Name: rag_chunks PK_5775a2e48c4774fbb9203b22fcd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunks
    ADD CONSTRAINT "PK_5775a2e48c4774fbb9203b22fcd" PRIMARY KEY (id);


--
-- Name: cash_box_entries PK_61b3e34550cfd8857e83e83856c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_box_entries
    ADD CONSTRAINT "PK_61b3e34550cfd8857e83e83856c" PRIMARY KEY (id);


--
-- Name: settings_change_logs PK_673d94d8ab7b828a574f7bfa98a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_change_logs
    ADD CONSTRAINT "PK_673d94d8ab7b828a574f7bfa98a" PRIMARY KEY (id);


--
-- Name: vision_uploads PK_965b6702ad6694e38df24aeb8f4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vision_uploads
    ADD CONSTRAINT "PK_965b6702ad6694e38df24aeb8f4" PRIMARY KEY (id);


--
-- Name: dispositif_entries PK_ab68cbb4d774048f473d3e969da; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositif_entries
    ADD CONSTRAINT "PK_ab68cbb4d774048f473d3e969da" PRIMARY KEY (id);


--
-- Name: chat_memberships PK_ac1bbb1543acbd19243c69845c7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_memberships
    ADD CONSTRAINT "PK_ac1bbb1543acbd19243c69845c7" PRIMARY KEY (id);


--
-- Name: chat_rooms PK_c69082bd83bffeb71b0f455bd59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT "PK_c69082bd83bffeb71b0f455bd59" PRIMARY KEY (id);


--
-- Name: daily_workers PK_d7d19fc97535a4b56752931af64; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_workers
    ADD CONSTRAINT "PK_d7d19fc97535a4b56752931af64" PRIMARY KEY (id);


--
-- Name: geofence_zones PK_ea4a1d9e1ff81eee336b4e8d071; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geofence_zones
    ADD CONSTRAINT "PK_ea4a1d9e1ff81eee336b4e8d071" PRIMARY KEY (id);


--
-- Name: company_settings UQ_717089d5a18a8b594c0184663ae; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT "UQ_717089d5a18a8b594c0184663ae" UNIQUE (company_id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: client_feedback client_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_feedback
    ADD CONSTRAINT client_feedback_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_compliance_documents company_compliance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_compliance_documents
    ADD CONSTRAINT company_compliance_documents_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: company_subscriptions company_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_subscriptions
    ADD CONSTRAINT company_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: compliance_checklist_templates compliance_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checklist_templates
    ADD CONSTRAINT compliance_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: compliance_records compliance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_records
    ADD CONSTRAINT compliance_records_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: incident_ai_analysis incident_ai_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_ai_analysis
    ADD CONSTRAINT incident_ai_analysis_pkey PRIMARY KEY (id);


--
-- Name: incident_feedback incident_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_feedback
    ADD CONSTRAINT incident_feedback_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoice_penalties invoice_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_penalties
    ADD CONSTRAINT invoice_penalties_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices_saas invoices_saas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices_saas
    ADD CONSTRAINT invoices_saas_pkey PRIMARY KEY (id);


--
-- Name: item_batches item_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_batches
    ADD CONSTRAINT item_batches_pkey PRIMARY KEY (id);


--
-- Name: item_serials item_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT item_serials_pkey PRIMARY KEY (id);


--
-- Name: items items_company_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_company_id_code_key UNIQUE (company_id, code);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: kpi_mastery_plans kpi_mastery_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_mastery_plans
    ADD CONSTRAINT kpi_mastery_plans_pkey PRIMARY KEY (id);


--
-- Name: kpi_tco_inputs kpi_tco_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_tco_inputs
    ADD CONSTRAINT kpi_tco_inputs_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: mission_expenses mission_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expenses
    ADD CONSTRAINT mission_expenses_pkey PRIMARY KEY (id);


--
-- Name: mission_field_reports mission_field_reports_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_field_reports
    ADD CONSTRAINT mission_field_reports_mission_id_key UNIQUE (mission_id);


--
-- Name: mission_field_reports mission_field_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_field_reports
    ADD CONSTRAINT mission_field_reports_pkey PRIMARY KEY (id);


--
-- Name: mission_type_templates mission_type_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_type_templates
    ADD CONSTRAINT mission_type_templates_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_company_id_key UNIQUE (company_id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: permanence_slots permanence_slots_company_id_type_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permanence_slots
    ADD CONSTRAINT permanence_slots_company_id_type_day_key UNIQUE (company_id, type, day);


--
-- Name: permanence_slots permanence_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permanence_slots
    ADD CONSTRAINT permanence_slots_pkey PRIMARY KEY (id);


--
-- Name: pilotes pilotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pilotes
    ADD CONSTRAINT pilotes_pkey PRIMARY KEY (id);


--
-- Name: platform_monitoring_logs platform_monitoring_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_monitoring_logs
    ADD CONSTRAINT platform_monitoring_logs_pkey PRIMARY KEY (id);


--
-- Name: price_items price_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_items
    ADD CONSTRAINT price_items_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: rag_conversations rag_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_conversations
    ADD CONSTRAINT rag_conversations_pkey PRIMARY KEY (id);


--
-- Name: rag_messages rag_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_messages
    ADD CONSTRAINT rag_messages_pkey PRIMARY KEY (id);


--
-- Name: renforts renforts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renforts
    ADD CONSTRAINT renforts_pkey PRIMARY KEY (id);


--
-- Name: saas_addons saas_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_addons
    ADD CONSTRAINT saas_addons_pkey PRIMARY KEY (id);


--
-- Name: saas_limits saas_limits_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_limits
    ADD CONSTRAINT saas_limits_company_id_key UNIQUE (company_id);


--
-- Name: saas_limits saas_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_limits
    ADD CONSTRAINT saas_limits_pkey PRIMARY KEY (id);


--
-- Name: saas_overage_bills saas_overage_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_overage_bills
    ADD CONSTRAINT saas_overage_bills_pkey PRIMARY KEY (id);


--
-- Name: saas_plans saas_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_code_key UNIQUE (code);


--
-- Name: saas_plans saas_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_plans
    ADD CONSTRAINT saas_plans_pkey PRIMARY KEY (id);


--
-- Name: saas_transactions saas_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_transactions
    ADD CONSTRAINT saas_transactions_pkey PRIMARY KEY (id);


--
-- Name: saas_usage_tracking saas_usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_usage_tracking
    ADD CONSTRAINT saas_usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: site_checklist_templates site_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_checklist_templates
    ADD CONSTRAINT site_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: sonatel_column_mappings sonatel_column_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonatel_column_mappings
    ADD CONSTRAINT sonatel_column_mappings_pkey PRIMARY KEY (id);


--
-- Name: sonatel_kpi_alerts sonatel_kpi_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonatel_kpi_alerts
    ADD CONSTRAINT sonatel_kpi_alerts_pkey PRIMARY KEY (id);


--
-- Name: sonatel_kpi_logs sonatel_kpi_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonatel_kpi_logs
    ADD CONSTRAINT sonatel_kpi_logs_pkey PRIMARY KEY (id);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_levels stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT stock_levels_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_purchases stock_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_purchases
    ADD CONSTRAINT stock_purchases_pkey PRIMARY KEY (id);


--
-- Name: team_payrolls team_payrolls_company_id_team_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_payrolls
    ADD CONSTRAINT team_payrolls_company_id_team_id_period_key UNIQUE (company_id, team_id, period);


--
-- Name: team_payrolls team_payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_payrolls
    ADD CONSTRAINT team_payrolls_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);


--
-- Name: sonatel_column_mappings uq_column_mapping; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sonatel_column_mappings
    ADD CONSTRAINT uq_column_mapping UNIQUE (company_id, sheet_type, source_column_name);


--
-- Name: dispositif_entries uq_dispositif_day_zone_team; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositif_entries
    ADD CONSTRAINT uq_dispositif_day_zone_team UNIQUE (company_id, day, zone_name, team_name);


--
-- Name: invoices_saas uq_invoices_saas_company_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices_saas
    ADD CONSTRAINT uq_invoices_saas_company_number UNIQUE (company_id, invoice_number);


--
-- Name: kpi_mastery_plans uq_mastery_kpi_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_mastery_plans
    ADD CONSTRAINT uq_mastery_kpi_period UNIQUE (company_id, kpi_name, period);


--
-- Name: partners uq_partner_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT uq_partner_code UNIQUE (company_id, code);


--
-- Name: push_tokens uq_push_tokens_user_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT uq_push_tokens_user_token UNIQUE (company_id, user_id, token);


--
-- Name: saas_addons uq_saas_addons_company_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_addons
    ADD CONSTRAINT uq_saas_addons_company_type UNIQUE (company_id, addon_type);


--
-- Name: saas_usage_tracking uq_saas_usage_company_month; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_usage_tracking
    ADD CONSTRAINT uq_saas_usage_company_month UNIQUE (company_id, month);


--
-- Name: stock_levels uq_stock_level; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT uq_stock_level UNIQUE (stock_item_id, warehouse_id);


--
-- Name: kpi_tco_inputs uq_tco_period_segment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_tco_inputs
    ADD CONSTRAINT uq_tco_period_segment UNIQUE (company_id, period, segment);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_checks vehicle_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_checks
    ADD CONSTRAINT vehicle_checks_pkey PRIMARY KEY (id);


--
-- Name: vehicle_documents vehicle_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_documents
    ADD CONSTRAINT vehicle_documents_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: zones zones_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_company_id_name_key UNIQUE (company_id, name);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: IDX_0232f36e3a20e0ace60caf916a; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_0232f36e3a20e0ace60caf916a" ON public.mission_type_templates USING btree (company_id, type_name);


--
-- Name: IDX_03cfc0c10f9efc635d2cf6e5db; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03cfc0c10f9efc635d2cf6e5db" ON public.dispositif_entries USING btree (company_id, day);


--
-- Name: IDX_091c6c6f146e3e26df51ea1356; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_091c6c6f146e3e26df51ea1356" ON public.daily_attendances USING btree (company_id);


--
-- Name: IDX_0aa4c0ffc36ddb76fee4e05ea4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0aa4c0ffc36ddb76fee4e05ea4" ON public.company_subscriptions USING btree (company_id);


--
-- Name: IDX_0b82e2a2e91c08760f01cd60d6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0b82e2a2e91c08760f01cd60d6" ON public.sonatel_column_mappings USING btree (company_id);


--
-- Name: IDX_0c234f1ffed7ab3a15488ef397; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0c234f1ffed7ab3a15488ef397" ON public.incident_feedback USING btree (company_id, is_processed_for_training);


--
-- Name: IDX_0fd259b016a184d5e1e903b94f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_0fd259b016a184d5e1e903b94f" ON public.missions USING btree (company_id, sonatel_dossier_number);


--
-- Name: IDX_10a590f29449a3a83c9fcd5b3b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_10a590f29449a3a83c9fcd5b3b" ON public.teams USING btree (company_id);


--
-- Name: IDX_1576a391a7038da9282e467289; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1576a391a7038da9282e467289" ON public.incident_ai_analysis USING btree (company_id, incident_id);


--
-- Name: IDX_166b4186ff6a26aefd94cd9300; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_166b4186ff6a26aefd94cd9300" ON public.vehicles USING btree (company_id, immatriculation);


--
-- Name: IDX_1689e59e33c221124674ab3867; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1689e59e33c221124674ab3867" ON public.expenses USING btree (company_id, created_at);


--
-- Name: IDX_174f1300a78e7a5e4c5ae8a7bf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_174f1300a78e7a5e4c5ae8a7bf" ON public.saas_overage_bills USING btree (company_id, month, type);


--
-- Name: IDX_1a1c2405db4aada4c766c1461c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1a1c2405db4aada4c766c1461c" ON public.platform_monitoring_logs USING btree (company_id);


--
-- Name: IDX_1c8efeb8e56e8970db7c239767; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1c8efeb8e56e8970db7c239767" ON public.recruitment_candidates USING btree (company_id, status);


--
-- Name: IDX_1d08bcca123812309375889879; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1d08bcca123812309375889879" ON public.kpi_tco_inputs USING btree (company_id, period);


--
-- Name: IDX_1d84392882cd6205b5f1f7261f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1d84392882cd6205b5f1f7261f" ON public.company_compliance_documents USING btree (company_id);


--
-- Name: IDX_1e4616024037831d22120d74a8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1e4616024037831d22120d74a8" ON public.chat_rooms USING btree (company_id, kind, team_id);


--
-- Name: IDX_225b592b205b6956af6374cd8f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_225b592b205b6956af6374cd8f" ON public.daily_workers USING btree (company_id);


--
-- Name: IDX_231451502651b83f80c73f8b40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_231451502651b83f80c73f8b40" ON public.missions USING btree (company_id);


--
-- Name: IDX_23999c6503198529c196a952a1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_23999c6503198529c196a952a1" ON public.kpi_tco_inputs USING btree (company_id);


--
-- Name: IDX_2401d4b7e197226134cd560d81; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2401d4b7e197226134cd560d81" ON public.item_batches USING btree (company_id);


--
-- Name: IDX_2804590631f1023c5a4ded0290; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2804590631f1023c5a4ded0290" ON public.chat_memberships USING btree (company_id, room_id, user_id);


--
-- Name: IDX_28d130e6315f878891019ee9c0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_28d130e6315f878891019ee9c0" ON public.vehicle_documents USING btree (company_id);


--
-- Name: IDX_2919e980f21dba847939a67f57; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2919e980f21dba847939a67f57" ON public.compliance_checklist_templates USING btree (company_id);


--
-- Name: IDX_2ab7762cc4e6177e240da28e57; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2ab7762cc4e6177e240da28e57" ON public.settings_change_logs USING btree (company_id);


--
-- Name: IDX_2ac99f73722fa8e9e2bbb67b17; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2ac99f73722fa8e9e2bbb67b17" ON public.sonatel_kpi_alerts USING btree (company_id);


--
-- Name: IDX_2c42e9dfc3394bc1dbfdf6af52; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2c42e9dfc3394bc1dbfdf6af52" ON public.invoices_saas USING btree (company_id);


--
-- Name: IDX_2dec370439f9936a0c50a0ab99; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2dec370439f9936a0c50a0ab99" ON public.saas_plans USING btree (company_id);


--
-- Name: IDX_304915064813a4c74f1777ec3e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_304915064813a4c74f1777ec3e" ON public.mission_field_reports USING btree (mission_id);


--
-- Name: IDX_338adeb7507f3ecfdf53581bfd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_338adeb7507f3ecfdf53581bfd" ON public.chat_messages USING btree (company_id);


--
-- Name: IDX_39644a1a10d75b6f2148eb891a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_39644a1a10d75b6f2148eb891a" ON public.attendance USING btree (company_id);


--
-- Name: IDX_39b1550414cdd3ae88f14c3892; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_39b1550414cdd3ae88f14c3892" ON public.saas_transactions USING btree (company_id, invoice_id);


--
-- Name: IDX_3d8526f36c53597e356832125e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3d8526f36c53597e356832125e" ON public.stock_items USING btree (company_id);


--
-- Name: IDX_3dacbb3eb4f095e29372ff8e13; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_3dacbb3eb4f095e29372ff8e13" ON public.companies USING btree (name);


--
-- Name: IDX_3ddd0eb78dd9c000e1725c949c; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_3ddd0eb78dd9c000e1725c949c" ON public.attendance USING btree (company_id, technician_id, week_start);


--
-- Name: IDX_3ea449f56809c2381ff2964de2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3ea449f56809c2381ff2964de2" ON public.vision_uploads USING btree (company_id);


--
-- Name: IDX_3fc6f7aa2c12441773a29429ea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3fc6f7aa2c12441773a29429ea" ON public.sonatel_kpi_alerts USING btree (company_id, kpi_name, is_resolved);


--
-- Name: IDX_3fcbfd5832b46945f514a7d1f5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3fcbfd5832b46945f514a7d1f5" ON public.warehouses USING btree (company_id);


--
-- Name: IDX_40e74bafa57a1e05a70578abfc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_40e74bafa57a1e05a70578abfc" ON public.invoice_penalties USING btree (company_id);


--
-- Name: IDX_42385e42f092f26bd38df54971; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_42385e42f092f26bd38df54971" ON public.invoices USING btree (company_id);


--
-- Name: IDX_4266dfa5969fd10b2b73632c35; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4266dfa5969fd10b2b73632c35" ON public.saas_transactions USING btree (company_id);


--
-- Name: IDX_428cc46bdd856f75b17743eb33; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_428cc46bdd856f75b17743eb33" ON public.warehouses USING btree (company_id, name);


--
-- Name: IDX_43c15abe870cf2a725b3d722b7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_43c15abe870cf2a725b3d722b7" ON public.leave_requests USING btree (company_id);


--
-- Name: IDX_47982aafce20f1e22a74b6abcc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_47982aafce20f1e22a74b6abcc" ON public.incident_feedback USING btree (company_id);


--
-- Name: IDX_48ab67cfd273198c91f8f319fa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_48ab67cfd273198c91f8f319fa" ON public.saas_addons USING btree (company_id);


--
-- Name: IDX_4c7791ad7dc252cf3a702e193a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4c7791ad7dc252cf3a702e193a" ON public.invoice_lines USING btree (company_id);


--
-- Name: IDX_4dc969c4bb8fc98e99046c6551; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4dc969c4bb8fc98e99046c6551" ON public.dispositif_entries USING btree (company_id);


--
-- Name: IDX_591cb1d877a1e8ad0b91c9f251; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_591cb1d877a1e8ad0b91c9f251" ON public.vehicle_checks USING btree (company_id, vehicle_id, created_at);


--
-- Name: IDX_5987387ef8845d566b409d8c8d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5987387ef8845d566b409d8c8d" ON public.geofence_zones USING btree (company_id);


--
-- Name: IDX_5c64f92a726ebd11df7f4a45ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5c64f92a726ebd11df7f4a45ae" ON public.stock_movements USING btree (company_id);


--
-- Name: IDX_5faaca9891738e9a7d7f525a9d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5faaca9891738e9a7d7f525a9d" ON public.leave_requests USING btree (company_id, employee_id);


--
-- Name: IDX_60faf1a6e01bace23c06624d0c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_60faf1a6e01bace23c06624d0c" ON public.settings_change_logs USING btree (company_id, created_at);


--
-- Name: IDX_61cbd4ccbb85558e0149825678; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_61cbd4ccbb85558e0149825678" ON public.vehicle_events USING btree (company_id);


--
-- Name: IDX_643311148ea32bbb068961d23b; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_643311148ea32bbb068961d23b" ON public.compliance_records USING btree (company_id, team_id);


--
-- Name: IDX_66606af6d2f9b8782f1b507a39; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_66606af6d2f9b8782f1b507a39" ON public.price_items USING btree (company_id, item_number, version, price_grid);


--
-- Name: IDX_688b72c1ad9ad765c3349a7d76; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_688b72c1ad9ad765c3349a7d76" ON public.rag_documents USING btree (company_id, category);


--
-- Name: IDX_6f076acce39f838fbe3a5017c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6f076acce39f838fbe3a5017c6" ON public.rag_conversations USING btree (company_id);


--
-- Name: IDX_717089d5a18a8b594c0184663a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_717089d5a18a8b594c0184663a" ON public.company_settings USING btree (company_id);


--
-- Name: IDX_74d0f81758f5a3ae3c17d0a9ce; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_74d0f81758f5a3ae3c17d0a9ce" ON public.technicians USING btree (company_id);


--
-- Name: IDX_77c5140abe28f2567a2e2635a7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_77c5140abe28f2567a2e2635a7" ON public.rag_documents USING btree (company_id);


--
-- Name: IDX_78555e23d0c076dd2e0477a157; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_78555e23d0c076dd2e0477a157" ON public.vehicle_events USING btree (company_id, vehicle_id, type);


--
-- Name: IDX_7a460757efbc5d740129ad6a00; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_7a460757efbc5d740129ad6a00" ON public.incidents USING btree (company_id, incident_number);


--
-- Name: IDX_7ae6334059289559722437bcc1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7ae6334059289559722437bcc1" ON public.users USING btree (company_id);


--
-- Name: IDX_7ec537036340ca7361eb79c410; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7ec537036340ca7361eb79c410" ON public.daily_attendances USING btree (company_id, mission_id, day);


--
-- Name: IDX_7f3eeef59eece4147effe7bfa6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7f3eeef59eece4147effe7bfa6" ON public.employees USING btree (company_id);


--
-- Name: IDX_8062b1f5c2f48d197c647827d2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8062b1f5c2f48d197c647827d2" ON public.sonatel_kpi_logs USING btree (company_id);


--
-- Name: IDX_8442b5c608eda6fa0ec2857cba; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8442b5c608eda6fa0ec2857cba" ON public.saas_limits USING btree (company_id);


--
-- Name: IDX_8515417a63c4fa5e11e10f2410; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8515417a63c4fa5e11e10f2410" ON public.vehicle_checks USING btree (company_id);


--
-- Name: IDX_85389c627f20798554ac2bfb05; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_85389c627f20798554ac2bfb05" ON public.expenses USING btree (company_id);


--
-- Name: IDX_87720806e89f9336e463c08d8c; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_87720806e89f9336e463c08d8c" ON public.site_checklist_templates USING btree (company_id, template_type);


--
-- Name: IDX_8b048d588cf1e79f02f65309ed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8b048d588cf1e79f02f65309ed" ON public.recruitment_candidates USING btree (company_id);


--
-- Name: IDX_8c008cd5c4c0c20cf1e77f68e8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8c008cd5c4c0c20cf1e77f68e8" ON public.companies USING btree (company_id);


--
-- Name: IDX_8c2ffd053348b91d27a4150b8c; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_8c2ffd053348b91d27a4150b8c" ON public.compliance_checklist_templates USING btree (company_id, mission_type);


--
-- Name: IDX_9210254fc6403c0470db452240; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9210254fc6403c0470db452240" ON public.sonatel_kpi_logs USING btree (company_id, kpi_name, evaluation_date);


--
-- Name: IDX_952729196ba498f09a2712a4f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_952729196ba498f09a2712a4f0" ON public.invoice_penalties USING btree (company_id, invoice_id);


--
-- Name: IDX_9620dd7b6674389f9d99f95f71; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9620dd7b6674389f9d99f95f71" ON public.cash_box_entries USING btree (company_id);


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- Name: IDX_99f24624c7440cc4c8169041bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_99f24624c7440cc4c8169041bc" ON public.mission_field_reports USING btree (company_id);


--
-- Name: IDX_9d4c5690b812c68a95d1bf2d3f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9d4c5690b812c68a95d1bf2d3f" ON public.item_batches USING btree (company_id, stock_item_id, batch_number);


--
-- Name: IDX_9d7669f5a7cabc5a06bdedafcd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9d7669f5a7cabc5a06bdedafcd" ON public.geofence_zones USING btree (company_id, active);


--
-- Name: IDX_a25bea0e4c8c0e92a379aa56c7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a25bea0e4c8c0e92a379aa56c7" ON public.chat_messages USING btree (company_id, room_id, created_at);


--
-- Name: IDX_a7134a13561432adcd4ed29c4d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a7134a13561432adcd4ed29c4d" ON public.daily_workers USING btree (company_id, team_id);


--
-- Name: IDX_a82faec53f02038ffa3647b6c3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a82faec53f02038ffa3647b6c3" ON public.cash_box_entries USING btree (company_id, period);


--
-- Name: IDX_a89bafd030e283f793ffa98999; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a89bafd030e283f793ffa98999" ON public.kpi_mastery_plans USING btree (company_id, period);


--
-- Name: IDX_ab1a9d73c5038907d1c75b9744; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_ab1a9d73c5038907d1c75b9744" ON public.vehicles USING btree (warehouse_id);


--
-- Name: IDX_ad10450652cd148f84f7311234; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ad10450652cd148f84f7311234" ON public.chat_rooms USING btree (company_id);


--
-- Name: IDX_b08a0191ad70063a9a9517700e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b08a0191ad70063a9a9517700e" ON public.vision_uploads USING btree (company_id, created_at);


--
-- Name: IDX_b5687c9cc7aa4bde562ee31698; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b5687c9cc7aa4bde562ee31698" ON public.site_checklist_templates USING btree (company_id);


--
-- Name: IDX_badcb77ee0329b1f3628545517; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_badcb77ee0329b1f3628545517" ON public.incidents USING btree (company_id);


--
-- Name: IDX_bcf60378d4d80e027b0ee0b8ad; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_bcf60378d4d80e027b0ee0b8ad" ON public.teams USING btree (company_id, name);


--
-- Name: IDX_bf4ad080b8aa3e9d87db3107f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bf4ad080b8aa3e9d87db3107f0" ON public.rag_messages USING btree (conversation_id, created_at);


--
-- Name: IDX_c19983cc8ec76aec9c82c118c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c19983cc8ec76aec9c82c118c8" ON public.saas_overage_bills USING btree (company_id);


--
-- Name: IDX_c1cdf31957221d52c5984beedd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c1cdf31957221d52c5984beedd" ON public.compliance_records USING btree (company_id);


--
-- Name: IDX_c4232e5f0f8c9573f0a2d2614b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c4232e5f0f8c9573f0a2d2614b" ON public.partners USING btree (company_id, active);


--
-- Name: IDX_c642fb845de2edcae46635863a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c642fb845de2edcae46635863a" ON public.notifications USING btree (company_id);


--
-- Name: IDX_c72926e1735b41a93b9c5f57c0; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_c72926e1735b41a93b9c5f57c0" ON public.invoices USING btree (company_id, invoice_number);


--
-- Name: IDX_c82c9b15d642c0260da7dee6ac; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c82c9b15d642c0260da7dee6ac" ON public.invoice_lines USING btree (company_id, invoice_id);


--
-- Name: IDX_c9105f2a390b1017004bbfefed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c9105f2a390b1017004bbfefed" ON public.item_serials USING btree (company_id);


--
-- Name: IDX_cc72d3c2c3c440e66bc18dbdf4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cc72d3c2c3c440e66bc18dbdf4" ON public.push_tokens USING btree (company_id);


--
-- Name: IDX_ccac50e350e9e990b2d9f1b12f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ccac50e350e9e990b2d9f1b12f" ON public.vehicle_documents USING btree (company_id, vehicle_id, doc_type);


--
-- Name: IDX_cf3864f7d50ba1f506e80baf31; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf3864f7d50ba1f506e80baf31" ON public.platform_monitoring_logs USING btree (metric_type, created_at);


--
-- Name: IDX_cf76b38b60d7eb359e87587ebb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf76b38b60d7eb359e87587ebb" ON public.company_compliance_documents USING btree (company_id, doc_type);


--
-- Name: IDX_d08d7da2bce2135ae07c78737e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_d08d7da2bce2135ae07c78737e" ON public.stock_items USING btree (company_id, reference);


--
-- Name: IDX_d0ac0faac252c659db83a8b590; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d0ac0faac252c659db83a8b590" ON public.geopositions USING btree (company_id, technician_id, recorded_at);


--
-- Name: IDX_d6090cfafcf8fe700f85dea2ee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d6090cfafcf8fe700f85dea2ee" ON public.geopositions USING btree (company_id);


--
-- Name: IDX_d756fef9bac7f27bc40f1c35c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d756fef9bac7f27bc40f1c35c6" ON public.company_subscriptions USING btree (company_id, user_id, status);


--
-- Name: IDX_dc4cd549acf1e13b9e49a32fc5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dc4cd549acf1e13b9e49a32fc5" ON public.notification_settings USING btree (company_id);


--
-- Name: IDX_ded346ee7a4ca152622fa3b92e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ded346ee7a4ca152622fa3b92e" ON public.rag_chunks USING btree (company_id, document_id);


--
-- Name: IDX_e0dd0c4f1c783d1fd1755708ba; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e0dd0c4f1c783d1fd1755708ba" ON public.kpi_mastery_plans USING btree (company_id);


--
-- Name: IDX_e11ef2dcd880132d31bd9f92c2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e11ef2dcd880132d31bd9f92c2" ON public.vehicles USING btree (company_id);


--
-- Name: IDX_e1d18a12b748c0ef3beb4fc129; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e1d18a12b748c0ef3beb4fc129" ON public.rag_messages USING btree (company_id);


--
-- Name: IDX_e4cd937a37833f127e7ff97b8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e4cd937a37833f127e7ff97b8c" ON public.incident_ai_analysis USING btree (company_id);


--
-- Name: IDX_e50e242637e5f6a9d206f01511; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e50e242637e5f6a9d206f01511" ON public.rag_conversations USING btree (company_id, user_id);


--
-- Name: IDX_ecc6f5ac7f32cd804ab8372491; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ecc6f5ac7f32cd804ab8372491" ON public.rag_chunks USING btree (company_id);


--
-- Name: IDX_ee86460b182d66bb51a4fb5309; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ee86460b182d66bb51a4fb5309" ON public.mission_type_templates USING btree (company_id);


--
-- Name: IDX_f0f7c95ea51b9756d80e99c29a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f0f7c95ea51b9756d80e99c29a" ON public.saas_usage_tracking USING btree (company_id);


--
-- Name: IDX_f2776bb8348f98136d93438462; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f2776bb8348f98136d93438462" ON public.item_serials USING btree (company_id, serial_number);


--
-- Name: IDX_f33b8120b71964d6e82edfd427; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f33b8120b71964d6e82edfd427" ON public.employees USING btree (company_id, matricule);


--
-- Name: IDX_f6ab9b42057488cb9271ca1824; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f6ab9b42057488cb9271ca1824" ON public.stock_levels USING btree (company_id);


--
-- Name: IDX_f8de8ad3f9d8767da622f2b94d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f8de8ad3f9d8767da622f2b94d" ON public.partners USING btree (company_id);


--
-- Name: IDX_fb4d36728912b63b7aaefe9593; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fb4d36728912b63b7aaefe9593" ON public.price_items USING btree (company_id);


--
-- Name: IDX_fcdf63b7dbc80503ce792e3acc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_fcdf63b7dbc80503ce792e3acc" ON public.chat_rooms USING btree (company_id, alias);


--
-- Name: IDX_ff8feca8233baa944cbfad7671; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ff8feca8233baa944cbfad7671" ON public.chat_memberships USING btree (company_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_company ON public.audit_logs USING btree (company_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_cash_box_entries_company_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_box_entries_company_period ON public.cash_box_entries USING btree (company_id, period);


--
-- Name: idx_client_feedback_company_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_feedback_company_mission ON public.client_feedback USING btree (company_id, mission_id);


--
-- Name: idx_client_feedback_company_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_feedback_company_team ON public.client_feedback USING btree (company_id, team_id);


--
-- Name: idx_expenses_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_company_date ON public.expenses USING btree (company_id, expense_date);


--
-- Name: idx_geopositions_company_tech_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geopositions_company_tech_recorded ON public.geopositions USING btree (company_id, technician_id, recorded_at);


--
-- Name: idx_invoice_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments USING btree (company_id, invoice_id);


--
-- Name: idx_mission_expenses_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mission_expenses_company_date ON public.mission_expenses USING btree (company_id, expense_date);


--
-- Name: idx_missions_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_invoice ON public.missions USING btree (company_id, invoice_id);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (company_id, user_id, read_at);


--
-- Name: idx_pricing_rules_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_rules_parent ON public.pricing_rules USING btree (company_id, parent_partner_id) WHERE active;


--
-- Name: idx_renforts_company_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_renforts_company_team ON public.renforts USING btree (company_id, team_id);


--
-- Name: idx_stock_movements_company_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_company_created ON public.stock_movements USING btree (company_id, created_at DESC);


--
-- Name: idx_stock_purchases_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_purchases_company_status ON public.stock_purchases USING btree (company_id, status);


--
-- Name: idx_team_payrolls_company_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_payrolls_company_period ON public.team_payrolls USING btree (company_id, period);


--
-- Name: uq_clients_company_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clients_company_name ON public.clients USING btree (company_id, lower(name));


--
-- Name: uq_pricing_rule_v2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_pricing_rule_v2 ON public.pricing_rules USING btree (company_id, parent_partner_id, child_partner_id, item_id, prestation_key, effective_from) NULLS NOT DISTINCT;


--
-- Name: missions FK_0a17e635f497412d99e0db5ae4f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT "FK_0a17e635f497412d99e0db5ae4f" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: company_subscriptions FK_0b6408c48588e38940d31cec9fe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_subscriptions
    ADD CONSTRAINT "FK_0b6408c48588e38940d31cec9fe" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: expenses FK_124a88386adbedacbce18573837; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_124a88386adbedacbce18573837" FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: daily_workers FK_172d3bf61e93f689aa839ab51d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_workers
    ADD CONSTRAINT "FK_172d3bf61e93f689aa839ab51d8" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: stock_movements FK_1e003d3f4797c64c017bf576d99; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "FK_1e003d3f4797c64c017bf576d99" FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE RESTRICT;


--
-- Name: item_serials FK_1f62ce462dcde6e5d67e32919ec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT "FK_1f62ce462dcde6e5d67e32919ec" FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: invoice_lines FK_2da95dc86a54a00ff20ce46d0fe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT "FK_2da95dc86a54a00ff20ce46d0fe" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: mission_field_reports FK_304915064813a4c74f1777ec3e4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_field_reports
    ADD CONSTRAINT "FK_304915064813a4c74f1777ec3e4" FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: rag_chunks FK_44209ba9d30face3080d69eb4e2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_chunks
    ADD CONSTRAINT "FK_44209ba9d30face3080d69eb4e2" FOREIGN KEY (document_id) REFERENCES public.rag_documents(id) ON DELETE CASCADE;


--
-- Name: leave_requests FK_52b4b7c7d295e204add6dbe0a09; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT "FK_52b4b7c7d295e204add6dbe0a09" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: vehicles FK_5ce598cf1eae45259f06b5fe410; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "FK_5ce598cf1eae45259f06b5fe410" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: expenses FK_5fc8d9c2e4f6105eb9ccbae8f38; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_5fc8d9c2e4f6105eb9ccbae8f38" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: stock_levels FK_646a24750192418e87556abd277; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT "FK_646a24750192418e87556abd277" FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: vehicle_events FK_6fea664e4f14f4c3b79d5ff3801; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_events
    ADD CONSTRAINT "FK_6fea664e4f14f4c3b79d5ff3801" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: users FK_7ae6334059289559722437bcc1c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_7ae6334059289559722437bcc1c" FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: item_batches FK_7c510ffe6297187750d092935df; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_batches
    ADD CONSTRAINT "FK_7c510ffe6297187750d092935df" FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: chat_messages FK_7f52e11d11d4e8cc41224352869; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "FK_7f52e11d11d4e8cc41224352869" FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: vehicle_documents FK_8215ef09586915f4ab3e7db0162; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_documents
    ADD CONSTRAINT "FK_8215ef09586915f4ab3e7db0162" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: saas_transactions FK_832a11567538facc86c4a40b2a9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saas_transactions
    ADD CONSTRAINT "FK_832a11567538facc86c4a40b2a9" FOREIGN KEY (invoice_id) REFERENCES public.invoices_saas(id) ON DELETE CASCADE;


--
-- Name: invoices FK_8a99ad37c37208ab691eab2d894; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_8a99ad37c37208ab691eab2d894" FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses FK_8d37d8d5c1e5053916810bbfa18; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_8d37d8d5c1e5053916810bbfa18" FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: vehicle_checks FK_8e7ba2a86f3dc39a4e1f31440b8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_checks
    ADD CONSTRAINT "FK_8e7ba2a86f3dc39a4e1f31440b8" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: employees FK_93a9cbef80993a39415d94b310b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "FK_93a9cbef80993a39415d94b310b" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: push_tokens FK_94c371aff70dedeb89dae39f440; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT "FK_94c371aff70dedeb89dae39f440" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vehicles FK_a000464f2359d0cdb344ed17a05; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "FK_a000464f2359d0cdb344ed17a05" FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: employees FK_a2b296440dd3bd7e32b75551080; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "FK_a2b296440dd3bd7e32b75551080" FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: item_serials FK_a8101db2109b71b57c4850682ca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_serials
    ADD CONSTRAINT "FK_a8101db2109b71b57c4850682ca" FOREIGN KEY (current_warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


--
-- Name: vehicles FK_ab1a9d73c5038907d1c75b9744d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "FK_ab1a9d73c5038907d1c75b9744d" FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT;


--
-- Name: stock_movements FK_b1801806518a5c9340326bfbc16; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT "FK_b1801806518a5c9340326bfbc16" FOREIGN KEY (item_serial_id) REFERENCES public.item_serials(id) ON DELETE SET NULL;


--
-- Name: technicians FK_b278539a514fd8e409053953ee9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT "FK_b278539a514fd8e409053953ee9" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE RESTRICT;


--
-- Name: rag_messages FK_b3c10916af3e4fa71decf09c76b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rag_messages
    ADD CONSTRAINT "FK_b3c10916af3e4fa71decf09c76b" FOREIGN KEY (conversation_id) REFERENCES public.rag_conversations(id) ON DELETE CASCADE;


--
-- Name: technicians FK_b4c47d87e75cf647a0c21372fc5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT "FK_b4c47d87e75cf647a0c21372fc5" FOREIGN KEY (team_leader_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: chat_memberships FK_b973b1314b2384652c8ff3c2156; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_memberships
    ADD CONSTRAINT "FK_b973b1314b2384652c8ff3c2156" FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: attendance FK_c531016e601d83c9a7818f5e12e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "FK_c531016e601d83c9a7818f5e12e" FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: invoice_penalties FK_ca9b834840196a94c68e7796a23; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_penalties
    ADD CONSTRAINT "FK_ca9b834840196a94c68e7796a23" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: stock_levels FK_d169967e0b3af6d23bfeaa515db; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_levels
    ADD CONSTRAINT "FK_d169967e0b3af6d23bfeaa515db" FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: technicians FK_d86d7aa49aa7823f841ac49b0ba; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT "FK_d86d7aa49aa7823f841ac49b0ba" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: compliance_records FK_d8ca7cdb0b55e0bef110f1ab692; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_records
    ADD CONSTRAINT "FK_d8ca7cdb0b55e0bef110f1ab692" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: attendance FK_fdf1e37778f242ad221009e03b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "FK_fdf1e37778f242ad221009e03b4" FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: client_feedback client_feedback_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_feedback
    ADD CONSTRAINT client_feedback_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: client_feedback client_feedback_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_feedback
    ADD CONSTRAINT client_feedback_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: client_feedback client_feedback_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_feedback
    ADD CONSTRAINT client_feedback_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: clients clients_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invoice_payments invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: items items_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: mission_expenses mission_expenses_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expenses
    ADD CONSTRAINT mission_expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: mission_expenses mission_expenses_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expenses
    ADD CONSTRAINT mission_expenses_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: mission_expenses mission_expenses_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expenses
    ADD CONSTRAINT mission_expenses_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: permanence_slots permanence_slots_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permanence_slots
    ADD CONSTRAINT permanence_slots_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: pilotes pilotes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pilotes
    ADD CONSTRAINT pilotes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_child_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_child_partner_id_fkey FOREIGN KEY (child_partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_parent_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_parent_partner_id_fkey FOREIGN KEY (parent_partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: renforts renforts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renforts
    ADD CONSTRAINT renforts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: renforts renforts_from_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renforts
    ADD CONSTRAINT renforts_from_zone_id_fkey FOREIGN KEY (from_zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: renforts renforts_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renforts
    ADD CONSTRAINT renforts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: renforts renforts_to_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renforts
    ADD CONSTRAINT renforts_to_zone_id_fkey FOREIGN KEY (to_zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: stock_purchases stock_purchases_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_purchases
    ADD CONSTRAINT stock_purchases_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: stock_purchases stock_purchases_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_purchases
    ADD CONSTRAINT stock_purchases_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE SET NULL;


--
-- Name: team_payrolls team_payrolls_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_payrolls
    ADD CONSTRAINT team_payrolls_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: team_payrolls team_payrolls_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_payrolls
    ADD CONSTRAINT team_payrolls_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: zones zones_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


