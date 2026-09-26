-- 009 — Opérations tenant : annulation de mission, rattachement incident ↔ mission,
-- historique des imports planning. Idempotent.

ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
