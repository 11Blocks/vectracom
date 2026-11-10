-- =============================================================
-- VECTRACOM — Migration 020 : cascade tarifaire par prestation (L0).
-- Décision Moussa (10/11/2026) : les taux de reversement s'appliquent
-- aux prestations (S+I 80 / PASSAGE 87 / Survey 93 / RELEVE 91),
-- pas seulement aux items. Clé au format des factures : « CATÉGORIE:clé »
-- (ex. « PRODUCTION:survey + installation »).
-- Priorité de la règle appliquée : prestation_key > item_id > défaut.
--
-- Correctif : la contrainte d'unicité de la migration 012
-- (company_id, parent, child, item_id) laissait passer plusieurs règles
-- « par défaut » pour un même couple, car PostgreSQL considère deux NULL
-- comme distincts. Le nouvel index utilise NULLS NOT DISTINCT (PG ≥ 15)
-- et inclut prestation_key + effective_from (plusieurs périodes d'effet
-- successives restent possibles ; les chevauchements sont refusés par l'API).
--
-- Idempotente. À appliquer avec : psql -1 -v ON_ERROR_STOP=1
-- Avant la prod : vérifier l'absence de doublons (requête en fin de fichier).
-- =============================================================

ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS prestation_key text;

-- Supprime l'ancienne contrainte UNIQUE (nom généré automatiquement en 012).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'pricing_rules'::regclass
       AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE pricing_rules DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_rule_v2
  ON pricing_rules (company_id, parent_partner_id, child_partner_id, item_id, prestation_key, effective_from)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_pricing_rules_parent
  ON pricing_rules (company_id, parent_partner_id) WHERE active;

-- Contrôle avant application (lecture seule) — doit renvoyer 0 ligne :
-- SELECT company_id, parent_partner_id, child_partner_id, item_id, effective_from, count(*)
--   FROM pricing_rules
--  GROUP BY 1, 2, 3, 4, 5
-- HAVING count(*) > 1;
