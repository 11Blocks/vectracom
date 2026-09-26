-- 007 — Facturation client du tenant : clients, factures manuelles, cycle de vie
-- (envoi, paiements, avoirs), quantités décimales, verrouillage des missions facturées,
-- coordonnées bancaires de l'émetteur. Idempotent.

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
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
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_company_name ON clients(company_id, lower(name));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'periodique';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_snapshot jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tva_rate numeric(6,4);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(15,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credited_invoice_id uuid;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mission_count integer NOT NULL DEFAULT 0;

ALTER TABLE invoice_lines ALTER COLUMN quantity TYPE numeric(12,3);
ALTER TABLE invoice_lines ALTER COLUMN original_quantity TYPE numeric(12,3);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL,
  paid_at date NOT NULL,
  method text NOT NULL DEFAULT 'virement',
  reference text,
  note text,
  recorded_by uuid
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(company_id, invoice_id);

ALTER TABLE missions ADD COLUMN IF NOT EXISTS invoice_id uuid;
CREATE INDEX IF NOT EXISTS idx_missions_invoice ON missions(company_id, invoice_id);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_footer text;
