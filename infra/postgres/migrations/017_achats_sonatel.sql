-- =============================================================
-- VECTRACOM — Migration 017 : Achats validés SONATEL (L5).
-- ONECOMIT peut acheter du matériel manquant, avec validation
-- SONATEL puis facturation au donneur d'ordre.
-- =============================================================

CREATE TABLE IF NOT EXISTS stock_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  stock_item_id uuid REFERENCES stock_items(id) ON DELETE SET NULL,
  designation text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric(14,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'en_attente', -- en_attente | valide_sonatel | refuse | facture
  sonatel_validated_at timestamptz,
  invoice_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_purchases_company_status ON stock_purchases (company_id, status);
