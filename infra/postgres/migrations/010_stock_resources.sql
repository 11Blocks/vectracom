-- 010 — Stock : auteur, annulation et deltas appliqués sur les mouvements.
-- Idempotent : peut être rejoué sans effet de bord.

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cancelled_by uuid;
-- Variations réellement appliquées par emplacement : { "<warehouseId>": delta }.
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS deltas jsonb;

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_created
  ON stock_movements (company_id, created_at DESC);
