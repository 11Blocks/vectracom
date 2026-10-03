-- =============================================================
-- VECTRACOM — Migration 015 : Rajouts + blocages levés (fin L2).
--   - rajout            : mission ajoutée manuellement (hors import SONATEL).
--   - blocage_leve_at   : horodatage de la levée d'un motif de blocage.
-- =============================================================

ALTER TABLE missions ADD COLUMN IF NOT EXISTS rajout boolean NOT NULL DEFAULT false;

ALTER TABLE missions ADD COLUMN IF NOT EXISTS blocage_leve_at timestamptz;
