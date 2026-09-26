-- 008 — Comptabilité tenant : date métier des dépenses, lignes de caisse datées,
-- annulables et attribuées. Idempotent.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by uuid;
UPDATE expenses SET expense_date = created_at::date WHERE expense_date IS NULL;
ALTER TABLE expenses ALTER COLUMN expense_date SET DEFAULT CURRENT_DATE;
ALTER TABLE expenses ALTER COLUMN expense_date SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_company_date ON expenses (company_id, expense_date);

ALTER TABLE cash_box_entries ADD COLUMN IF NOT EXISTS entry_date date;
ALTER TABLE cash_box_entries ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE cash_box_entries ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE cash_box_entries ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE cash_box_entries ADD COLUMN IF NOT EXISTS loan_entry_id uuid;
UPDATE cash_box_entries
   SET entry_date = CASE WHEN to_char(created_at, 'YYYY-MM') = period THEN created_at::date
                         ELSE to_date(period || '-01', 'YYYY-MM-DD') END
 WHERE entry_date IS NULL;
UPDATE cash_box_entries SET type = 'depense' WHERE type = 'sortie';
UPDATE cash_box_entries SET type = 'appro' WHERE type = 'entree';
ALTER TABLE cash_box_entries ALTER COLUMN entry_date SET DEFAULT CURRENT_DATE;
ALTER TABLE cash_box_entries ALTER COLUMN entry_date SET NOT NULL;
